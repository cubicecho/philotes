# Philotes

**A personal CRM for the people who matter to you — not your pipeline.**

**[cubicecho.github.io/philotes](https://cubicecho.github.io/philotes/)**

Most CRMs are built for sales. Philotes is built for life. It helps you stay
connected to the people you actually care about: friends, family, colleagues,
mentors. No quotas, no funnels, no subscriptions. Just your relationships, on
your machine.

Philotes (Φιλότης) is the Greek goddess of friendship and affection. It felt
like the right name.

---

![Persons list](docs/screenshots/persons-list.png)

---

## Why Philotes?

Life moves fast and relationships slip through the cracks. You forget to follow
up, you lose track of how you met someone, you can't remember if it was their
birthday or their kid's birthday. Philotes gives you a quiet place to keep that
context — so you can show up for the people in your life.

It runs 100% locally. No cloud to trust, no vendor to worry about. Sign-in is
handled by your own instance, and your data lives on your machine,
in your own Postgres database, and nowhere else.

---

## The Research

Most people don't lose touch because they stopped caring. They lose touch because
caring isn't enough without a system. Research on social ties consistently finds
that the strength and breadth of your relationships is one of the most reliable
predictors of long-term wellbeing — more reliable than wealth, status, or even
health habits. And yet we have no infrastructure for it. We have calendars for
work and apps for deliveries. Relationships get whatever attention is left over.

Dunbar's number — roughly 150 — describes the upper bound of meaningful
relationships the human brain can track without external support. Below that
ceiling, we still struggle. The cost isn't dramatic falling-outs; it's quiet
drift. People slip from "close friend" to "someone I used to know" simply because
neither party had a nudge to reach out. The contact frequency setting in Philotes
— weekly, monthly, quarterly — is designed to provide exactly that nudge. It's
a lightweight externalisation of intent: you decide once how often this person
matters to your life, and the app holds that decision so your brain doesn't
have to.

This is adjacent to how GTD thinkers approach trusted systems. The insight is
that presence requires offloading. When your mind is holding the background task
of "I should call Marcus", it can't be fully in the room when you're actually
talking to someone else. The Review page in Philotes makes "overdue" contacts
visible in one place — not to create guilt, but to create clarity. You can see
the gap and decide, deliberately, whether to close it.

The Pre-Contact Brief surfaces recent notes, open tasks, and upcoming dates
before you reach out to someone. The intention is small but meaningful: arriving
at a conversation with context signals that you've been paying attention, and
that signal travels. Research on relationship quality consistently points to
felt attentiveness — not grand gestures — as the thing that makes people feel
cared for. Preparation isn't performance; it's respect.

The `@mention` system in notes draws from what knowledge management tools like
Roam and Obsidian demonstrated: linking people through shared context surfaces
connections that aren't obvious in a flat contact list. Notes about a
conversation between two friends, or a project shared by three colleagues,
create edges in a graph that reflects how your social world actually works. The
network view in Philotes makes that graph visible. Research on social capital
suggests that seeing the shape of your network — where the clusters are, where
the bridges are, where the gaps are — has real value. You notice who you've been
neglecting not because you feel bad about it, but because the picture shows it.

Remembering important dates matters disproportionately to how much effort it
takes. Studies on perceived thoughtfulness in gift-giving and acknowledgement
find that timing is what carries the weight — not size or cost. A message on
the right day, even a short one, lands differently than a belated one. Philotes
tracks birthdays, anniversaries, and any recurring milestone you define, and
surfaces upcoming ones in the Review page. The automation doesn't reduce the
warmth. It just removes the cognitive friction between caring and acting on it.

Finally, privacy as a design constraint. The decision to store everything
locally — in your own Postgres database, on your machine, with no cloud
sync — is architectural, but it's also philosophical. Intimate relationship
data is some of the most sensitive information a person generates. Who you know,
how often you talk, what you remember about them. That data shouldn't be a
product, and Philotes isn't a platform. It's a tool. The boundary matters.

---

## Features

- **People** — name, email, avatar, how you met, preferred contact frequency
- **Interactions** — log touchpoints (in-person, phone, email, video, etc.) with channel, sentiment, and notes
- **Notes** — free-form notes with `@mention` support to link other contacts
- **Important Dates** — birthdays, anniversaries, and any other recurring or one-off significant date
- **Labels & Tags** — flexible tagging across people, notes, and dates
- **Relationships** — track how people are connected to each other (friend, colleague, custom types)
- **Contact Info** — phone numbers, social handles, URLs
- **Addresses** — home, work, and more
- **Activities & Tasks** — things to do with or for someone
- **Suggested Introductions** — surfaces people who share labels but aren't yet connected
- **Network View** — a graph of your relationships
- **Review Page** — a to-do-style overview for pending follow-ups

---

### Person Detail

![Person detail view](docs/screenshots/person-detail.png)

### Weekly Review

![Weekly review page](docs/screenshots/review.png)

### Relationship Network

![Network graph](docs/screenshots/network.png)

---

## Getting Started

You'll need **Node.js 26+** and **npm**.

```bash
git clone https://github.com/vantreeseba/philotes.git
cd philotes
npm install
cp .env.example .env
npm run db:up
npm run dev
```

`npm run dev` needs a Postgres to talk to. Copy `.env.example` to `.env`, then
start the local one with `npm run db:up` (Docker). The app opens at
[http://localhost:8081](http://localhost:8081) and the API listens on port 3000.
Create an account on the login page with an email and a password.

---

## Tech Stack

| Layer    | Technology                                                  |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19, Expo Router (web target), Apollo Client            |
| UI       | React Native primitives, Tailwind 4 via NativeWind 5, cubeui |
| API      | GraphQL Yoga on Express 5, better-auth                      |
| Database | Drizzle ORM on PostgreSQL                                    |
| Testing  | Vitest                                                      |
| Linting  | Biome                                                       |
| Runtime  | Node.js 26+, ESM                                            |

---

## Development

```bash
npm run dev          # Start the app and API server together
npm test             # Run the test suite
npm run check        # Codegen, lint, and type-check
npm run db:studio    # Open Drizzle Studio to browse the local database
```

---

## Running with Docker

Philotes ships with a multi-stage `node:26-slim` Dockerfile. The container runs the
GraphQL API and serves the built frontend — no separate web server needed.

**Build the image:**
```bash
docker build -t philotes .
```

**Run it with its database:**
```bash
BETTER_AUTH_SECRET=$(openssl rand -hex 32) docker compose up -d
```

Then open [http://localhost:3000](http://localhost:3000).

[`docker-compose.yml`](docker-compose.yml) starts Philotes beside a
`postgres:17-alpine` container. Migrations run automatically on startup.

**Volumes:**
| Volume | Purpose |
| --- | --- |
| `philotes_pgdata` | The Postgres data (your contacts) |
| `philotes_data` | Uploaded avatar images (`/data/avatars`) |

**Environment variables:**
| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | none, required | A `postgres://` connection string |
| `BETTER_AUTH_SECRET` | none, required in production | Signs sessions |
| `SECURE_LOCAL_NET` | `false` | Any email signs in at once. Private networks only |
| `SESSION_STORE` | `memory` | `database` keeps sessions across restarts |
| `SMTP_URL` | none | SMTP server for sign-in links. Unset, sign-in is by password only |
| `SMTP_FROM` | `philotes@<APP_URL host>` | From address of sign-in emails |
| `APP_URL` | `http://localhost:<PORT>` | Public URL the app is served at |
| `PORT` | `3000` | Port the server listens on |
| `AVATAR_DIR` | `./avatars`, `/data/avatars` in the image | Where uploaded avatars are kept |
| `DB_CONNECT_TIMEOUT_MS` | `60000` | How long boot waits for Postgres |
| `TRUST_PROXY` | `false` | Proxy hops that may set `X-Forwarded-For` |

To use a Postgres you already run, set `DATABASE_URL` to it and start only the
`philotes` service. TLS is required for a public host in production, and left
off for local and private addresses unless the URL sets `sslmode`.

> **Upgrading from a release that stored data in PGlite (`/data/pgdata`):**
> that data is not migrated automatically. Keep the old volume until you have
> moved what you need.
>
> **Upgrading from an image that kept avatars in `philotes_avatars`:** the
> server now runs as the `node` user and keeps avatars in the `philotes_data`
> volume. Upload avatars again, or copy the old files into the new volume.

Released images are published to Docker Hub (`vantreeseba/philotes`) and to
GHCR (`ghcr.io/cubicecho/philotes`).

---

## License

MIT
