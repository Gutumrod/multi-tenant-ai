# WU-6 Claims → Evidence Map / แผนที่คำกล่าวอ้าง → หลักฐาน WU-6

Every factual claim made in `docs/product/WU6-SALES-EN.md` and
`docs/product/WU6-SALES-TH.md`, one row each, with the evidence that supports
it: the exact file, command or observation, and where the controller's own evidence
for it lives. A reviewer can check the sales copy against reality row by row.

คำกล่าวอ้างเชิงข้อเท็จจริงทุกข้อใน `docs/product/WU6-SALES-EN.md` และ
`docs/product/WU6-SALES-TH.md` หนึ่งแถวต่อหนึ่งข้อ พร้อมหลักฐานที่รองรับ: ไฟล์ คำสั่ง
หรือข้อสังเกตที่แน่นอน และที่อยู่ของหลักฐานฝั่งผู้คุม ผู้ตรวจสามารถเทียบข้อความขายกับ
ความจริงได้ทีละแถว

Evidence locations used in the table / ที่อ้างอิงหลักฐานที่ใช้ในตาราง:

The four labels below name the AUTHOR's evidence locations. They are the vendor's
internal evidence locations and are **not part of the delivered folder**: nothing a
buyer receives contains these files, and no path here is one a buyer can open. Each
label names the file so a reviewer can ask the controller for it by name; the
absolute machine paths are deliberately not written down (the directory prefixes
were removed in H7-REVIEW-FIX-HYGIENE), because an absolute path on the vendor's
machine is not evidence a buyer can use.

ที่อ้างอิงทั้งสี่ด้านล่างนี้คือ**ที่อยู่หลักฐานฝั่งผู้คุม (internal)** ไม่ได้อยู่ในโฟลเดอร์ที่ส่งมอบ
ผู้ซื้อจะไม่ได้รับไฟล์เหล่านี้ และไม่มีพาธใดที่ผู้ซื้อเปิดได้ แต่ละป้ายระบุชื่อไฟล์เพื่อให้ผู้ตรวจ
เรียกขอจากผู้คุมได้ตามชื่อ ส่วนพาธเครื่องแบบเต็มตั้งใจไม่เขียนไว้ (ตัดคำนำหน้าออกใน
H7-REVIEW-FIX-HYGIENE) เพราะพาธบนเครื่องของผู้คุมไม่ใช่หลักฐานที่ผู้ซื้อใช้ได้

- **WT** — the worktree this document set was written in
  (`server/`, `web/`, `modules/`, `docs/` below are all inside it).
- **CG(n)** — controller gate log, vendor-internal, under the vendor's report tree:
  `06-Agent-Logs/WSTERA-House/reports/evidence/house-swarm-7-wu<n>-commander-gates.log`
- **RPT(n)** — controller report, vendor-internal:
  `06-Agent-Logs/WSTERA-House/reports/REPORT-HOUSE-SWARM-7-WU<n>-2026-09-28.md`
- **WU6-RUN** — measured by the author of this document during WU-6, on the worktree,
  with the raw output reported in the vendor-internal
  `REPORT-HOUSE-SWARM-7-WU6-2026-09-28.md` / วัดโดยผู้เขียนเอกสารนี้ระหว่าง WU-6
  บน worktree โดยผลดิบอยู่ในรายงาน WU-6 (vendor-internal)

---

## 1. Product and positioning / ผลิตภัณฑ์และการวางตำแหน่ง

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C1 | It is an Express reference server written in TypeScript. / เป็น Express reference server เขียนด้วย TypeScript | WT `server/src/app.ts` (creates the Express app and registers the routes), `server/package.json` `"type": "module"` and dependency `express`. File count: `find server/src -name '*.ts' │ wc -l` → 17. / WT `server/src/app.ts`, `server/package.json` |
| C2 | It keeps tenants, plans, subscriptions and a billing-event ledger in a real database. / เก็บ tenant/แพ็กเกจ/subscription/ledger ในฐานข้อมูลจริง | WT `server/migrations/0001_persistence.sql` creates `tenants`, `plans`, `subscriptions`, `billing_event_ledger`; WT `server/src/lib/persistence/pg-repositories.ts` is the Postgres repository layer. CG(2) run G5 (`db-proof.mjs`) → `CHECK write-then-read-back PASS account_id=proof_account_… rows=1` and `CHECK subscription-row-survives-reconnect PASS`. / WT + CG(2) G5 |
| C3 | It applies its own two SQL migrations at start-up, before the port opens. / รัน migration สองไฟล์ตอนสตาร์ท ก่อนเปิดพอร์ต | WT `server/src/index.ts`: `await initSubscriptionRepositories()` precedes `app.listen(port, …)`. WT `server/migrations/` contains exactly `0001_persistence.sql` and `0002_usage.sql`. CG(5) R8 item 4 records the necessity argument (app.ts contains no migration call). / WT `server/src/index.ts` |
| C4 | It serves a five-page sample UI in Thai and English from the same server. / เสิร์ฟหน้าเว็บตัวอย่างห้าหน้า ไทย/อังกฤษจากเซิร์ฟเวอร์เดียวกัน | WT `server/src/lib/web-pages.ts` `PAGE_FILES = ['index.html','signup.html','login.html','plans.html','app.html']`; `web/*.html` = 5 files. CG(4) `CHECK dictionary-key-sets-identical PASS locales=th,en`; CG(4) `SUMMARY checks=9 passed=9` from `e2e-web.mjs` driving the real app over HTTP. / CG(4), WU4-SAMPLE-UI.md |
| C5 | It enforces a paid-resource quota inside the database before spending money on a provider. / บังคับโควตาในฐานข้อมูลก่อนเสียเงินกับผู้ให้บริการ | WT `server/src/lib/quota.ts` (`quotaGate`, `assertAndConsumeQuota`) + WT `server/src/lib/persistence/pg-repositories.ts` single-statement increment. CG(3) R2 DB-backed proof 6/6 PASS; CG(3) `CHECK over-quota-is-refused-before-provider PASS … provider_fetch_attempts=0`. / CG(3) |
| C6 | It ships the proof harnesses that produced every number in the document set. / แถม harness พิสูจน์ที่ให้ตัวเลขทุกตัว | WT `server/scripts/proofs/wu2/db-proof.mjs`, `wu2/migrate-runner-proof.mts`, `wu3/quota-proof.mjs`, `wu4/i18n-parity.mjs`, `wu4/e2e-web.mjs`, `wu5/deploy-preflight.mjs`, `wu6/claims-check.mjs` — all present in WT and all cited by path in the documents. / WT |
| C7 | It is a reference implementation plus evidence — not a hosted service, not a finished product, not a deployment. / เป็น implementation + หลักฐาน ไม่ใช่บริการ ไม่ใช่สินค้าสำเร็จ ไม่ใช่ deploy | WT contains no `Dockerfile`, no compose file, no reverse-proxy config; `docs/product/WU5-DEPLOY.md` §1 states no deployment was performed; CG(5) `CHECK wu5-no-docker-or-cloud-config-added PASS`. / CG(5) R9 |
| C8 | It is for a backend engineer or technical founder, judged by running it. / ทำเพื่อวิศวกร/ผู้ก่อตั้งสายเทคนิค ตัดสินด้วยการรัน | Editorial positioning, not a measurable claim: it asserts nothing about the product's behaviour or contents, so it needs no behavioural evidence. It is deliberately kept free of any performance, scale or customer claim. / editorial, no evidence required |

