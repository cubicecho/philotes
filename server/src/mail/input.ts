import { z } from 'zod';
import { MAIL_DEFAULTS } from '../core/defaults.ts';

const { defaultPort, maxHostLength, maxUsernameLength, maxPasswordLength } = MAIL_DEFAULTS;

/** The highest TCP port. */
const MAX_PORT = 65_535;
/** A host name or an IPv4 address: letters, digits, dots and hyphens. No scheme, path or port. */
const HOST = /^[A-Za-z0-9.-]+$/;

/** What `connectMailbox` takes, once checked. The user's own address defaults to the login. */
export const connectMailboxInput = z
  .object({
    host: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Give the mail server, such as imap.gmail.com.')
      .max(maxHostLength, 'The server name is too long.')
      .regex(HOST, 'Give the server by its name alone, such as imap.gmail.com: no https:// and no port.'),
    port: z
      .int('The port is a whole number.')
      .min(1, 'The port is between 1 and 65535.')
      .max(MAX_PORT, 'The port is between 1 and 65535.')
      .nullish()
      .transform((port) => port ?? defaultPort),
    username: z.string().trim().min(1, 'Give the login, usually your email address.').max(maxUsernameLength),
    // Not trimmed: a password is what it is. Gmail shows its app passwords in groups and takes them either way.
    password: z.string().min(1, 'Give the app password.').max(maxPasswordLength, 'The password is too long.'),
    address: z
      .email('Your address is an email address.')
      .max(maxUsernameLength)
      .nullish()
      .transform((address) => address?.trim().toLowerCase() ?? null),
  })
  .transform(({ address, ...rest }, ctx) => {
    const own = address ?? (z.email().safeParse(rest.username).success ? rest.username.toLowerCase() : null);
    if (own === null) {
      ctx.addIssue({ code: 'custom', message: 'The login is not an email address, so give your address too.' });
      return z.NEVER;
    }
    return { ...rest, address: own };
  });

/** A mailbox to connect, once checked. */
export type ConnectMailboxInput = z.infer<typeof connectMailboxInput>;
