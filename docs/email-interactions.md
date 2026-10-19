# Email interactions: design note

> **Status: for approval.** Issue #36 asks for this note to be approved before
> the work merges, because the server stores a mail credential. The code on
> this branch builds what is described here. A change to the design changes
> the code too.

Phase 8 of #28. Calls and texts are logged by the phone (#35). Mail is
another matter. Android has no API for reading another app's mail, so the
**server** reads it: the user connects a mailbox, and a poller logs an
`email` interaction for each message to or from one of their people. The
interactions are written by `logInteractions` in `server/src/interactions/log.ts`,
the same function the phone's calls and texts go through.

## What is read

- **IMAP over TLS, with an app password.** Gmail, Fastmail, iCloud and
  Outlook.com all issue app passwords for IMAP once two-step sign-in is on. A
  self-hosted Dovecot works the same way. Gmail OAuth could come later, as a
  second kind of credential in the same row.
- **Implicit TLS only** (port 993 by default), with the certificate checked.
  Plain IMAP and STARTTLS are not offered: a STARTTLS that can be stripped
  would send the password in the clear.
- **Headers only.** Each message is fetched with IMAP `ENVELOPE` and
  `INTERNALDATE` and nothing else: no `BODY[]`, no `BODYSTRUCTURE`, no
  attachments. The envelope carries From, To, Cc, Bcc, Date and Message-ID,
  and Subject. The subject is fetched with the envelope, since IMAP has no
  envelope without it, but it is never kept or logged. The reader's
  interface (`MailHeader`) has no field for a subject or a body, so the code
  after it cannot use one even by mistake. Each poll logs what it fetched:
  `[mail] <folder>: fetched N envelopes (headers only)`.
- **Two folders:** `INBOX`, read as *incoming* (the person is the sender),
  and the folder marked `\Sent` (RFC 6154 special-use), read as *outgoing*
  (the people are To, Cc and Bcc). A server that marks no `\Sent` folder is
  read for incoming mail only. Other folders, spam among them, are not read.
- The user's own address (the login, or the address given when connecting)
  is never matched, so mail to yourself logs nothing.

## Matching

Each address is normalized as a contact detail of type `email` is
(`normalizeContactValue`: trimmed, lower case) and looked up in the user's
`contact_infos.normalized_value` among email details. This is the same
lookup the phone's numbers use (see [`server.md`](server.md#logged-interactions)).

- One interaction per message and person. An email to three of your people
  is three interactions; one to nobody you know is none.
- An address that matches nobody is dropped at once. It is not stored or
  logged.
- `externalId` is the Message-ID. A message with none (rare, and malformed)
  gets `<folder>:<UIDVALIDITY>:<UID>` instead. The unique key is
  `(user_id, source, external_id, person_id)`. A message that is in both
  INBOX and Sent (mail to yourself with a person in Cc), or one read again
  after a reset, is logged once per person.
- `occurredAt` is the envelope's Date, or the server's INTERNALDATE when Date
  is missing or unreadable.

## The credential, at rest

The app password is the only secret. It is sealed with **AES-256-GCM**
(`node:crypto`) before it reaches the database and opened only in memory,
just before a login.

- **Keys come from the environment:** `MAIL_CREDENTIAL_KEYS`, a
  comma-separated list of `<id>:<base64 of 32 random bytes>`. The first key
  seals; any key in the list opens. Generate one with
  `openssl rand -base64 32`. The key never touches the database.
- **Without the variable, the feature is off.** `connectMailbox` refuses
  with a message naming the variable, the Settings card says the server is
  not set up for mail, and the poller does not start. Nothing falls back to
  a key derived from another secret.
- **The sealed value** is `v1.<key id>.<iv>.<tag>.<ciphertext>`, each part
  base64url, with a fresh 96-bit IV per seal. The associated data is
  `mailbox:<user id>`, so a sealed password copied onto another user's row
  does not open.
- **Rotating a key:**
  1. put a new key first in `MAIL_CREDENTIAL_KEYS`, keeping the old one after it;
  2. restart. At boot every credential sealed under a key other than the first
     is opened and sealed again under the first. The server logs
     `[mail] re-sealed N credentials under key <id>`;
  3. remove the old key and restart again.
  
  A credential whose key has gone (a key removed too early) cannot be opened.
  Its mailbox is set to *needs reconnect*, and the user types the password
  again.