## 2. The repository contents / เนื้อหาในที่เก็บโค้ด

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C9 | R1 — `server/src` holds 17 TypeScript files. / `server/src` มีไฟล์ TypeScript 17 ไฟล์ | `find server/src -name '*.ts' │ wc -l` → `17`, run on WT (WU6-RUN). / WU6-RUN |
| C10 | R2 — exactly two SQL files, named `0001_persistence.sql` and `0002_usage.sql`. / ไฟล์ SQL สองไฟล์เท่านั้น | `ls server/migrations` → `0001_persistence.sql`, `0002_usage.sql`; `ls server/migrations/*.sql │ wc -l` → `2`, on WT (WU6-RUN). CG(5) `CHECK migration-set-listed PASS the manual names all 2 migration files`. / WU6-RUN, CG(5) R1 |
| C11 | R3 — six test files. / ไฟล์เทสต์หกไฟล์ | `ls server/tests` → `demo-auth-gate.test.ts`, `postgres-persistence.test.ts`, `quota-enforcement.test.ts`, `server.test.ts`, `webhook-rate-limit.test.ts`, `webhook.test.ts` = 6, on WT (WU6-RUN, corrected in H7-FU-RATELIMIT-REPAIR7 after `webhook-rate-limit.test.ts` was added by H7-FU-RATELIMIT). Consistent with the six-file vitest summary line the suite reports, and with `docs/product/WU5-DEPLOY.md` §6.1 ("`server/tests/` holds six test files"). The earlier form of this row said five, which is superseded. / WU6-RUN |
| C12 | R3 — exactly three runtime dependencies: `express`, `pg`, `@supabase/supabase-js`. / runtime dependency สามตัวเท่านั้น | WT `server/package.json` `"dependencies"` block lists exactly those three. Asserted independently by `docs/product/WU5-DEPLOY.md` §3.2 and cross-checked by CG(5) `CHECK env-example-covers-manual-variables PASS`. / WT `server/package.json` |
| C13 | R4 — seven modules, named. / โมดูลเจ็ดตัว มีชื่อระบุ | `ls modules` → `ai-provider`, `auth-supabase`, `enterprise-features`, `payment`, `subscription`, `tenant-context`, `webhook-receiver`; `ls -d modules/*/ │ wc -l` → `7`, on WT (WU6-RUN). / WU6-RUN |
| C14 | R5 — five sample pages and four asset files. / หน้าตัวอย่างห้าหน้า และ asset สี่ไฟล์ | `ls web/*.html │ wc -l` → `5`; `ls web/assets` → `app.css`, `app.js`, `i18n.d.ts`, `i18n.js` = 4, on WT (WU6-RUN). CG(5) `CHECK web-assets-present PASS all 8 sample UI files are present`. / WU6-RUN, CG(5) R1 |
| C15 | R6 — `scripts/house-swarm-7/` holds `setup.sh`, `setup.md`, `db-check.mjs`. / มีสามไฟล์นี้ | `ls scripts/house-swarm-7` → those three files, on WT (WU6-RUN). CG(5) R2 exercises `setup.sh` for real (four cases, exit codes captured). / WU6-RUN, CG(5) R2 |
| C16 | R7 — proof harnesses for WU-2 to WU-6 and ten saved HTML pages under `wu4-e2e/`. / harness ของ WU-2 ถึง WU-6 และหน้า HTML สิบไฟล์ | `ls server/scripts/proofs/` → `wu2 wu3 wu4 wu5 wu6`; `ls server/scripts/proofs/wu4/wu4-e2e/*.html │ wc -l` → `10` (5 pages × th/en), on WT (WU6-RUN). CG(4) G8 recorded the same 10 files. / WU6-RUN, CG(4) |
| C17 | The tree also holds the operating documents under `docs/product/` (`WU3-PAID-ROUTE-INVENTORY.md`, `WU4-SAMPLE-UI.md`, `WU5-DEPLOY.md`, this document set), `BRIEF.md`, `STAGE3_EVIDENCE_REPORT.md`. / ทรีมีไฟล์เหล่านี้ด้วย | All named files exist in WT under the delivered `docs/product/` folder; `ls docs/product` lists the six buyer-facing documents — the three WU operating documents, this ledger, and the two WU-6 sales documents. The vendor's working-record folder, `house-swarm-7`, now holds only the vendor's own papers (`FU-*.md` and `PRESALE-CLEANUP-P*.md`), not these delivered documents. / WT |

