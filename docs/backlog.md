# Philotes — Feature Backlog

Features researched and ready for implementation, ordered by priority.

---

## Task A — Relationship Tier Field on Persons

**Priority:** P0 | **Size:** S | **Research:** Dunbar (1993, 2021), research docs Task 3

**Description:**
Add a `tier` column to the `persons` table (`intimate | close | active | acquaintance`). Display as a visual badge on the person list and detail view. Allow filtering and sorting the person list by tier. Pre-populate the suggested `contactFrequency` default based on tier:

- `intimate` → weekly
- `close` → monthly
- `active` → quarterly
- `acquaintance` → yearly

**Implementation notes:**
- DB: add `tier` to `db/src/models/persons.ts`, export `TIER_VALUES` constant
- Run `npm run db:generate && npm run db:push && npm run codegen`
- `PersonForm`: add tier select field
- `PersonList`: show tier badge on each row, add tier filter to existing filter bar
- Person detail: show tier badge in header

**Why this matters:** Every other health/overdue feature becomes more accurate with tier data. Dunbar's nested tier model is the scientific basis for how much contact frequency each relationship needs. Currently `contactFrequency` is a manual override — tier makes the default intelligent.

---

## Task F — Interaction Sentiment Surfacing

**Priority:** P2 | **Size:** S | **Research:** Mehl et al. (2010), conversation-quality.md

**Description:**
The `sentiment` field already exists on `interactions` (`great | good | neutral | difficult`) but is not surfaced anywhere in the UI beyond the interaction log itself.

Surface it in two places:

1. **Person detail header** — show a subtle sentiment trend for the last 5 interactions (e.g., a small row of colored dots or emoji: 😊😊😐😊😊)
2. **Don't Lose Touch / Overdue view** — flag contacts where recent interactions have been consistently `difficult` with a small indicator, so the user is aware before reaching out

**Implementation notes:**
- No schema or codegen changes needed — `sentiment` is already fetched
- Client-side computation only
- Keep it subtle — this is a signal, not a score. Avoid making it feel like a relationship grade.

**Why this matters:** Mehl et al. (2010) found substantive conversation quality correlates with happiness (r=.36). Frequency alone misses whether interactions are going well. A difficult recent pattern is important context before reaching out.

---

## Task H — Gift Ideas per Person

**Priority:** P2 | **Size:** S | **Research:** Dai et al. (2014), happiness-and-wellbeing.md, research docs Task 13

**Description:**
A lightweight place to capture gift ideas per person — things someone mentioned wanting, or ideas you had for them. The insight ("she mentioned that cookbook") happens weeks before the moment (her birthday). This bridges the gap.

**Implementation options (choose simplest):**

- **Option A:** Special note category — add a `gift_idea` tag to the existing labels/tags system, no new schema needed
- **Option B:** A dedicated lightweight `giftIdeas` field — simple text array per person, or a minimal `gift_ideas` table (`id`, `personId`, `idea`, `occasionNote`, `createdAt`)

**Integration:** Surface gift ideas in the upcoming dates widget when that person has a date coming up within 30 days.

**Implementation notes:**
- Monica CRM (open source, PHP/Laravel) has a full gift tracking feature as a reference
- Keep it simple — this is a capture tool, not a shopping list manager

**Why this matters:** Temporal landmarks (birthdays, anniversaries) create windows of amplified impact for thoughtful gestures (Dai et al. 2014, Amabile & Kramer 2011). The challenge is that the insight happens at a random moment; gift capture bridges to the right moment.

---

## Research References

- Dunbar, R.I.M. (1993, 2021). Social Brain Hypothesis / Dunbar's Number.
- Mehl, M.R. et al. (2010). "Eavesdropping on Happiness." *Psychological Science*, 21(4).
- Dai, H. et al. (2014). Fresh Start Effect / Temporal Landmarks.
- Amabile, T. & Kramer, S. (2011). *The Progress Principle*.
- Liu, P. et al. (2023). Undervalued Maintenance of Social Connections.
