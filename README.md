# Philotes

**A personal CRM for the people who matter to you — not your pipeline.**

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

It runs 100% locally. No account to create, no cloud to trust, no vendor to
worry about. Your data lives on your machine, in an embedded Postgres database,
and nowhere else.

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
locally — in an embedded Postgres database, on your machine, with no cloud
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

You'll need **Node.js 22+** and **npm**.

```bash
git clone https://github.com/vantreeseba/philotes.git
cd philotes
npm install
npm run dev
```

The app opens at [http://localhost:3000](http://localhost:3000). That's it — no
database to set up, no environment variables required.

---

## Tech Stack

| Layer    | Technology                                                  |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19, Vite, TanStack Router, Apollo Client              |
| UI       | Tailwind CSS, shadcn/ui, Radix UI                           |
| API      | Apollo Server, GraphQL                                      |
| Database | Drizzle ORM, PGlite (embedded Postgres — no server needed)  |
| Testing  | Vitest                                                      |
| Linting  | Biome                                                       |
| Runtime  | Node.js 22+, ESM                                            |

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

Philotes ships with a multi-stage Alpine-based Dockerfile. The container runs the
GraphQL API and serves the built frontend — no separate web server needed.

**Build the image:**
```bash
docker build -t philotes .
```

**Run with persistent data:**
```bash
docker run -d \
  -p 3001:3001 \
  -v philotes-data:/data \
  -v philotes-avatars:/avatars \
  --name philotes \
  philotes
```

Then open [http://localhost:3001](http://localhost:3001).

**Volumes:**
| Volume | Purpose |
| --- | --- |
| `/data` | PGlite database files (persists your contacts) |
| `/avatars` | Uploaded avatar images |

**Environment variables:**
| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Port the server listens on |
| `DATABASE_URL` | `/data/pgdata` | PGlite data directory path, or a `postgres://` connection string |

---

## Using Full PostgreSQL

By default Philotes uses **PGlite** — an embedded Postgres that runs inside the
process with no external server required. If you prefer a standalone PostgreSQL
server (for multi-container deployments, external backups, or larger datasets),
set `DATABASE_URL` to a standard connection string and Philotes will switch
drivers automatically:

```
DATABASE_URL=postgres://user:password@host:5432/dbname
```

A ready-to-use Docker Compose file is provided at
[`docker-compose.postgres.yml`](docker-compose.postgres.yml):

```bash
docker compose -f docker-compose.postgres.yml up -d
```

This starts a `postgres:16-alpine` container and the Philotes app wired together.
Data is persisted in a named Docker volume (`pgdata`). Migrations run
automatically on startup.

> **Note:** When switching from PGlite to PostgreSQL your existing PGlite data
> does not migrate automatically. Start fresh or export/import your data manually.

---

## License

MIT