- **The table is not in the GraphQL schema.** `mailboxes` is a server table,
  like `oidc_settings`: excluded from the generated API and reached only
  through `mailbox`, `connectMailbox` and `disconnectMailbox`, none of which
  returns the credential. The password is in one request, `connectMailbox`.
  Operation variables are never logged.
- A database dump, or a read-only leak of the database, holds no usable
  password without the environment. A compromise of the running server does,
  as it would for any credential the server has to use.

## The poller

One loop inside the server process. Philotes runs as a single instance. A
second instance would poll the same mailboxes twice, which the unique key
makes harmless but wasteful.

- **Schedule.** Every `MAIL_DEFAULTS.tickSeconds` (60 s) the loop takes the
  mailboxes whose `next_poll_at` has passed, oldest first, at most
  `maxMailboxesPerTick` of them, and polls them one at a time. A poll that
  succeeds sets `next_poll_at` to `pollIntervalMinutes` (15 min) later. A
  tick that starts while the last one is still running is skipped.
- **Cursor.** Per folder, the poll keeps the folder's `UIDVALIDITY` and the
  highest UID it has logged, and asks only for UIDs above it. The first poll
  of a folder, or any poll after its `UIDVALIDITY` changes, searches
  `SINCE` `firstPollDays` (30) back instead. Messages are read in pages of
  `pageSize`. The cursor moves after each page is logged, so a poll cut short
  carries on where it stopped. Each poll reads at most `maxPagesPerPoll` pages
  per folder, so a large mailbox is caught up over several polls rather than
  in one long one.
- **Backoff.** A poll that fails for any reason other than a refused login
  increments `failure_count`. The next poll waits
  `min(retryBaseMinutes × 2^(failures − 1), retryMaxMinutes)`: 1, 2, 4 … up
  to 6 hours. The mailbox shows *failing* with the last error until a poll
  succeeds, which resets the count.
- **A refused login** (IMAP `AUTHENTICATIONFAILED`, or a NO to LOGIN) sets
  *needs reconnect* and stops polling that mailbox. Retrying a wrong password
  every few minutes only gets the account locked. Connecting again with a
  new password clears it.
- **Timeouts.** Connecting, and each command, are bounded
  (`connectTimeoutSeconds`), so one silent server cannot hold the loop.

## Disconnecting

- **The user disconnects** (`disconnectMailbox`, a button in Settings). The
  row is deleted, credential and cursors with it, at once. Interactions
  already logged stay: they are the user's record, and each can be deleted
  like any other. A poll already running for that mailbox finishes what it
  is logging, and its cursor write finds no row.
- **The user connects again,** with the same or another mailbox. This
  replaces the credential and resets the status. The cursors are kept when
  the host and login are the same, and dropped when they are not.
- **The account is deleted.** The row cascades with the user.
- **The mail server drops the connection** mid-poll. The poll fails, the
  backoff applies, and the next one carries on from the last page logged.
- **The Philotes server shuts down.** The loop stops taking mailboxes when
  the signal arrives (`stopOnSignals`'s `before`). A poll in flight is told
  to stop, closes its IMAP connection, and keeps the cursor of its last whole
  page, all before the database closes.

## Questions for review

These have answers in the code, but they are choices the user may want
otherwise:

1. **Outbound connections from the server.** `connectMailbox` makes the
   server open a TLS connection to a host the user names. On an instance
   shared with other people, that could be used to probe the server's own
   network. The mitigations:
   - TLS with certificate checks, so a non-TLS service gives no answer;
   - one generic message for every failure except a refused login;
   - connection attempts throttled per user, like sign-in.
   
   Private addresses are *allowed*, because a homelab Dovecot is a real use.
   An instance that wants otherwise would need an allowlist, which is not
   built.
2. **One mailbox per user.** It is enough for "the address I use with
   people". Several would need a list in Settings and a per-mailbox own
   address.
3. **The dependency.** IMAP is spoken by `imapflow` (MIT, maintained by
   Postal Systems, the Nodemailer authors), pinned to an exact version.

## Not covered

- Gmail OAuth, and providers without app passwords (Outlook work accounts
  that have turned basic auth off).
- Threads. Each message is its own interaction, so a long back-and-forth on
  one day is several.
- Mail the user archived out of INBOX before the first poll. Only INBOX and
  Sent are read.