## 3. Measured behaviours / พฤติกรรมที่วัดได้จริง

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C18 | B1 — the six resulting tables are `billing_event_ledger`, `plans`, `schema_migrations`, `subscriptions`, `tenants`, `usage_counters`. / ตารางหกตารางตามรายชื่อ | WU6-RUN: `DATABASE_URL=… npx tsx scripts/proofs/wu2/migrate-runner-proof.mts` printed `OBSERVATION tables=["billing_event_ledger","plans","schema_migrations","subscriptions","tenants","usage_counters"]`, exit 0. Independently: `scripts/house-swarm-7/db-check.mjs` printed `CHECK migration-tables PASS all 6 expected tables present`, exit 0. / WU6-RUN |
| C19 | B1 — starting the server a second time applies nothing and prints no error. / สตาร์ทครั้งที่สองไม่ทำอะไรเพิ่ม | WU6-RUN: the migration runner's run2 and run3 both printed `applied=[] skipped=[0001_persistence,0002_usage]` and `migration_runner_idempotent=true`, exit 0. Also `db-check.mjs` → `CHECK migration-tables PASS` on an already-migrated database. / WU6-RUN |
| C20 | B2 — `migrate-runner-proof.mts` runs the real runner three times, reads `schema_migrations` back, creates a subscription through the core, reads the row back, prints `migration_runner_idempotent=true`, exits 0. / สคริปต์นี้ทำตามที่ระบุและออกด้วย 0 | WU6-RUN raw output: three `OBSERVATION run…` lines, `OBSERVATION schema_migrations_versions=["0001_persistence","0002_usage"]`, `OBSERVATION core_backed_by_postgres rows_in_db=1 row={"account_id":"wireproof_account","plan_id":"pro","status":"active"} core_reads_back={…}`, `OBSERVATION migration_runner_idempotent=true`, exit 0. Controller-side acknowledgement of the repair: RPT(5) §4.1. / WU6-RUN, RPT(5) §4.1 |
| C21 | B3 — the increment is a single statement with `RETURNING`, with no read-then-write and no SELECT first. / คำสั่งเดียว มี RETURNING ไม่มีอ่านก่อนเขียน | CG(3) `CHECK usage-counter-is-single-statement PASS query_statements_in_increment=1 has_ON_CONFLICT=true has_DO_UPDATE=true has_RETURNING=true contains_SELECT=false reads_counter_first=false`. Source: WT `server/src/lib/persistence/pg-repositories.ts`, `async increment(`. / CG(3) |
| C22 | B3 — sixteen concurrent increments from two independent pools produced sixteen distinct values and a final counter of 16. / 16 concurrent ให้ค่าแตกต่าง 16 ค่า และตัวนับสุดท้าย 16 | CG(3) `CHECK concurrent-increments-are-atomic PASS increments_fired=16 distinct_values_returned=16 final_counter=16 expected_final=16 returned_values=[1..16]`. / CG(3) |
| C23 | B4 — an account with no subscription gets 402 `QUOTA_NOT_ENTITLED` over real HTTP. / บัญชีไม่มี subscription ได้ 402 QUOTA_NOT_ENTITLED | CG(4) `CHECK unentitled-shows-the-real-402-shape PASS request=POST /ai/demo for an account with no subscription (subscription_rows=0) response_status=402 response_code=QUOTA_NOT_ENTITLED`. Also WT `server/tests/quota-enforcement.test.ts:122,235`. / CG(4) |
| C24 | B5 — an account at its plan limit gets 429 `QUOTA_EXCEEDED`. / บัญชีถึงลิมิตได้ 429 QUOTA_EXCEEDED | CG(4) `CHECK over-quota-shows-the-real-429-shape PASS … response_status=429 response_code=QUOTA_EXCEEDED response_limit=50 response_usage=50`. / CG(4) |
| C25 | B5 — the provider was never called; the harness recorded `provider_fetch_attempts=0`, and a refusal does not consume. / ผู้ให้บริการไม่ถูกเรียก provider_fetch_attempts=0 และการปฏิเสธไม่กินโควตา | CG(3) `CHECK over-quota-is-refused-before-provider PASS http_status=429 … provider_fetch_attempts=0 counter_after_refusal=50 (seed_usage=50)`. The harness blocks real egress with a fetch stub, so an attempt would be counted and would throw. / CG(3) |
| C26 | B6 — the counter went `0 -> 1 -> 2` over two successful calls. / ตัวนับเป็น 0 -> 1 -> 2 | CG(4) G7 (commander-side consume proof): `counter_before=0`, `call1_status=200 call1_provider_calls=1 call1_usage_field=1`, `counter_after_call1=1`, `counter_after_call2=2`, `SUCCESSFUL_AI_CALL_CONSUMES_EXACTLY_ONE=PASS`. Script preserved at `…/wu4/commander-evidence/zz-cmdr-consume-proof.mts`. / CG(4) G7, RPT(4) §7 |
| C27 | B6 — a call whose provider returned an error left the counter unchanged. / การเรียกที่ provider ตอบผิดพลาด ตัวนับไม่ขยับ | CG(4) G7: `call3 (provider returns 500) status=200 counter_after_failed_call=2` with `FAILED_AI_CALL_DOES_NOT_CONSUME=PASS`. Also CG(3) `CHECK failed-paid-call-does-not-consume PASS provider_fetch_attempts=1 … counter_after_failure=0`. / CG(4) G7, CG(3) |
| C28 | B7 — the dictionary carries 124 keys per language and the two key sets are identical. / 124 คีย์ต่อภาษา และชุดคีย์เหมือนกัน | WU6-RUN: `node scripts/proofs/wu4/i18n-parity.mjs` → `CHECK dictionary-key-sets-identical PASS locales=th,en keys_per_locale=th:124 en:124 identical_sets=true missing_from_en=[] missing_from_th=[]`, `SUMMARY checks=8 passed=8 failed=0`, exit 0. / WU6-RUN, CG(4) |
| C29 | B7 — no CDN, no web font, no stock image, no new UI framework. / ไม่มี CDN ไม่มีเว็บฟอนต์ ไม่มีภาพสต็อก ไม่เพิ่ม UI framework | WU6-RUN: `CHECK no-external-or-stock-photo-references PASS files_checked=8 external_hits=0`. And an image-file sweep of WT (`*.png/jpg/jpeg/gif/webp`) → 0 files. And `server/package.json` adds no UI dependency. / WU6-RUN |
| C30 | B8 — `DEMO_AUTH` is opt-in and off by default. / DEMO_AUTH ต้องเปิดเอง ปิดโดยค่าเริ่มต้น | WT `server/.env.example` line `DEMO_AUTH=` (empty). CG(5) `CHECK demo-auth-not-default-enabled PASS DEMO_AUTH is empty in .env.example, nothing in the repo sets it to true`. / CG(5) R1 |
| C31 | B8 — with `DEMO_AUTH=true` and `NODE_ENV=production` the server refuses to activate it and answers 503 `DEMO_AUTH_REFUSED_IN_PRODUCTION` over real HTTP. / เปิดพร้อม production แล้วปฏิเสธ ตอบ 503 DEMO_AUTH_REFUSED_IN_PRODUCTION | WT `server/tests/demo-auth-gate.test.ts:243` — `"GET /me with a VALID x-demo-account is refused with 503 DEMO_AUTH_REFUSED_IN_PRODUCTION"`; that suite boots the real app with `app.listen(0)` and drives it with `fetch`. CG(5) §R2b: `setup.sh` refuses `DEMO_AUTH=true` with exit 1. / WT test, CG(5) R2b |
| C32 | B8 — it establishes identity from a header the caller types, no password, no user record, no signature, and is not authentication. / สร้างตัวตนจาก header ไม่มีรหัสผ่าน/บัญชี/ลายเซ็น และไม่ใช่การยืนยันตัวตน | WT `server/src/middleware/demo-auth.ts` (reads `x-demo-account`, falls back to `x-tenant-id`); `docs/product/WU5-DEPLOY.md` §8 states the same. / WT |
| C33 | B9 — there is no dotenv and nothing reads a `.env` file. / ไม่มี dotenv และไม่มีอะไรอ่านไฟล์ .env | `grep -rn dotenv server/src server/tests server/package.json` → 0 matches on WT, and no `dotenv` entry in `server/package.json`. CG(5) `CHECK wu5-manual-no-dotenv-claim PASS`. / WU6-RUN, CG(5) R7 |
| C34 | B9 — the installed `@supabase/supabase-js` declares `engines.node = ">=22.0.0"`. / dependency ประกาศ >=22.0.0 | WT `server/node_modules/@supabase/supabase-js/package.json` lines 142–144 → `"engines": { "node": ">=22.0.0" }`. Referenced by `docs/product/WU5-DEPLOY.md` §2 prerequisite 1 and `scripts/house-swarm-7/setup.sh`. / WT |

