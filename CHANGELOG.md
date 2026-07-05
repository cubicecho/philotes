# [1.8.0](https://github.com/cubicecho/philotes/compare/v1.7.0...v1.8.0) (2026-07-05)


### Bug Fixes

* add react-native-worklets dep and remove corrupt package.json entry ([d090c2b](https://github.com/cubicecho/philotes/commit/d090c2b1f69c142385994110048c392787935fe0))
* expose Metro dev server on port 3000 ([4df2290](https://github.com/cubicecho/philotes/commit/4df22909577d42bfe89e63ce2b9c94327952d07d))
* restore Apollo scalar type policies dropped in Expo migration ([a855b4f](https://github.com/cubicecho/philotes/commit/a855b4f36840547f2a30bffed4f89a3b3fecd451))
* restore person ID in Link hrefs dropped during Expo Router migration ([cdee65c](https://github.com/cubicecho/philotes/commit/cdee65c5c5ab66bbc7f1e28c368eca3b5766e8e9))
* strip .js extensions from all internal imports for Metro compatibility ([4eb9110](https://github.com/cubicecho/philotes/commit/4eb9110a3ea99d770e55399476de9347029bdaef))


### Features

* migrate app to Expo web (Metro bundler + Expo Router) ([2acbe42](https://github.com/cubicecho/philotes/commit/2acbe42a7d6a758ea5fc57c9ffa6ac4b12f5c3b0))

# [1.7.0](https://github.com/cubicecho/philotes/compare/v1.6.0...v1.7.0) (2026-07-05)


### Bug Fixes

* center card headers, bump to text-2xl, align header and body widths ([55f328b](https://github.com/cubicecho/philotes/commit/55f328ba222e026c45d65fd16e38a4d21ac518a6))
* harden Docker deployment for beta users ([80612ab](https://github.com/cubicecho/philotes/commit/80612ab40d43a624a84b33f970808b22ee38c485))
* increase card header text to text-lg to match button visual size ([0443789](https://github.com/cubicecho/philotes/commit/0443789eefc07e8a17e8b578a18ec4a4bba2c549))
* increase card header text to text-xl ([7192e6b](https://github.com/cubicecho/philotes/commit/7192e6b07c65351a0549833b40ad6a8ab649c60d))
* magic link auth, configurable PORT, and nav re-render on login ([821c4f1](https://github.com/cubicecho/philotes/commit/821c4f1da415d5b4e60aa06f278ca5806c5d8293))
* move Contact Info add button to card header, match Tags style ([e40afc0](https://github.com/cubicecho/philotes/commit/e40afc0860b44e295b6d616f79a43ae65cd8a85b))
* omit null expiresAt from api_keys insert to avoid pglite timestamp parse error ([c45e8b1](https://github.com/cubicecho/philotes/commit/c45e8b1aad24133ff4778797a4c843b0d1c15a91))
* reduce top padding on cards; align card header text size with buttons ([dea29f7](https://github.com/cubicecho/philotes/commit/dea29f715b536e7ef4e1f2b90aea2da620893646))
* reduce top padding on person detail cards ([85bfc7a](https://github.com/cubicecho/philotes/commit/85bfc7a27c685efe28ed1a9c4863ca1dcf8c35b3))
* reduce top padding on person detail cards ([d593f01](https://github.com/cubicecho/philotes/commit/d593f0132c679324b180c0ecfbfad2676c49b064))
* remove Add Date from top action bar ([28ed590](https://github.com/cubicecho/philotes/commit/28ed590542e5ae777c9fb43835fb4ff2dd19c65c))
* resolve all TypeScript errors; add unit tests for CSV parsing utilities ([c3da941](https://github.com/cubicecho/philotes/commit/c3da941ce4478ff04dc94c97c67417f593aaeaf0))
* resolve drizzle migration conflicts and linearize snapshot chain ([5fa6767](https://github.com/cubicecho/philotes/commit/5fa6767b495ce1ee0990bffd0478d2ad64eb4c08))
* restore @vantreeseba/drizzle-graphql dependency (published ^1.0.1) ([7ba94cb](https://github.com/cubicecho/philotes/commit/7ba94cb51537f2445288a97463fbf0f344b742e5))
* revert to p-4 on cards, align header text to top ([22382f7](https://github.com/cubicecho/philotes/commit/22382f7328c99e7220ade1c1485eba36c3309357))
* server-side person search + relationship types as user-editable tags ([a5ec3d5](https://github.com/cubicecho/philotes/commit/a5ec3d5d6097d37893f9ca3544c65ceecadf8dc1))
* set card top padding to pt-3 ([204dee6](https://github.com/cubicecho/philotes/commit/204dee6cff663c9720f15930bc11b43c647e419e))


### Features

* add Add Task button to top action bar on person view ([6728c10](https://github.com/cubicecho/philotes/commit/6728c10652a60a81454d168e3d51a2c68bad8031))
* add tab nav to settings with Import subview; move nav links to right ([61d97fa](https://github.com/cubicecho/philotes/commit/61d97faa70d1b336efbe4d4f70c34867f1eca7f8))
* reorganize settings into Import/Export and App Settings tabs; move dark mode toggle to settings ([1a88670](https://github.com/cubicecho/philotes/commit/1a88670c9cc69219b89f0fd79ddf3dc23ee2456e))

# [1.6.0](https://github.com/vantreeseba/philotes/compare/v1.5.1...v1.6.0) (2026-05-05)


### Bug Fixes

* add padding between scroll content and scrollbar ([985c3ad](https://github.com/vantreeseba/philotes/commit/985c3ad6ebdd527239966dae66dd82c35d83f985))
* constrain all pages to viewport height with internal scroll ([2111fd6](https://github.com/vantreeseba/philotes/commit/2111fd6838347f45c031a9313b77f62a7e31679b))
* move Tasks and Address add buttons to card headers, match Tags style ([4df296d](https://github.com/vantreeseba/philotes/commit/4df296d890167435a6360f4953bfeb949be23e9f))
* person detail view always loaded first contact instead of selected one ([860f27c](https://github.com/vantreeseba/philotes/commit/860f27cce87aa476d1d3f680bcfb8dcb15be45ef))
* restore per-card add buttons, unify header layout to match Tags card style ([8b26577](https://github.com/vantreeseba/philotes/commit/8b26577423544aa5d2879265d4887f87d9ed1121))
* style scrollbars to match theme in light and dark mode ([b3f43b4](https://github.com/vantreeseba/philotes/commit/b3f43b453a15ecce65341530dcd9db46e07ea22d))
* switch to @vantreeseba/drizzle-graphql, resolve duplicate graphql instance ([74f8f62](https://github.com/vantreeseba/philotes/commit/74f8f62ccd069703ede4fffad0623211c5397aa0))


### Features

* add action button bar to top of person detail view ([8591895](https://github.com/vantreeseba/philotes/commit/8591895d39e3becf2958e6f0677778f2e6789234))
* add Dashboard nav link and dark mode toggle to header ([366ff6e](https://github.com/vantreeseba/philotes/commit/366ff6e75ef1772015abef304c40a30c0e426836))
* magic link auth + import email-less contacts from Google CSV ([a109875](https://github.com/vantreeseba/philotes/commit/a10987597ae6da934ba85031341bf9e4792b7678))

## [1.5.1](https://github.com/vantreeseba/philotes/compare/v1.5.0...v1.5.1) (2026-05-01)


### Bug Fixes

* SSL in production for Postgres, fix drizzle-orm 1.0 beta compat, restore correct input type names ([13decb2](https://github.com/vantreeseba/philotes/commit/13decb25867ec66cf494e728093d12e0123f1a4f))

# [1.5.0](https://github.com/vantreeseba/philotes/compare/v1.4.4...v1.5.0) (2026-05-01)


### Features

* support full PostgreSQL alongside PGlite via DATABASE_URL ([b985d98](https://github.com/vantreeseba/philotes/commit/b985d981104e56d58058c71f9e6d8479a73a60f9))

## [1.4.4](https://github.com/vantreeseba/philotes/compare/v1.4.3...v1.4.4) (2026-05-01)


### Bug Fixes

* revert wrong GraphQL input type renames, add missing radix dep, untrack tsbuildinfo ([e54fa91](https://github.com/vantreeseba/philotes/commit/e54fa91317ccf5936ded72628ed331f4cc3d1362))

## [1.4.3](https://github.com/vantreeseba/philotes/compare/v1.4.2...v1.4.3) (2026-05-01)


### Bug Fixes

* repair build after multi-tenant schema migration ([a291416](https://github.com/vantreeseba/philotes/commit/a29141656adad6810d145f9b1fb2951fec737c40))

## [1.4.2](https://github.com/vantreeseba/philotes/compare/v1.4.1...v1.4.2) (2026-05-01)


### Bug Fixes

* force release ([82c095d](https://github.com/vantreeseba/philotes/commit/82c095d6351d28ada2bef1f530230c0b9d2463f7))

## [1.4.1](https://github.com/vantreeseba/philotes/compare/v1.4.0...v1.4.1) (2026-03-12)


### Performance Improvements

* add 16 db indexes across all FK and sort columns ([e213644](https://github.com/vantreeseba/philotes/commit/e2136445654f041e0f493d8675d0fdf275ea9fa4))

# [1.4.0](https://github.com/vantreeseba/philotes/compare/v1.3.0...v1.4.0) (2026-03-12)


### Features

* move persons list search, sort, and pagination server-side ([b5bd1b7](https://github.com/vantreeseba/philotes/commit/b5bd1b7c3b60ac88bf0f04af5d0849f5262cfd97))

# [1.3.0](https://github.com/vantreeseba/philotes/compare/v1.2.3...v1.3.0) (2026-03-12)


### Features

* add person list sort controls (task 17) and per-person timeline view (task 18) ([a4c374c](https://github.com/vantreeseba/philotes/commit/a4c374c618924129070cc75685945499254560fc))

## [1.2.3](https://github.com/vantreeseba/philotes/compare/v1.2.2...v1.2.3) (2026-03-12)


### Bug Fixes

* load .env via preload module instead of --env-file flag for Docker compatibility ([e74d854](https://github.com/vantreeseba/philotes/commit/e74d854631b74d310a4655a14cb8e850b402fff6))

## [1.2.2](https://github.com/vantreeseba/philotes/compare/v1.2.1...v1.2.2) (2026-03-12)


### Bug Fixes

* **docker:** Make docker node version 24 for ts stuff. ([7f38c16](https://github.com/vantreeseba/philotes/commit/7f38c1609522bef59f46f0121552678da700eea5))

## [1.2.1](https://github.com/vantreeseba/philotes/compare/v1.2.0...v1.2.1) (2026-03-12)


### Bug Fixes

* resolve pgdata path using import.meta.url to prevent CWD-relative DB splits ([41106d0](https://github.com/vantreeseba/philotes/commit/41106d0937f138d02f7f89567cd9801b1bf5ac44))

# [1.2.0](https://github.com/vantreeseba/philotes/compare/v1.1.9...v1.2.0) (2026-03-09)


### Features

* extract drizzle-graphql vendor code into standalone package ([3b612f0](https://github.com/vantreeseba/philotes/commit/3b612f03fd6d1c45322a90b68ac9e42680c836cb))

## [1.1.9](https://github.com/vantreeseba/philotes/compare/v1.1.8...v1.1.9) (2026-03-09)


### Bug Fixes

* remove sticky positioning from ListLayout header/footer ([e0ee06f](https://github.com/vantreeseba/philotes/commit/e0ee06f82d9676c5fd6483941fe7640fb774caec))

## [1.1.8](https://github.com/vantreeseba/philotes/compare/v1.1.7...v1.1.8) (2026-03-09)


### Bug Fixes

* coerce null list relation fields to empty arrays ([b5b5ec9](https://github.com/vantreeseba/philotes/commit/b5b5ec9c9f33cb04d1a260f9ead6d47053c811fb))

## [1.1.7](https://github.com/vantreeseba/philotes/compare/v1.1.6...v1.1.7) (2026-03-09)


### Bug Fixes

* remove relation fields from createPerson mutation response ([354cde3](https://github.com/vantreeseba/philotes/commit/354cde33add80cf4f7bb996adf600e8850598422))

## [1.1.6](https://github.com/vantreeseba/philotes/compare/v1.1.5...v1.1.6) (2026-03-09)


### Bug Fixes

* pass firstMetDate as YYYY-MM-DD string, not Date object ([47a225f](https://github.com/vantreeseba/philotes/commit/47a225f14cc6c75532ee3d0bbcb9dc1c2ed1597e))
* remove new Date() wrapping from ImportantDate date inputs ([56c58cb](https://github.com/vantreeseba/philotes/commit/56c58cbede6a9b7003c20167972ade6443b883ab))

## [1.1.5](https://github.com/vantreeseba/philotes/compare/v1.1.4...v1.1.5) (2026-03-09)


### Bug Fixes

* use named wildcard route for Express 5 / path-to-regexp v8 compat ([00e17d6](https://github.com/vantreeseba/philotes/commit/00e17d67b1c639f881d133c68c4c709909f08521))

## [1.1.4](https://github.com/vantreeseba/philotes/compare/v1.1.3...v1.1.4) (2026-03-09)


### Bug Fixes

* commit routeTree.gen.ts and restore two-stage Dockerfile ([e9c7165](https://github.com/vantreeseba/philotes/commit/e9c7165fe2d07abd67943f5295e5445cd62779bb))

## [1.1.3](https://github.com/vantreeseba/philotes/compare/v1.1.2...v1.1.3) (2026-03-09)


### Bug Fixes

* trigger docker hub deployment ([f729a6f](https://github.com/vantreeseba/philotes/commit/f729a6f24e4869ec537d87a9f1abfb5e71de4cde))

## [1.1.2](https://github.com/vantreeseba/philotes/compare/v1.1.1...v1.1.2) (2026-03-09)


### Bug Fixes

* resolve build failures from resolver refactor and missing vendored dep ([e89349e](https://github.com/vantreeseba/philotes/commit/e89349e4f020cea4891115b13402e735ec4dad50))

## [1.1.1](https://github.com/vantreeseba/philotes/compare/v1.1.0...v1.1.1) (2026-03-09)


### Bug Fixes

* trigger docker hub deployment ([ef52a30](https://github.com/vantreeseba/philotes/commit/ef52a302795889663c954aed3b5ef0841268700d))

# [1.1.0](https://github.com/vantreeseba/philotes/compare/v1.0.0...v1.1.0) (2026-03-09)


### Features

* initial release ([5688e4a](https://github.com/vantreeseba/philotes/commit/5688e4a769567c719c45ddc278548ea0c021d819))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features

- 2-column person detail layout; merge DashboardLayout into ListLayout
- Paginate persons and tags lists with sticky header/footer layout
- Paginate all dashboard modules and switch to 2-column layout
- Persist person list filters and pagination in URL query string
- Person avatar with local file upload
- Person edit — update name/email/labels from detail page
- Person detail component skeleton with labels, notes, and tasks
- PersonActivities, PersonAddresses, PersonContactInfo sub-components in detail view
- Activities tracking per person
- Addresses per person
- Contact info per person
- Tasks/todos per person
- Notes with tags on person detail page
- Tags on important dates; rename labels to tags throughout the app UI
- Important date detail view with related notes
- Link date name on dashboard to its detail view
- Search and label filter on persons list
- Contact frequency and "don't lose touch" widget
- Dormant ties dashboard widget
- Recently Added dashboard widget
- Introductions panel, network graph, and note @-mentions
- Network graph: zoom and pan
- Network graph: full name on nodes, always-visible relationship labels on edges
- Network graph: improved layout — spacing, edge pills, name halos, arrowheads, rotation
- Interaction log
- Pre-contact brief panel on person detail page
- Life milestones and "how we met" fields on persons and important dates
- Weekly review route
- Move upcoming-dates recurrence logic to server-side resolver
- Deserialize DateTime/Date scalars to JS Date objects in Apollo Client
- Use DateTime and Date scalars for timestamp/date columns
- Dockerfile and Docker Hub deployment instructions in README
- Seed and cleanup scripts with Faker data
- Switch to shadcn form with TanStack Form

### Bug Fixes

- Use timezone-safe parsing for Date scalar type policy
- Use RAW callbacks for where/orderBy in relational queries to prevent malformed SQL aliases
- Pass aliased table to orderBy callback in relational queries
- Add explicit `from`/`to` config to new relations to prevent malformed SQL aliases
- Use direct table ref for sub-relation `where` clause; remove debug logs
- White edge label text on dark pill; remove directional arrowheads
- Wire LabelList (with pagination) to `/tags` route
- Remove stale `person-detail.tsx` dead code

### Refactoring

- Extract avatar and GraphQL routes into `server/src/routes/`
- Split `schema.ts` resolvers into `server/src/resolvers/`
- Consolidate GraphQL filter input types to generic shared types
- Flatten GraphQL relation types to base model types
- Convert AddTaskForm to `useAppForm`+`AppField` pattern

### CI

- Add semantic-release and Docker Hub deployment workflow
- Add changelog generation to semantic-release (`@semantic-release/changelog`, `@semantic-release/git`)

### Documentation

- Add research background section to README
- Add screenshots to README
- Add worktree setup instructions to AGENTS.md
- Add feature backlog for tasks A, F, H
