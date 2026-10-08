# [5.6.0](https://github.com/cubicecho/philotes/compare/v5.5.0...v5.6.0) (2026-10-08)


### Bug Fixes

* **app:** order lists by their name, not by the id tiebreak ([21caf0e](https://github.com/cubicecho/philotes/commit/21caf0e54007bd379f3d5441f8e6d42c19a79d35)), closes [#32](https://github.com/cubicecho/philotes/issues/32)


### Features

* **app:** lay the app out for a phone ([cb6fe93](https://github.com/cubicecho/philotes/commit/cb6fe935494bbddfc91fcf9fc6d031852f3429b0)), closes [#32](https://github.com/cubicecho/philotes/issues/32)

# [5.5.0](https://github.com/cubicecho/philotes/compare/v5.4.0...v5.5.0) (2026-10-08)


### Features

* **app:** sign in and show photos on a device ([c335776](https://github.com/cubicecho/philotes/commit/c3357768e10e779fd59201dc43097291febcc343)), closes [#32](https://github.com/cubicecho/philotes/issues/32)

# [5.4.0](https://github.com/cubicecho/philotes/compare/v5.3.0...v5.4.0) (2026-10-08)


### Features

* **app:** configure the Android development build ([afa9bcd](https://github.com/cubicecho/philotes/commit/afa9bcdbbb9b86eb6ab6c0d464040cfeced7a92e)), closes [cubicecho/cubeui#316](https://github.com/cubicecho/cubeui/issues/316) [#32](https://github.com/cubicecho/philotes/issues/32)

# [5.3.0](https://github.com/cubicecho/philotes/compare/v5.2.0...v5.3.0) (2026-10-08)


### Features

* serve people as a CardDAV address book ([2c13fdf](https://github.com/cubicecho/philotes/commit/2c13fdfa19bb61fbf392938a583631867c2ae8b3)), closes [#31](https://github.com/cubicecho/philotes/issues/31)

# [5.2.0](https://github.com/cubicecho/philotes/compare/v5.1.0...v5.2.0) (2026-10-07)


### Features

* read and write vCards, with import and export in Settings ([5412a17](https://github.com/cubicecho/philotes/commit/5412a17ee51314b4fe507e4a21aa10dfd71c5a88)), closes [#31](https://github.com/cubicecho/philotes/issues/31)

# [5.1.0](https://github.com/cubicecho/philotes/compare/v5.0.0...v5.1.0) (2026-10-07)


### Features

* number every change to a user's people ([4e1f2fd](https://github.com/cubicecho/philotes/commit/4e1f2fd5ca6684b2d563c623b2c4197f2b500560)), closes [#31](https://github.com/cubicecho/philotes/issues/31)

# [5.0.0](https://github.com/cubicecho/philotes/compare/v4.0.0...v5.0.0) (2026-10-07)


* feat!: let a person hold what a phone contact holds ([3926ac2](https://github.com/cubicecho/philotes/commit/3926ac2369de7b15e286cd8355ebf28f6ad02d40)), closes [#30](https://github.com/cubicecho/philotes/issues/30)
* feat!: show and edit the phone contact fields in the app ([aa4d351](https://github.com/cubicecho/philotes/commit/aa4d35142e39cb5e03f6ea5ab3813d9186215fed)), closes [#30](https://github.com/cubicecho/philotes/issues/30)


### BREAKING CHANGES

* the app needs a server with the phone contact fields.
* the mobile contact type is gone; such a row is a phone of
kind mobile. Person.firstName and Person.lastName are nullable.
personFirstName and personLastName on an upcoming date are replaced by
personDisplayName, and relatedPersonFirstName and relatedPersonLastName on
a relationship by relatedPersonDisplayName.

# [4.0.0](https://github.com/cubicecho/philotes/compare/v3.2.1...v4.0.0) (2026-10-07)


* feat!: give each user their own person rows ([491af2c](https://github.com/cubicecho/philotes/commit/491af2c9e2b1bf1431c1d9774ce70e8721d5cb5e)), closes [#29](https://github.com/cubicecho/philotes/issues/29)


### Bug Fixes

* **server:** stop charging query cost for __typename ([12cb479](https://github.com/cubicecho/philotes/commit/12cb4796185cc5e58698f2695f944f318db6ea0f)), closes [#29](https://github.com/cubicecho/philotes/issues/29)


### BREAKING CHANGES

* Person.email, the UserPerson type, updateMyPersonContext
and the link-on-email-collision behaviour of createPerson are gone. Persons
that no user had in their contacts are deleted by the migration, along with
rows a user had left on a person they had removed.

## [3.2.1](https://github.com/cubicecho/philotes/compare/v3.2.0...v3.2.1) (2026-10-07)


### Bug Fixes

* **db:** close the connection so the seed and cleanup scripts exit ([54a354d](https://github.com/cubicecho/philotes/commit/54a354dbdfb7aa330c296308da453ff8b848e1c2))

# [3.2.0](https://github.com/cubicecho/philotes/compare/v3.1.5...v3.2.0) (2026-10-07)


### Features

* **avatars:** keep avatar images in an S3-compatible store such as MinIO ([c4fff20](https://github.com/cubicecho/philotes/commit/c4fff201efc9797a718640f4220966fac5f8eb14))

## [3.1.5](https://github.com/cubicecho/philotes/compare/v3.1.4...v3.1.5) (2026-10-07)


### Bug Fixes

* **server:** no way to take a person by id alone ([7da771f](https://github.com/cubicecho/philotes/commit/7da771fcc10b785969503c8283f8d33178a93e6d)), closes [#11](https://github.com/cubicecho/philotes/issues/11)

## [3.1.4](https://github.com/cubicecho/philotes/compare/v3.1.3...v3.1.4) (2026-10-07)


### Bug Fixes

* four small correctness items ([c3cb554](https://github.com/cubicecho/philotes/commit/c3cb55482e2a86eda60297c09e2854d6233bafa9)), closes [#16](https://github.com/cubicecho/philotes/issues/16)

## [3.1.3](https://github.com/cubicecho/philotes/compare/v3.1.2...v3.1.3) (2026-10-07)


### Bug Fixes

* **server:** unlink, not delete, in deletePersons; link in createPersons ([0bee095](https://github.com/cubicecho/philotes/commit/0bee09505f7cea4f16454fabf5362c701720882c)), closes [#10](https://github.com/cubicecho/philotes/issues/10)

## [3.1.2](https://github.com/cubicecho/philotes/compare/v3.1.1...v3.1.2) (2026-10-07)


### Bug Fixes

* **app:** use each date's own recurrence in the pre-contact brief ([7c07cac](https://github.com/cubicecho/philotes/commit/7c07cac655e2457434d0c4a0e40350c8707e5300)), closes [#13](https://github.com/cubicecho/philotes/issues/13)
* **server:** read the second address line on Google CSV import ([c7392a4](https://github.com/cubicecho/philotes/commit/c7392a4457e5918bc1f7261521dfe9e121b501b0)), closes [#14](https://github.com/cubicecho/philotes/issues/14)

## [3.1.1](https://github.com/cubicecho/philotes/compare/v3.1.0...v3.1.1) (2026-10-07)


### Bug Fixes

* **server:** write the validated input in updateMyPersonContext ([3a3fae3](https://github.com/cubicecho/philotes/commit/3a3fae39e8e9add5bc2a83ed27c552808af3d137)), closes [#12](https://github.com/cubicecho/philotes/issues/12)

# [3.1.0](https://github.com/cubicecho/philotes/compare/v3.0.0...v3.1.0) (2026-10-07)


### Features

* find and merge duplicate people ([356b2ee](https://github.com/cubicecho/philotes/commit/356b2ee427d5644ff9aa6488f3eb8895ded7ce2d))
* log an interaction from the people list ([3275992](https://github.com/cubicecho/philotes/commit/32759921146fcd02847f3931b5cfa865a0983f81))
* record gratitudes on a person ([608aacd](https://github.com/cubicecho/philotes/commit/608aacd8af1af89825cacf051cd9a15ea061f482))
* tag other people on an important date ([874684b](https://github.com/cubicecho/philotes/commit/874684b6d6d4c732272ee62c014e9395eceed367))

# [3.0.0](https://github.com/cubicecho/philotes/compare/v2.1.0...v3.0.0) (2026-10-07)


* build!: ship the standard image, compose stack, CI and release on port 3000 ([e668c7f](https://github.com/cubicecho/philotes/commit/e668c7f212ea42a34d87007cfdf988d9c690a672))
* feat(auth)!: sign in through better-auth, with sessions, passwords and API keys ([1399ac9](https://github.com/cubicecho/philotes/commit/1399ac9daa20f87c726577adf818042f19f5f479))
* feat(db)!: bring every table to the schema conventions ([eddb53d](https://github.com/cubicecho/philotes/commit/eddb53dde0ed1745f69d5296696d073f14f7b1c1))
* feat(db)!: make Postgres the only database and wait for it at boot ([40caafe](https://github.com/cubicecho/philotes/commit/40caafe7d3850443debcb1992d2362daf4c05245))
* feat(server)!: bound every GraphQL operation and move to drizzle-graphql 13 ([183e162](https://github.com/cubicecho/philotes/commit/183e162517e4181f4cacee0db7d32a26dd30dbf5))
* refactor(server)!: serve GraphQL with graphql-yoga from createApp(deps) ([992f700](https://github.com/cubicecho/philotes/commit/992f70009874205a5a62a8488c89ee848ddc2ea4))


### Bug Fixes

* **app:** correct date maths and display, interaction tag edits, exports, import preview and mentions ([621f83a](https://github.com/cubicecho/philotes/commit/621f83a569804e219ae72bea422a21eed86e766d))
* **app:** export birthdays and important dates on the right day ([11b38d0](https://github.com/cubicecho/philotes/commit/11b38d0c84b32f7567ace2b59908f83c0edb7547))
* **app:** give a person one colour and a channel one icon everywhere ([28229b1](https://github.com/cubicecho/philotes/commit/28229b129d71458087b6e19bfa3488d335817f6e))
* **app:** refetch the lists a mutation makes stale ([3212088](https://github.com/cubicecho/philotes/commit/321208857ab36642ae9cc95f9f9f67c4124465aa))
* **app:** show loading and failure in the API key and export cards ([12df701](https://github.com/cubicecho/philotes/commit/12df701eefbd1a45f4a40103318565c9c2baa560))
* **app:** show uploaded avatars and report a failed upload ([3d379e4](https://github.com/cubicecho/philotes/commit/3d379e4cdf5cefc9e5318cc21b35140fe7927263))
* **docker:** keep .env files out of the build context ([50cc402](https://github.com/cubicecho/philotes/commit/50cc40234e0d5e5c47c405fdac1e691ca691a2dd))
* point the server clean script and the graphqlsp plugin at server/__generated__ ([df093bc](https://github.com/cubicecho/philotes/commit/df093bc8b34700acf5b37a54c0186d39e023fd64))
* **server:** answer 'not found' when revoking another user's API key ([c1057d5](https://github.com/cubicecho/philotes/commit/c1057d5d0cb19b55cb64d377847d54fb65f988b8))
* **server:** authorise an avatar upload before the file is written ([c5b3246](https://github.com/cubicecho/philotes/commit/c5b3246aeb1bd01a3acbeeedcafb75fd957ff0b4))
* **server:** clamp month-end occurrences, return one person from deletePerson and count skipped import rows ([989af6c](https://github.com/cubicecho/philotes/commit/989af6c80390aa2e08af1974260b34b9d9d872af))
* **server:** keep contact import to the importing user's own rows ([e95c077](https://github.com/cubicecho/philotes/commit/e95c077d13621d20b6ed6ad050062727626c9ec3))
* **server:** keep the owner on person-label rows when merging labels ([fe749db](https://github.com/cubicecho/philotes/commit/fe749dbc24c6cbbafbf394bfa43003848263998a))


### Features

* **app:** ask before deleting a note, task, interaction, date, label, type or key ([465b89b](https://github.com/cubicecho/philotes/commit/465b89ba1d64ce4b08d3d6b03b0ef2e3f688b8e4))
* **server:** validate every generated write and check the rows it points at ([0391a00](https://github.com/cubicecho/philotes/commit/0391a00c50341aef5284e53e153eac6358a48920))


### BREAKING CHANGES

* the junction tables require user_id. The migration
fills it from the parent row. Existing timestamps without a zone are
read as UTC, and rows that had no created_at take the migration time.
* the server listens on port 3000 by default, not 3001, and the
Expo dev server moves to 8081. The compose stack keeps avatars in the
philotes_data volume, not philotes_avatars.
* BETTER_AUTH_SECRET replaces JWT_SECRET. Every user signs in
again, and has to create a password or use a sign-in link. Existing API keys
are dropped with the api_keys table and must be created again. The
requestMagicLink mutation is gone, and verifyMagicLink returns
{ token, user } in place of { token, userId }.
* drizzle-graphql 13 renames the generated mutations.
updateX and deleteX now change one row and return it; the bulk forms are
updateXs and deleteXs. updateXSingle and deleteXSingle are gone. A list
query without a limit returns 50 rows, and a limit over 500 is refused
with DRIZZLE_LIMIT_EXCEEDED. upcomingDates is capped the same way.
* the embedded PGlite database is gone. DATABASE_URL is
required and must be a postgres:// URL; data under /data/pgdata is not
migrated. docker-compose.yml now starts Postgres beside the app, and
docker-compose.postgres.yml is removed.
* unexpected resolver errors are now masked as
"Unexpected error."; errors thrown on purpose keep their message and code.
Browsers on an origin other than APP_URL are no longer allowed by CORS.

# [2.1.0](https://github.com/cubicecho/philotes/compare/v2.0.1...v2.1.0) (2026-10-07)


### Features

* **app:** vendor the cubeui native primitives and shells ([32f3804](https://github.com/cubicecho/philotes/commit/32f380417a1239907752014015db46dd9be88610))

## [2.0.1](https://github.com/cubicecho/philotes/compare/v2.0.0...v2.0.1) (2026-08-31)


### Bug Fixes

* get `npm run check` green ([c89b5cf](https://github.com/cubicecho/philotes/commit/c89b5cf7060251b0fd34b29b8a49bc90367dfc59))

# [2.0.0](https://github.com/cubicecho/philotes/compare/v1.9.0...v2.0.0) (2026-08-30)


* chore(deps)!: drizzle-orm 1.0.0-rc.4 and @vantreeseba/drizzle-graphql 9 ([f6eab5f](https://github.com/cubicecho/philotes/commit/f6eab5fcd29b6da0c081a6edafb97b08df80d81b))


### Bug Fixes

* **server:** close tenant-isolation holes by delegating to generated resolvers ([aef35de](https://github.com/cubicecho/philotes/commit/aef35de7dd55c130a644ef2755767fe008e0a6cc))


### Features

* upgrade @vantreeseba/drizzle-graphql from 1.0.1 to 4.1.0 ([da86356](https://github.com/cubicecho/philotes/commit/da863565442bc7ee6072d6de4c4332dcad8178d3))


### BREAKING CHANGES

* AddressesTypeEnum is now AddressTypeEnum and
ContactInfosTypeEnum is now ContactTypeEnum. The `${Type}FilterOr` /
`${Table}FiltersOr` input types are gone — an OR branch takes the filter type
itself, and now composes with sibling fields by an implicit AND rather than
being rejected.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VozQrDNF9PgwGkAk3VArab

# [1.9.0](https://github.com/cubicecho/philotes/compare/v1.8.0...v1.9.0) (2026-07-05)


### Bug Fixes

* broken reach-out links, duplicated relative-time helpers, pgdata path under --preserve-symlinks ([4c570e9](https://github.com/cubicecho/philotes/commit/4c570e9e7ea0e6f9ca237a72e5e128819bf3b771))
* dark mode — person names and other links rendered near-black ([51a9239](https://github.com/cubicecho/philotes/commit/51a9239cfbd611790cf8809402b7e080e4f4dc8f))


### Features

* dashboard — 4 widgets, one query, quick-log, no per-widget pagination ([37cac78](https://github.com/cubicecho/philotes/commit/37cac78441d129467735fcc90a681b75807814a2))
* design tokens — Inter variable font, warm accent color, LabelChip component ([43ceac6](https://github.com/cubicecho/philotes/commit/43ceac6635826455636a09f7b4872ad1c554b3de))
* labels page — chip-preview rows, no pagination ([7fe9874](https://github.com/cubicecho/philotes/commit/7fe9874f022b4c999e9ef4b146013d4e5c21d407))
* navigation — active states, Network link, mobile bottom tabs + FAB ([8251e0c](https://github.com/cubicecho/philotes/commit/8251e0cda4c2741ef5229a019c382e697000b5d7))
* people list — alphabetical grouped list replaces pagination ([9790f52](https://github.com/cubicecho/philotes/commit/9790f52cd46a5394a034ad15386e6209373ea345))
* person detail — profile header with contact actions, auto-height sections ([2929d63](https://github.com/cubicecho/philotes/commit/2929d63785e26344b1daa45bacf25079669b0f87))
* remove the activities concept — interactions cover it ([86e9e71](https://github.com/cubicecho/philotes/commit/86e9e71fdf1842cedcac732eade601666302f3f5))
* unify terminology — /tags route becomes /labels, user copy says Label ([f12eb35](https://github.com/cubicecho/philotes/commit/f12eb355134e068598bfa95c46f11eca9c039e4b))

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