## 4. How to verify — the commands the documents name / วิธีตรวจสอบ — คำสั่งที่เอกสารระบุ

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C35 | V1 — `node --version` reports `v22.` or higher on the machine the manual was written on. / `node --version` ได้ v22. ขึ้นไป | CG(5) §6/§7 records the author's machine: `node --version` → `v24.19.0`. The claim as written is a requirement, and the environment line it sits in is stated as the author's machine, not the buyer's. / CG(5) R6 |
| C36 | V2 — `cd server && npm ci` installs the three runtime dependencies and exits 0. / npm ci ติดตั้ง dependency สามตัวและออกด้วย 0 | `server/package-lock.json` pins the tree; CG(5) R2c shows `setup.sh` running `npm ci` and exiting 0, and R2d shows the second run also exit 0. / CG(5) R2 |
| C37 | V3 — `cd server && npm run typecheck` exits 0 and prints no type error. / typecheck ออกด้วย 0 | `server/package.json` maps `typecheck` to `tsc --noEmit`. CG(5) §R9 `CHECK wu5-typecheck-server PASS`; CG(2) `server_tsc_exit=0`; CG(4) `tsc=0`. / CG(5) R9, CG(2), CG(4) |
| C38 | V4 — `cd server && npm test` with `DATABASE_URL` **unset** exits 0 with `Test Files 5 passed \| 1 skipped (6)` and `Tests 57 passed \| 5 skipped (62)`. / ไม่ตั้ง DATABASE_URL แล้วได้ 5 passed 1 skipped (6) / 57 passed 5 skipped (62) | **WU6-RUN, measured by the author of this document** (corrected in H7-FU-RATELIMIT-REPAIR7): raw output `Test Files 5 passed │ 1 skipped (6)` and `Tests 57 passed │ 5 skipped (62)`, exit 0. The five skipped tests are `tests/postgres-persistence.test.ts`'s, which skips itself with no database. This agrees with `docs/product/WU5-DEPLOY.md` §6.1, which carries the same two lines. The earlier figures (`4 passed │ 1 skipped (5)` / `46 passed │ 5 skipped (51)`) were measured before the sixth test file existed and are superseded. / WU6-RUN, WU5-DEPLOY.md §6.1 |
| C39 | V4 — with `DATABASE_URL` **set** it exits 0 with `Test Files 6 passed (6)` and `Tests 62 passed (62)`. / ตั้ง DATABASE_URL แล้วได้ 6 passed (6) / 62 passed (62) | **WU6-RUN, measured by the author of this document** (corrected in H7-FU-RATELIMIT-REPAIR7): raw output `Test Files 6 passed (6)` and `Tests 62 passed (62)`, exit 0, with `DATABASE_URL` set so all six test files run. `docs/product/WU5-DEPLOY.md` §6.1 carries the same two lines and states that this result holds **only** when `DATABASE_URL` is set, because `tests/postgres-persistence.test.ts` skips itself without a database. The earlier figures (`Test Files 5 passed (5)` / `Tests 51 passed (51)`, from RPT(5)) predate the sixth test file and are superseded; the `(58)`-totalled figures this row carried in the MT01 pre-sale cleanup revision are superseded in turn by the `(62)`-totalled figures above, which the lane that added the backstop regression (`PRESALE-CLEANUP-P3C`) measured. / WU6-RUN, WU5-DEPLOY.md §6.1 |
| C40 | V4 — with `DATABASE_URL` **set against a database the suite has already run against** it now exits 0 with `Test Files 6 passed (6)` and `Tests 62 passed (62)`, and leaves zero rows behind. The older failure this row used to record is **FIXED**. / ตั้ง DATABASE_URL กับฐานข้อมูลที่เคยรันแล้ว ตอนนี้ออกด้วย 0 ด้วย 6 passed (6) / 62 passed (62) และไม่ทิ้งแถวค้างไว้ อาการล้มเหลวเดิมที่แถวนี้เคยบันทึกไว้ **แก้แล้ว** | **Corrected in H7-FU-RATELIMIT-REPAIR7.** Measured on WT against an already-used local database (9 subscription rows and 1 ledger row present before the run, none of them created by this suite): `npm test` → `Test Files 6 passed (6)`, `Tests 62 passed (62)`, exit 0, and the row counts after the run were **unchanged** (`subscriptions` 9, `billing_event_ledger` 1) — the suite deletes exactly the rows it creates. That agrees with `docs/product/WU5-DEPLOY.md` §6.1, which states the same result for three consecutive runs with row counts `subscriptions` 0 / `billing_event_ledger` 0. **History, kept so an older copy cannot mislead:** before the fix (`ae74b74`) a second run against the same database **failed** with `Test Files 1 failed │ 4 passed (5)` / `Tests 1 failed │ 50 passed (51)`, at `tests/webhook.test.ts:101` `expected 'active' to be 'cancelled'`, because `billing_event_ledger` already contained `evt_apply_1` and the ledger's idempotency skipped the second delivery, so the applied state never changed. That was a row-leak defect in `tests/webhook.test.ts`; its teardown now deletes the subscriptions for the account ids it generated and the two ledger rows its fixed event ids claimed. The old failed-run figures and the "database must not have been used before" warning are **obsolete**. / WU6-RUN (this follow-up), WU5-DEPLOY.md §6.1 |
| C41 | V5 — `/health` answers `{"ok":true}` and the landing page answers 200. / `/health` ตอบ {"ok":true} และหน้าแรกตอบ 200 | WT `server/src/app.ts:44` `app.get('/health', … res.json({ ok: true }))`; WT `server/tests/server.test.ts:34` asserts 200 and `{ ok: true }` over real HTTP. CG(2) `GET_/health_status=200`. / WT test, CG(2) |
| C42 | V6 — `npx tsx scripts/proofs/wu2/migrate-runner-proof.mts` prints `migration_runner_idempotent=true` and exits 0. / พิมพ์ค่านั้นและออกด้วย 0 | WU6-RUN: observed exactly that, exit 0 (see C20). / WU6-RUN |
| C43 | V7 — `node scripts/proofs/wu3/quota-proof.mjs` prints six `CHECK … PASS` lines including the 429 with `provider_fetch_attempts=0`. / ได้ CHECK PASS หกบรรทัด | CG(3) `SUMMARY checks=6 passed=6 failed=0` plus the six named CHECK lines, including `over-quota-is-refused-before-provider … provider_fetch_attempts=0`. / CG(3) |
| C44 | V8 — i18n-parity prints eight `CHECK … PASS` lines including `keys_per_locale=th:124 en:124`, and e2e-web prints nine. / ได้แปดและเก้าบรรทัด | WU6-RUN: i18n-parity → `SUMMARY checks=8 passed=8 failed=0`, exit 0, with the `keys_per_locale=th:124 en:124` line. CG(4) and CG(5) both record `SUMMARY checks=9 passed=9 failed=0` for `e2e-web.mjs`. / WU6-RUN, CG(4), CG(5) |
| C45 | V9 — `node server/scripts/proofs/wu5/deploy-preflight.mjs` prints seven `CHECK … PASS` lines. / ได้เจ็ดบรรทัด | WU6-RUN: observed exactly seven CHECK lines plus `deploy-preflight: all 7 checks PASSED`, exit 0. CG(5) R1 recorded the same seven. / WU6-RUN, CG(5) R1 |
| C46 | V10 — `node server/scripts/proofs/wu6/claims-check.mjs` prints nine `CHECK … PASS` lines, one per required check name. / ได้เก้าบรรทัด หนึ่งต่อหนึ่งชื่อ check | WT `server/scripts/proofs/wu6/claims-check.mjs`; the nine names are `sales-docs-bilingual-headings`, `no-price-or-licence-in-sales-docs`, `no-supabase-tested-claim`, `not-implemented-list-complete`, `claims-evidence-covers-claims`, `migrations-proven-by-script`, `node-version-stated-22`, `ui-evidence-described-as-http-html` and `sales-numbers-agree-with-ledger` (added in MT01-PRESALE-P1; it collects the test-count figures the two sales documents state as their V4 live claim and the figures rows C38/C39/C40 state, and fails when either side carries a figure the other does not, or when a sales document still asserts the suite is not repeatable — proven red by `server/scripts/proofs/fu/claims-check-numeric-fixtures.mjs` and by the pre-change documents recovered from `f03c48d`). The run and its exit code are reported in RPT(6) and in the vendor-internal lane report `PRESALE-CLEANUP-P1.md` — the working paper of that name, at the vendor's report tree, which is **not part of the delivered folder** (`DELIVERY-MANIFEST.md` classifies it, and its own first lines say so), so it is named here rather than cited by a path the buyer cannot open. / WT, RPT(6) |

## 5. Requirements and what the buyer supplies / สิ่งที่ต้องมี และสิ่งที่ผู้ซื้อต้องเตรียม

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C47 | Q1 — Node.js 22 or newer, with npm. / Node.js 22 ขึ้นไป พร้อม npm | Same evidence as C34 (`engines.node = ">=22.0.0"` in the installed dependency). / WT |
| C48 | Q2 — dependencies must be installed inside `server/`. / ต้องติดตั้ง dependency ข้างใน server/ | `server/package.json` (the manifest and all scripts) and `server/package-lock.json` live in `server/`; every documented command runs `cd server` first. There is no root-level `package.json` in WT. / WT |
| C49 | Q3 — a PostgreSQL 16 or newer database; PostgreSQL 16 is what this kit has been tested with, and Supabase is UNTESTED, with testing against a real Supabase project scheduled before the kit goes on sale. / ฐานข้อมูล PostgreSQL 16 ขึ้นไป — คิทนี้ทดสอบกับ PostgreSQL 16 แล้ว ส่วน Supabase ยังไม่ถูกทดสอบ โดยกำหนดทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย | WT `server/.env.example` documents `DATABASE_URL` as the PostgreSQL connection string; `docs/product/WU5-DEPLOY.md` §4 states there is no default and no fallback address, and the sales document's Q3 says a Supabase Postgres URL speaks the same protocol but is untested here. Enforced mechanically by the rewritten `no-supabase-tested-claim` check in `server/scripts/proofs/wu6/claims-check.mjs` and proven on demand by `server/scripts/proofs/fu/supabase-claims-fixtures.mjs`. / WT, WU5-DEPLOY.md §4 |
| C50 | Q4 — `modules/` and `web/` must sit beside `server/`: the server imports from `../../../modules/` at runtime and reads pages from `../web/`. / ต้องมี modules/ และ web/ ข้าง server/ | WT `server/src/lib/ai.ts:5,9`, `payments.ts:4,8,9`, `quota.ts:30-32`, `subscriptions.ts:5,9,15`, `web-pages.ts:24`, `middleware/auth.ts:2-3`, `demo-auth.ts:2`, `tenant.ts:2` all import `../../../modules/…`; WT `server/src/lib/web-pages.ts:22` imports `../../../web/assets/i18n.js` and line 27 sets `WEB_ROOT = join(here, '../../../web')`. / WT source |
| C51 | Q5 — a process supervisor and TLS of your own; the Express process speaks plain HTTP. / supervisor และ TLS ของคุณเอง | WT `server/src/index.ts` calls `app.listen(port, …)` with no TLS options; `docs/product/WU5-DEPLOY.md` §4.3 states the process does not terminate TLS. No supervisor, proxy or compose file exists in WT. / WT, WU5-DEPLOY.md §4.3 |
| C52 | S1 — your own PostgreSQL database, SQL-standard PostgreSQL; there is no default, no bundled instance and no fallback address. A buyer who supplies a Supabase Postgres connection string is running the same PostgreSQL protocol, but Supabase is UNTESTED here, with testing against a real Supabase project scheduled before the kit goes on sale. / ฐานข้อมูล PostgreSQL ของคุณเอง ไม่มีค่าเริ่มต้น/ที่อยู่สำรอง — ส่วน Supabase ยังไม่ถูกทดสอบ โดยกำหนดทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย | WT `server/src/lib/persistence/pg.ts` `getPgPool()` returns nothing when `DATABASE_URL` is unset, and `server/src/index.ts` then reports `persistent=false` instead of falling back. Enforced mechanically by the rewritten `no-supabase-tested-claim` check in `server/scripts/proofs/wu6/claims-check.mjs` and proven on demand by `server/scripts/proofs/fu/supabase-claims-fixtures.mjs`. / WT source |
| C53 | S2 — your own AI provider key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`); without one the paid AI route answers 503. / คีย์ AI ของคุณเอง ไม่มีแล้วได้ 503 | CG(4) `CHECK ai-use-consumes-one-quota-unit PASS branch=no-provider-configured … handler_status=503 handler_error="No AI provider configured on this server instance (set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY)"`. Source: WT `server/src/routes/ai-demo.ts:45-48`. / CG(4), WT |
| C54 | S3 — your own Stripe keys for the payment demo (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). / คีย์ Stripe ของคุณเอง | WT `server/.env.example` documents both names; WT `server/src/lib/payments.ts` constructs the Stripe adapter from the environment. / WT |
| C55 | S4 — TLS, process supervision and secret storage of your own; there is no `.env` file to put secrets in. / TLS/supervisor/ที่เก็บ secret ของคุณเอง ไม่มี .env ให้ใส่ | Same evidence as C33 (no dotenv reader) and C51 (no TLS terminator, no supervisor). / WT |

## 6. Not-implemented list / รายการสิ่งที่ยังไม่ได้ทำ

Every item in section 6 of both sales documents is a *negative* claim: that a
capability is absent, that no test was ever run, or that no deployment happened.
The evidence for that kind of claim is (a) the absence of the code path, and
(b) where the repository deliberately answers with a "not implemented" code, the
observable refusal. Each row below names both, where both exist.

ทุกข้อในส่วนที่ 6 ของเอกสารขายทั้งสองภาษาเป็นคำกล่าวอ้างเชิง **ปฏิเสธ**: ว่าความสามารถหนึ่ง
ไม่มี ว่าไม่เคยรันการทดสอบ หรือว่าไม่เคยมีการ deploy หลักฐานของคำกล่าวอ้างแบบนี้คือ
(ก) การไม่มีอยู่ของเส้นทางโค้ด และ (ข) ที่ที่ที่เก็บโค้ดจงใจตอบด้วยรหัส "ยังไม่ได้ทำ" —
พฤติกรรมการปฏิเสธที่เห็นได้ แต่ละแถวล่างนี้ระบุทั้งสองอย่าง เมื่อมีทั้งสองอย่าง

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C56 | N1 — no OpenTelemetry exporter; traces are held in process memory only; no OTLP endpoint. / ไม่มี OpenTelemetry exporter เก็บ span ในหน่วยความจำเท่านั้น | WT `modules/enterprise-features/core/tracer.ts` implements `NoopTracer` and `MemoryTracer` only (`MemoryTracer` pushes to `this.completedSpans`; there is no export path). `grep -rn -i otlp server/src server/package.json modules/webhook-receiver` → 0 matches. / WU6-RUN |
| C57 | N2 — no LINE webhook verifier; it answers `WEBHOOK_UNKNOWN_PROVIDER`. / ไม่มีตัวตรวจสอบ webhook ของ LINE ตอบ WEBHOOK_UNKNOWN_PROVIDER | WT `modules/webhook-receiver/providers/line/index.ts:10` returns the code `'WEBHOOK_UNKNOWN_PROVIDER'` and states it is not implemented. / WT source |
| C58 | N3 — no GitHub webhook verifier; same behaviour. / ไม่มีของ GitHub พฤติกรรมเดียวกัน | WT `modules/webhook-receiver/providers/github/index.ts:10` returns the same code. / WT source |
| C59 | N4 — Supabase is UNTESTED: the kit has been tested with PostgreSQL 16 and has NOT been tested with Supabase, testing against a real Supabase project is scheduled before the kit goes on sale, Supabase auth has never been verified against a real project, and the persistence layer is not Supabase-backed and uses the pg driver. / Supabase ยังไม่ถูกทดสอบ ทดสอบกับ PostgreSQL 16 แล้ว ยังไม่ทดสอบกับ Supabase กำหนดทดสอบกับโปรเจกต์จริงก่อนเปิดขาย auth ยังไม่ถูกตรวจสอบ ชั้น persistence ไม่ใช่ Supabase-backed ใช้ pg | The auth path exists in WT (`server/src/lib/supabase.ts`, `server/src/middleware/auth.ts`, `modules/auth-supabase/`) and no Supabase project is reachable from this work, so no Supabase test result can be stated. The persistence layer uses `pg`: WT `server/src/lib/persistence/pg.ts` imports and pools from `pg`, and WT `server/src/lib/persistence/pg-repositories.ts` issues SQL through that pool. RPT(2) §7 records the test database as a **local** PostgreSQL instance, not a Supabase project. This row is the one that used to say a buyer's Supabase Postgres connection string "works" — that wording is **superseded** by H7-REVIEW-FIX-2; the claim is now the untested position above. Enforced by the rewritten `no-supabase-tested-claim` check in `server/scripts/proofs/wu6/claims-check.mjs` and proven on demand by `server/scripts/proofs/fu/supabase-claims-fixtures.mjs`. See the honesty note at the end of this file. / WT source, RPT(2) §7 |
| C60 | N5 — the rate limit on `POST /payment/webhook` is in-process only, and its per-source stage covers callers whose signature is wrong; a multi-instance deployment shares no counter, and the coarse backstop's key covers the endpoint rather than the caller. / rate limit บนเส้นทางนี้เป็นแบบในโปรเซสเดียว | WT `server/src/app.ts` mounts `webhookRateLimitMiddleware` **after** `express.raw()` and before the handler on `POST /payment/webhook` (re-ordered in MT01-PRESALE-P3A, review finding LOW-2; the earlier revision of this row said "first … ahead of `express.raw()`", which is superseded); WT `server/src/lib/rate-limit.ts` composes a **per-source** key for the signature-verification stage and the `route:POST /payment/webhook` constant for the coarse every-request backstop, reads the three env vars and maps a refusal to 429; WT `modules/rate-limit/` is the vendored Module Hub module with its provenance at `modules/rate-limit/PROVENANCE-RATELIMIT.md`. Observed in this work unit: `npx vitest run tests/webhook-rate-limit.test.ts` → 10 passed (10), and `node scripts/proofs/fu/ratelimit-flood-proof.mjs` → 7 checks, 7 passed, 0 failed, with `forged_requests_sent=6 accepted=3 refused=3` and the correctly-signed delivery answered 200 rather than refused. The earlier form of this row cited `ratelimit-proof.mjs` → 5 checks, 5 passed; that harness asserted the OLD ordering and is superseded (see the row's history note below). The single-process limit is the module's own documented one (`modules/rate-limit/MODULE.md`, §Known limitation) and is stated in the vendor's FU-RATELIMIT.md record (not delivered). **History, kept so an older copy cannot mislead:** before MT01-PRESALE-P3A the limiter was mounted ahead of `express.raw()`, refused a request before signature verification so that a flood cost no HMAC work, and used one constant key for everything — that design let an outsider's flood refuse a real Stripe delivery, which is the defect lane P3A fixed. / WU6-RUN (this follow-up), FU-RATELIMIT.md |
| C61 | N6 — no deployment has ever been performed anywhere; the product has been run on a developer machine against a local PostgreSQL only; no multi-instance proof. / ไม่เคย deploy ที่ใดเลย รันบนเครื่องนักพัฒนา กับ local PostgreSQL เท่านั้น ไม่มีหลักฐานหลายอินสแตนซ์ | `docs/product/WU5-DEPLOY.md` §1 states this about itself; RPT(5) §6 item 2 records it in the controller's own words; WT is a worktree and nothing in it records a deployment. The local test database is a machine-local PostgreSQL instance (RPT(2) §7). / WU5-DEPLOY.md §1, RPT(5) §6 |
| C62 | N7 — payments and AI providers need your own keys; no live charge and no live provider call was made. / ต้องใช้คีย์ของคุณเอง ไม่มีการเรียกเก็บเงินหรือเรียกผู้ให้บริการจริง | CG(3) and CG(4) harnesses stub `globalThis.fetch` to block real egress and count attempts; CG(4) G7 reports `call1_provider_calls=1` against a **stub**, and `branch=no-provider-configured` on this machine. The Stripe adapter is exercised through the mock/webhook path, not a live charge. / CG(3), CG(4) G7 |
| C63 | The UI evidence is HTTP-level and saved HTML, there are no screenshots, no headless browser was driven, and no claim is made about layout, styling or JS behaviour. / หลักฐาน UI เป็น HTTP/HTML ไม่มีภาพหน้าจอ ไม่ได้ขับเบราว์เซอร์ | CG(4) G8 lists the ten saved HTML files; RPT(4) §6 item 5 states in the controller's own words that the pages were not tested in a real browser and that the evidence is HTTP + saved HTML, not screenshots. A sweep of WT for `*.png/jpg/jpeg/gif/webp` finds 0 files. / CG(4) G8, RPT(4) §6, WU6-RUN |
| C64 | `npm test` writes subscription and ledger rows into the configured database and **deletes the rows it created again**, so the suite is repeatable against one database. / `npm test` เขียนแถว subscription และ ledger ลงฐานข้อมูลที่ตั้งไว้ แล้ว**ลบแถวที่ตัวเองสร้างทิ้ง** ชุดเทสต์จึงรันซ้ำบนฐานข้อมูลเดิมได้ | **Corrected in H7-FU-RATELIMIT-REPAIR7**; agrees with `docs/product/WU5-DEPLOY.md` §6.1. Measured on WT: `npm test` on an already-used local database reported `Test Files 6 passed (6)` / `Tests 62 passed (62)`, exit 0, and the row counts after the run were **unchanged** (`subscriptions` 9, `billing_event_ledger` 1 — none of them created by this suite). §6.1 records the same behaviour against a clean database: three consecutive runs each `6 passed (6)` / `62 passed (62)`, with `subscriptions` 0 and `billing_event_ledger` 0 afterwards. The rows come from `tests/postgres-persistence.test.ts` (deletes its own rows in its own teardown) and `tests/webhook.test.ts` (its teardown deletes the subscriptions for the account ids that run generated and the two ledger rows its fixed event ids claimed; no table is truncated). **History, so an older copy cannot mislead:** an earlier version of `tests/webhook.test.ts` deleted nothing, so a run left rows behind and a second run against the same database **failed**; that defect is fixed (`ae74b74`), and the earlier description of this row is **superseded**. / WU6-RUN (this follow-up), WU5-DEPLOY.md §6.1 |

## 7. Claims deliberately removed for lack of evidence / คำกล่าวอ้างที่ตั้งใจตัดออก เพราะไม่มีหลักฐาน

These were considered for the sales copy and **removed**, because no real evidence
could be attached to them. They are listed here so a reviewer can see they were
considered and dropped rather than quietly softened.

รายการเหล่านี้ถูกพิจารณาใส่ในข้อความขายแล้ว **ตัดออก** เพราะไม่มีหลักฐานจริงรองรับ
ระบุไว้ตรงนี้เพื่อให้ผู้ตรวจเห็นว่าถูกพิจารณาและตัดออก ไม่ใช่ถูกลดความลงเงียบ ๆ

| # | Claim considered / คำกล่าวอ้างที่พิจารณา | Why it was removed / เหตุผลที่ตัดออก |
|---|---|---|
| X1 | "The migrations have been proven to work" — as an unsupported sentence. / "migration พิสูจน์แล้ว" แบบไม่มีที่มา | Dropped in that bare form. Every sentence about the migration proof in the final documents **names the script** (`server/scripts/proofs/wu2/migrate-runner-proof.mts`) and the observation it prints (`migration_runner_idempotent=true`), per the work unit's rule that the proof must be named. / ต้องระบุวิธีพิสูจน์ทุกครั้ง |
| X2 | "Works with Supabase" / "Supabase-ready" / "tested with Supabase". / "ใช้กับ Supabase ได้" / "ทดสอบกับ Supabase แล้ว" | Removed entirely, and the removal now has teeth. Supabase auth has never been exercised against a real project and the persistence layer is not Supabase-backed, so no such claim can be evidenced; the final documents say the opposite, in both languages (N4 / C59). **Superseded positive wording, recorded so an older copy cannot mislead:** this ledger's own C49, C52 and C59 rows, and §8 constraint 1, used to describe a buyer's Supabase Postgres connection string as something that "works", and the C59 claim cell said in Thai that the buyer's connection string "ใช้ได้". That positive wording is **superseded** by H7-REVIEW-FIX-2; the position is now: PostgreSQL 16 has been tested, Supabase is untested, testing is scheduled before sale. The check that is supposed to kill these claims was vacuous until that work unit rewrote it — an EN copy reading "…connection string works with Supabase." PASSED the old rule — so treat any older copy of this ledger, or of the check, as stale. Enforced now by the `no-supabase-tested-claim` check and proven by `server/scripts/proofs/fu/supabase-claims-fixtures.mjs`. / ตัดออกทั้งหมด และบันทึกว่าถ้อยคำเชิงบวกเดิม (รวมถึงถ้อยคำในตารางนี้เอง) ถูกล้มเลิกแล้ว |
| X3 | "Production-ready" / "production-grade" / "hardened". / "พร้อมใช้งาน production" / "แข็งแรง" | Removed. No deployment was ever performed, there was no rate limiting on the payment webhook at the time this claim was assessed, and there is no multi-instance proof. The documents instead carry the explicit limits N5, N6 and the closing "not validated by a different party" statement. (The rate-limit gap named here has since been closed by the follow-up work unit H7-FU-RATELIMIT — see the N5 row C60 — but the claim stays removed, because N5 is now a different limit rather than no limit.) / ตัดออก เพราะยังไม่มีหลักฐานรองรับ |
| X4 | "Zero-configuration" or "just clone and run". / "ไม่ต้องตั้งค่าอะไร" / "โคลนแล้วรันได้เลย" | Removed. `DATABASE_URL` is required for persistence, an AI provider key is required to reach the paid route, and migrations create the schema on first start. Section 7 and section 8 state these requirements instead. / ตัดออก เพราะต้องตั้งค่าจริง |
| X5 | "The UI has been visually verified" / any statement about how it looks. / "ตรวจ UI ด้วยตาแล้ว" | Removed. The UI evidence is HTTP-level and saved HTML; there are no screenshots and no headless browser run, so nothing about appearance can be claimed. The documents say exactly that (C63). / ตัดออก เพราะไม่มีภาพหน้าจอ |
| X6 | "Handles multiple instances" / "horizontally scalable". / "รองรับหลายอินสแตนซ์" | Removed. No multi-instance deployment proof exists; the in-memory fallback is per-process. Stated as limit N6. / ตัดออก เพราะไม่มีหลักฐาน |
| X7 | Any price, licence, currency, entitlement to resell, or purchase link. / ราคา license สกุลเงิน สิทธิ์การขายต่อ หรือลิงก์ซื้อ | Never included. Pricing and licensing are the Owner's decision and are explicitly outside this work unit's scope; where a price would appear, both documents state that commercial terms are provided separately and are not part of the document. Verified mechanically by the `no-price-or-licence-in-sales-docs` check. / นอกขอบเขตของใบงาน |
| X8 | "The test suite passes" — as an unconditional statement. / "ชุดเทสต์ผ่าน" แบบไม่มีเงื่อนไข | Weakened to the two measured cases with their exact counts (C38–C39), because the sentence that matters is conditional: the full-suite figure holds only when `DATABASE_URL` is set, and with it unset five tests skip themselves. **Corrected in H7-FU-RATELIMIT-REPAIR7:** this row used to give a third reason — that a run against a database the suite had already used **failed** — and that reason is **obsolete**, because the row-leak defect behind it is fixed (`ae74b74`); a used database now gives `6 passed (6)` / `62 passed (62)`, exit 0 (C40). / อ่อนลงตามที่วัดจริง และเหตุผลข้อที่สามเดิมล้าสมัยแล้ว |
| X9 | "All six tables are created by the migrations, proven by the migration script." / "migration สร้างตารางทั้งหก พิสูจน์ด้วยสคริปต์" | Kept, but the attribution was tightened: the six tables **are** observed by `migrate-runner-proof.mts` (`OBSERVATION tables=[…]`) and by `db-check.mjs`, and are read out of both migration files. The claim does not say the script created them in every environment. / คงไว้ แต่ระบุที่มาให้แคบลง |
| X10 | "Everything in this kit has been independently verified." / "ทุกอย่างในคิทนี้ถูกตรวจโดยอิสระแล้ว" | Removed. Parts of the kit were verified by a different agent in earlier layers (CG logs), but this document set has **not** been validated by a different party, and the WU-5 deployment manual records that it had not been walked through by another agent when it was written. Both sales documents close with that statement. / ตัดออก เพราะยังไม่จริงสำหรับเอกสารชุดนี้ |

---

## 8. Standing honesty constraints for this document set / ข้อกำหนดความซื่อสัตย์ถาวรของเอกสารชุดนี้

1. **No claim anywhere states or implies that anything was tested, run, verified or
   exercised with Supabase.** The position is: PostgreSQL 16 HAS been tested, and
   Supabase is UNTESTED — testing against a real Supabase project is scheduled
   before the kit goes on sale, and the Supabase auth product has never been
   verified against a real project. This is enforced mechanically by the
   `no-supabase-tested-claim` check in
   `server/scripts/proofs/wu6/claims-check.mjs`, whose rule was **rewritten in
   H7-REVIEW-FIX-2**: until then that check REQUIRED the sentence "a buyer's own
   Supabase Postgres connection string works" and could not flag it, so a copy
   whose EN N4 read "…connection string works with Supabase." still passed. The
   check now BANS every affirmative Supabase construction in both languages —
   including the Thai `ใช้ได้` forms the old list missed — and REQUIRES the
   untested-Supabase statements in both documents. It is proven on demand by
   `server/scripts/proofs/fu/supabase-claims-fixtures.mjs` (9 cases; the copy
   above fails, the delivered documents pass) and written up in
   the vendor's FU-REVIEW-FIX-2.md record (not delivered).
   / **ไม่มีข้อใดกล่าวหรือสื่อว่าอะไรถูกทดสอบ/รัน/ตรวจกับ Supabase** สถานะคือ
   ทดสอบกับ PostgreSQL 16 **แล้ว** ส่วน Supabase **ยังไม่ถูกทดสอบ** โดยกำหนดทดสอบกับ
   โปรเจกต์ Supabase จริงก่อนเปิดขาย และตัวผลิตภัณฑ์ auth ของ Supabase ยังไม่เคยถูกตรวจกับ
   โปรเจกต์จริง บังคับด้วยกลไกผ่าน check `no-supabase-tested-claim` ใน
   `server/scripts/proofs/wu6/claims-check.mjs` ซึ่ง**เขียนกฎใหม่ใน H7-REVIEW-FIX-2**
   และพิสูจน์ได้ตามสั่งด้วย `server/scripts/proofs/fu/supabase-claims-fixtures.mjs`
2. **No price, licence, currency or purchase link appears in either sales
   document.** Commercial terms are stated to be provided separately. This is
   deliberate: pricing and licensing are the Owner's decision and outside this work
   unit's scope. Enforced by the `no-price-or-licence-in-sales-docs` check.
   / **ไม่มีราคา license สกุลเงิน หรือลิงก์ซื้อในเอกสารขายทั้งสองฉบับ**
3. **No deployment is stated or implied to have happened.** The product has been run
   on a developer machine against a local PostgreSQL only. Both documents say so.
   / **ไม่มีการระบุหรือสื่อว่ามี deploy เกิดขึ้น**
4. **The local test database used during WU-6 is never presented as the buyer's
   configuration.** Its address does not appear in any buyer-facing document in this
   set; the documents use placeholders and tell the buyer to substitute their own.
   / **ฐานข้อมูลทดสอบในเครื่องไม่ถูกนำเสนอเป็นคอนฟิกของผู้ซื้อ**
5. **`server/src/index.ts` exports `createApp` and `main`, and deliberately does not
   export `app`.** The base revision (`6010332`) created the app at module scope
   (`const app = createApp(); app.listen(port, …); export { app, createApp };`), so
   importing that module bound the port and `createApp()` — which reads `DEMO_AUTH`
   and decides which gate to mount — ran at import time. WU-4/WU-6 replaced that with
   a `main()` that owns creation plus an entry-point guard, and dropping the `app`
   export is the consequence. It is settled on evidence, not preference: **no code
   file in this repository imports `server/src/index.ts`** — `git grep -nIE "src/index"`
   returns only prose and the two `tsx src/index.ts` package scripts, a `git grep`
   across every revision for a specifier resolving to it returns nothing, and
   `server/scripts/proofs/fu/index-import-safety.mjs` resolves the import specifiers
   of 149 code files under `server/src`, `server/tests`, `server/scripts`, `scripts`,
   `web` and `modules` and finds zero importers. The same harness proves the property
   the guard exists for: importing the module binds no listening port, starts no
   database work, and exports exactly `createApp` and `main`. Recorded in
   `server/src/index.ts` itself, in §2 of `docs/CURRENT_STATUS.md`, and written up in the
   vendor-internal review-repair log entry `FU-REVIEW-FIX-3.md` (a working paper, not part of
   the delivered folder). No accessor is invented to replace the
   removed export, because there is no caller to serve and re-creating a module-scope
   `app` would restore the defect the guard removed. / **`server/src/index.ts` export
   `createApp` กับ `main` และตั้งใจไม่ export `app`** เพราะเวอร์ชันฐานสร้างแอปที่ module
   scope และผูกพอร์ตตอน import · ไม่มีไฟล์ใดในที่เก็บโค้ดนี้ import ไฟล์นี้ พิสูจน์ด้วย
   `server/scripts/proofs/fu/index-import-safety.mjs`
6. **No delivered document carries an internal machine path.** Paths of the form
   a `D:`-rooted vendor path, a `C:`-rooted user path or the vendor's Windows user
   name have been removed from every document this set delivers,
   including this ledger's WT / CG(n) / RPT(n) legend, `STAGE3_EVIDENCE_REPORT.md` and
   the three provenance records under `modules/`. Each location is still identifiable
   by name (or by a vendor-side relative path such as
   `06-Agent-Logs/WSTERA-House/reports/…`), so the claim → evidence map stays
   traceable. **One class of file is deliberately NOT edited** — see the residual in
   §9. / **ไม่มีเอกสารที่ส่งมอบฉบับใดมีพาธเครื่องภายใน** (ดู §9 สำหรับข้อยกเว้นที่บันทึกไว้)

**One statement about this file itself.** This map has not been reviewed by a
different party, and it is not an approval of the sales copy. It is a row-by-row
index from claim to evidence, written by the same author as the documents it
indexes; a reviewer who disagrees with a row should treat the evidence location as
the authority, not this table.

**ข้อความหนึ่งเกี่ยวกับไฟล์นี้เอง** แผนที่นี้ยังไม่ถูกตรวจโดยบุคคลอื่น และไม่ใช่การอนุมัติ
ข้อความขาย มันคือดัชนีจากคำกล่าวอ้างไปยังหลักฐาน ทีละแถว เขียนโดยผู้เขียนคนเดียวกับเอกสาร
ที่มันจัดทำดัชนี ผู้ตรวจที่ไม่เห็นด้วยกับแถวใด ควรถือที่อยู่หลักฐานเป็นข้อยุติ ไม่ใช่ตารางนี้

---

## 9. Residual — files that still carry an internal path, and why / ส่วนที่เหลือ — ไฟล์ที่ยังมีพาธภายใน และเหตุผล

The internal machine paths were removed from the delivered documents this set
covers (§8 constraint 6). This section records, by name, every file in the
repository that a repository-wide sweep still finds carrying one, and what was
done with each. The sweep is the repository-wide `git grep` the work unit
specifies, run over the tracked tree for the three vendor-identifying tokens it
names. Those tokens are not reproduced here, because writing them down would put
an internal machine path straight back into this delivered ledger — the same
self-reference §8 constraint 6 avoids by describing its patterns instead of
quoting them.

**Applied in H7-REVIEW-FIX-THAI-PATHS:** the controller ruled on 2026-09-29 that
the illustrative examples in §9b were to be replaced with generic placeholders
rather than kept as residual, and that ruling has been carried out — §9b now
records the substitution instead of a pending decision. The path-residual decision in §9a
is unchanged by that ruling; the later 2026-10-02 Phase A security refresh updates only the
test-tool references/provenance truth described inside §9a.

`git grep` reports tracked files only; every file below is tracked, so this is a
complete list of tracked hits. No claim row (C1–C64), no X-table row and no other
part of §8 was touched to add this section.

### 9a. The seven vendored upstream documents — provenance preserved; security-tooling references may be refreshed

| file | hit line(s) | what the path is |
|---|---|---|
| `modules/auth-supabase/DESIGN.md` | 538 | upstream author's own deliverable location |
| `modules/auth-supabase/.agy-design-prompt.txt` | 4 | path in the upstream agent prompt |
| `modules/payment/DESIGN.md` | 632 | upstream author's own deliverable location |
| `modules/payment/.agy-prompt.md` | 6 | path in the upstream agent prompt |
| `modules/rate-limit/DESIGN.md` | 525 | upstream author's own deliverable location |
| `modules/tenant-context/agy-prompt.md` | 6, 11, 39 | paths in the upstream agent prompt |
| `modules/webhook-receiver/DESIGN.md` | 568 | upstream author's own deliverable location |

**Provenance rule for this group.** These files entered MT01 through the
Module Reuse Check, so the recorded source commit and the historical copy event stay
authoritative. That does **not** mean the MT01 distribution must retain a vulnerable
development-tool version forever. In the 2026-10-02 Phase A security pass, the package
reference snippets in `auth-supabase/DESIGN.md`, `payment/DESIGN.md`,
`rate-limit/DESIGN.md` and `webhook-receiver/DESIGN.md` were intentionally refreshed
from the vulnerable Vitest 2 line to the audited MT01 test toolchain (Vite 6.4.3 /
Vitest 5.0.3; the rate-limit coverage plugin moved with it). Runtime contracts and
runtime source were not changed by that documentation/tooling refresh.

For `modules/rate-limit/DESIGN.md` specifically,
`modules/rate-limit/PROVENANCE-RATELIMIT.md` now time-scopes the old byte-identity
statement correctly: the file **was** byte-identical at the H7 adoption point on
2026-09-28, then intentionally diverged in Phase A so the delivered design no longer
instructs a buyer to install the known-vulnerable historical test toolchain.
`package.json` / `package-lock.json` record the same security refresh. The source
commit remains the provenance of the adopted module; the current MT01 file hash is
the authority for the distributed revision.

The internal machine-path examples listed in the table remain historical upstream
text and are not executable configuration. Delivery hygiene is enforced separately by
`DELIVERY-MANIFEST.md` and its gate; the Phase A changes above were made for security
truth, not to rewrite the provenance history.
/ **กฎ provenance ของกลุ่มนี้** ยังคงแหล่งที่มาและเหตุการณ์ copy เดิมไว้ แต่การอัปเดต
เครื่องมือทดสอบเพื่อปิดช่องโหว่เมื่อ 2026-10-02 เป็นการเปลี่ยนฝั่ง MT01 โดยเจตนา
จึงไม่อ้างว่าไฟล์ปัจจุบันยัง byte-identical กับ snapshot เดิม หลังการอัปเดตนี้
runtime contract/source ไม่ได้เปลี่ยน และไฟล์ package/provenance ระบุ divergence ไว้ตรง ๆ

### 9b. Two files the work unit did not name — illustrative examples, ruled on and substituted

| file | hit line(s) | what the path was |
|---|---|---|
| `scripts/house-swarm-7/setup.sh` | 211, 213 | a Windows path trap quoted as an example in a comment |
| `server/scripts/proofs/fu/setup-dbcheck-proof.mjs` | 28, 30 | the same trap quoted in a file header comment |

Both hits were *inside explanatory comments describing a Windows path-conversion
trap*: the text shows what a path *looks like* when Git-Bash hands `/d/…` to a
native program, i.e. the value is an example of a malformed path, not a location
the code reads. Neither file is a document shipped in the delivery, so the work
unit that first found them recorded them as residual and left the call to the
controller/owner. **The controller ruled on 2026-09-29 that the machine-specific
parts become generic placeholders, and H7-REVIEW-FIX-THAI-PATHS applied it:** in
both comments the POSIX example's leading segment became `path/to/project`, so
the shape is now `/d/path/to/project/…` arriving as `D:\d\path\to\project\…`. The
before/after is not quoted here beyond that generic form, for the same
self-reference reason given in the introduction to this section — writing the
vendor's own folder name down would put the machine path straight back into this
ledger. The comments still explain the trap, because the shape they demonstrate (a
`/d/…` POSIX path handed to native `node.exe` arriving as `D:\d\…`) is preserved;
only the machine-specific segments were generalised. No executable line in either
file changed, and `setup-dbcheck-proof.mjs`'s own seven cases still pass. This is
no longer a residual: a repository-wide sweep finds no machine path in either
file.
/ **สองไฟล์นี้ผู้คุมวินิจฉัยเมื่อ 2026-09-29 ให้แทนส่วนที่เป็นพาธของเครื่องด้วย
placeholder ทั่วไป และงานนี้ทำแล้ว** — เปลี่ยนเฉพาะคอมเมนต์ ยังคงอธิบายกับดักพาธเดิม
ไม่มีการแก้โค้ดที่รัน และไม่นับเป็นส่วนที่เหลืออีกต่อไป
