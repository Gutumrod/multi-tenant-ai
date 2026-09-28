# WU-6 Claims → Evidence Map / แผนที่คำกล่าวอ้าง → หลักฐาน WU-6

Every factual claim made in `docs/house-swarm-7/WU6-SALES-EN.md` and
`docs/house-swarm-7/WU6-SALES-TH.md`, one row each, with the evidence that supports
it: the exact file, command or observation, and where the controller's own evidence
for it lives. A reviewer can check the sales copy against reality row by row.

คำกล่าวอ้างเชิงข้อเท็จจริงทุกข้อใน `docs/house-swarm-7/WU6-SALES-EN.md` และ
`docs/house-swarm-7/WU6-SALES-TH.md` หนึ่งแถวต่อหนึ่งข้อ พร้อมหลักฐานที่รองรับ: ไฟล์ คำสั่ง
หรือข้อสังเกตที่แน่นอน และที่อยู่ของหลักฐานฝั่งผู้คุม ผู้ตรวจสามารถเทียบข้อความขายกับ
ความจริงได้ทีละแถว

Evidence locations used in the table / ที่อ้างอิงหลักฐานที่ใช้ในตาราง:

- **WT** — this worktree: `D:/AI-Workspace/runtime/worktrees/house-swarm-7-wu6`
- **CG(n)** — controller gate log
  `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/reports/evidence/house-swarm-7-wu<n>-commander-gates.log`
- **RPT(n)** — `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/reports/REPORT-HOUSE-SWARM-7-WU<n>-2026-09-28.md`
- **WU6-RUN** — measured by the author of this document during WU-6, on WT, with the
  raw output reported in `REPORT-HOUSE-SWARM-7-WU6-2026-09-28.md` / วัดโดยผู้เขียน
  เอกสารนี้ระหว่าง WU-6 บน WT โดยผลดิบอยู่ในรายงาน WU-6

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
| C7 | It is a reference implementation plus evidence — not a hosted service, not a finished product, not a deployment. / เป็น implementation + หลักฐาน ไม่ใช่บริการ ไม่ใช่สินค้าสำเร็จ ไม่ใช่ deploy | WT contains no `Dockerfile`, no compose file, no reverse-proxy config; `docs/house-swarm-7/WU5-DEPLOY.md` §1 states no deployment was performed; CG(5) `CHECK wu5-no-docker-or-cloud-config-added PASS`. / CG(5) R9 |
| C8 | It is for a backend engineer or technical founder, judged by running it. / ทำเพื่อวิศวกร/ผู้ก่อตั้งสายเทคนิค ตัดสินด้วยการรัน | Editorial positioning, not a measurable claim: it asserts nothing about the product's behaviour or contents, so it needs no behavioural evidence. It is deliberately kept free of any performance, scale or customer claim. / editorial, no evidence required |

## 2. The repository contents / เนื้อหาในเรดิสทอรี

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C9 | R1 — `server/src` holds 17 TypeScript files. / `server/src` มีไฟล์ TypeScript 17 ไฟล์ | `find server/src -name '*.ts' │ wc -l` → `17`, run on WT (WU6-RUN). / WU6-RUN |
| C10 | R2 — exactly two SQL files, named `0001_persistence.sql` and `0002_usage.sql`. / ไฟล์ SQL สองไฟล์เท่านั้น | `ls server/migrations` → `0001_persistence.sql`, `0002_usage.sql`; `ls server/migrations/*.sql │ wc -l` → `2`, on WT (WU6-RUN). CG(5) `CHECK migration-set-listed PASS the manual names all 2 migration files`. / WU6-RUN, CG(5) R1 |
| C11 | R3 — five test files. / ไฟล์เทสต์ห้าไฟล์ | `ls server/tests` → `demo-auth-gate.test.ts`, `postgres-persistence.test.ts`, `quota-enforcement.test.ts`, `server.test.ts`, `webhook.test.ts` = 5, on WT (WU6-RUN). Consistent with the three vitest summary lines the suite reports. / WU6-RUN |
| C12 | R3 — exactly three runtime dependencies: `express`, `pg`, `@supabase/supabase-js`. / runtime dependency สามตัวเท่านั้น | WT `server/package.json` `"dependencies"` block lists exactly those three. Asserted independently by `docs/house-swarm-7/WU5-DEPLOY.md` §3.2 and cross-checked by CG(5) `CHECK env-example-covers-manual-variables PASS`. / WT `server/package.json` |
| C13 | R4 — seven modules, named. / โมดูลเจ็ดตัว มีชื่อระบุ | `ls modules` → `ai-provider`, `auth-supabase`, `enterprise-features`, `payment`, `subscription`, `tenant-context`, `webhook-receiver`; `ls -d modules/*/ │ wc -l` → `7`, on WT (WU6-RUN). / WU6-RUN |
| C14 | R5 — five sample pages and four asset files. / หน้าตัวอย่างห้าหน้า และ asset สี่ไฟล์ | `ls web/*.html │ wc -l` → `5`; `ls web/assets` → `app.css`, `app.js`, `i18n.d.ts`, `i18n.js` = 4, on WT (WU6-RUN). CG(5) `CHECK web-assets-present PASS all 8 sample UI files are present`. / WU6-RUN, CG(5) R1 |
| C15 | R6 — `scripts/house-swarm-7/` holds `setup.sh`, `setup.md`, `db-check.mjs`. / มีสามไฟล์นี้ | `ls scripts/house-swarm-7` → those three files, on WT (WU6-RUN). CG(5) R2 exercises `setup.sh` for real (four cases, exit codes captured). / WU6-RUN, CG(5) R2 |
| C16 | R7 — proof harnesses for WU-2 to WU-6 and ten saved HTML pages under `wu4-e2e/`. / harness ของ WU-2 ถึง WU-6 และหน้า HTML สิบไฟล์ | `ls server/scripts/proofs/` → `wu2 wu3 wu4 wu5 wu6`; `ls server/scripts/proofs/wu4/wu4-e2e/*.html │ wc -l` → `10` (5 pages × th/en), on WT (WU6-RUN). CG(4) G8 recorded the same 10 files. / WU6-RUN, CG(4) |
| C17 | The tree also holds `docs/house-swarm-7/` (`WU3-PAID-ROUTE-INVENTORY.md`, `WU4-SAMPLE-UI.md`, `WU5-DEPLOY.md`, this document set), `BRIEF.md`, `STAGE3_EVIDENCE_REPORT.md`. / ทรีมีไฟล์เหล่านี้ด้วย | All named files exist in WT; `ls docs/house-swarm-7` lists the four WU documents plus the three WU-6 files. / WT |

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
| C32 | B8 — it establishes identity from a header the caller types, no password, no user record, no signature, and is not authentication. / สร้างตัวตนจาก header ไม่มีรหัสผ่าน/บัญชี/ลายเซ็น และไม่ใช่การยืนยันตัวตน | WT `server/src/middleware/demo-auth.ts` (reads `x-demo-account`, falls back to `x-tenant-id`); `docs/house-swarm-7/WU5-DEPLOY.md` §8 states the same. / WT |
| C33 | B9 — there is no dotenv and nothing reads a `.env` file. / ไม่มี dotenv และไม่มีอะไรอ่านไฟล์ .env | `grep -rn dotenv server/src server/tests server/package.json` → 0 matches on WT, and no `dotenv` entry in `server/package.json`. CG(5) `CHECK wu5-manual-no-dotenv-claim PASS`. / WU6-RUN, CG(5) R7 |
| C34 | B9 — the installed `@supabase/supabase-js` declares `engines.node = ">=22.0.0"`. / dependency ประกาศ >=22.0.0 | WT `server/node_modules/@supabase/supabase-js/package.json` lines 142–144 → `"engines": { "node": ">=22.0.0" }`. Referenced by `docs/house-swarm-7/WU5-DEPLOY.md` §2 prerequisite 1 and `scripts/house-swarm-7/setup.sh`. / WT |

## 4. How to verify — the commands the documents name / วิธีตรวจสอบ — คำสั่งที่เอกสารระบุ

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C35 | V1 — `node --version` reports `v22.` or higher on the machine the manual was written on. / `node --version` ได้ v22. ขึ้นไป | CG(5) §6/§7 records the author's machine: `node --version` → `v24.19.0`. The claim as written is a requirement, and the environment line it sits in is stated as the author's machine, not the buyer's. / CG(5) R6 |
| C36 | V2 — `cd server && npm ci` installs the three runtime dependencies and exits 0. / npm ci ติดตั้ง dependency สามตัวและออกด้วย 0 | `server/package-lock.json` pins the tree; CG(5) R2c shows `setup.sh` running `npm ci` and exiting 0, and R2d shows the second run also exit 0. / CG(5) R2 |
| C37 | V3 — `cd server && npm run typecheck` exits 0 and prints no type error. / typecheck ออกด้วย 0 | `server/package.json` maps `typecheck` to `tsc --noEmit`. CG(5) §R9 `CHECK wu5-typecheck-server PASS`; CG(2) `server_tsc_exit=0`; CG(4) `tsc=0`. / CG(5) R9, CG(2), CG(4) |
| C38 | V4 — `cd server && npm test` with `DATABASE_URL` **unset** exits 0 with `4 passed │ 1 skipped (5)` files and `46 passed │ 5 skipped (51)` tests. / ไม่ตั้ง DATABASE_URL แล้วได้ 4 passed 1 skipped / 46 passed 5 skipped | **WU6-RUN, measured by the author of this document**: raw output `Test Files 4 passed │ 1 skipped (5)` and `Tests 46 passed │ 5 skipped (51)`, exit 0. Independently recorded by the WU-5 lane B finding F5 (RPT(5) §5). / WU6-RUN, RPT(5) §5 F5 |
| C39 | V4 — with `DATABASE_URL` **set against a fresh database** it exits 0 with `5 passed (5)` and `51 passed (51)`. / ตั้ง DATABASE_URL กับฐานข้อมูลใหม่ ได้ 5 passed / 51 passed | RPT(5) records the manual's observed `Test Files 5 passed (5)` / `Tests 51 passed (51)` with the database configured; `docs/house-swarm-7/WU5-DEPLOY.md` §6 carries that observation. The document set states it as the recorded observation for the fresh-database case, not as a promise for every database. / RPT(5), WU5-DEPLOY.md §6 |
| C40 | V4 — with `DATABASE_URL` **set against a database the suite has already run against** it exits 1 with `1 failed │ 50 passed (51)`. / ตั้ง DATABASE_URL กับฐานข้อมูลที่เคยรันแล้ว ได้ 1 failed 50 passed | **WU6-RUN, measured by the author of this document**: raw output `Test Files 1 failed │ 4 passed (5)`, `Tests 1 failed │ 50 passed (51)`, failure at `tests/webhook.test.ts:101` `expected 'active' to be 'cancelled'`. Root cause observed in the same run: `billing_event_ledger` already contained `evt_apply_1`, and the ledger's idempotency skipped the second delivery, so the applied state never changed. / WU6-RUN |
| C41 | V5 — `/health` answers `{"ok":true}` and the landing page answers 200. / `/health` ตอบ {"ok":true} และหน้าแรกตอบ 200 | WT `server/src/app.ts:44` `app.get('/health', … res.json({ ok: true }))`; WT `server/tests/server.test.ts:34` asserts 200 and `{ ok: true }` over real HTTP. CG(2) `GET_/health_status=200`. / WT test, CG(2) |
| C42 | V6 — `npx tsx scripts/proofs/wu2/migrate-runner-proof.mts` prints `migration_runner_idempotent=true` and exits 0. / พิมพ์ค่านั้นและออกด้วย 0 | WU6-RUN: observed exactly that, exit 0 (see C20). / WU6-RUN |
| C43 | V7 — `node scripts/proofs/wu3/quota-proof.mjs` prints six `CHECK … PASS` lines including the 429 with `provider_fetch_attempts=0`. / ได้ CHECK PASS หกบรรทัด | CG(3) `SUMMARY checks=6 passed=6 failed=0` plus the six named CHECK lines, including `over-quota-is-refused-before-provider … provider_fetch_attempts=0`. / CG(3) |
| C44 | V8 — i18n-parity prints eight `CHECK … PASS` lines including `keys_per_locale=th:124 en:124`, and e2e-web prints nine. / ได้แปดและเก้าบรรทัด | WU6-RUN: i18n-parity → `SUMMARY checks=8 passed=8 failed=0`, exit 0, with the `keys_per_locale=th:124 en:124` line. CG(4) and CG(5) both record `SUMMARY checks=9 passed=9 failed=0` for `e2e-web.mjs`. / WU6-RUN, CG(4), CG(5) |
| C45 | V9 — `node server/scripts/proofs/wu5/deploy-preflight.mjs` prints seven `CHECK … PASS` lines. / ได้เจ็ดบรรทัด | WU6-RUN: observed exactly seven CHECK lines plus `deploy-preflight: all 7 checks PASSED`, exit 0. CG(5) R1 recorded the same seven. / WU6-RUN, CG(5) R1 |
| C46 | V10 — `node server/scripts/proofs/wu6/claims-check.mjs` prints eight `CHECK … PASS` lines, one per required check name. / ได้แปดบรรทัด หนึ่งต่อหนึ่งชื่อ check | WT `server/scripts/proofs/wu6/claims-check.mjs`; the eight names are `sales-docs-bilingual-headings`, `no-price-or-licence-in-sales-docs`, `no-supabase-tested-claim`, `not-implemented-list-complete`, `claims-evidence-covers-claims`, `migrations-proven-by-script`, `node-version-stated-22`, `ui-evidence-described-as-http-html`. The run and its exit code are reported in RPT(6). / WT, RPT(6) |

## 5. Requirements and what the buyer supplies / สิ่งที่ต้องมี และสิ่งที่ผู้ซื้อต้องเตรียม

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C47 | Q1 — Node.js 22 or newer, with npm. / Node.js 22 ขึ้นไป พร้อม npm | Same evidence as C34 (`engines.node = ">=22.0.0"` in the installed dependency). / WT |
| C48 | Q2 — dependencies must be installed inside `server/`. / ต้องติดตั้ง dependency ข้างใน server/ | `server/package.json` (the manifest and all scripts) and `server/package-lock.json` live in `server/`; every documented command runs `cd server` first. There is no root-level `package.json` in WT. / WT |
| C49 | Q3 — PostgreSQL 16 or newer, or your own Supabase Postgres connection string. / PostgreSQL 16 ขึ้นไป หรือ connection string ของ Supabase Postgres ของคุณเอง | WT `server/.env.example` documents `DATABASE_URL` as the PostgreSQL connection string; `docs/house-swarm-7/WU5-DEPLOY.md` §4 documents both paths and states there is no default or fallback address. / WT, WU5-DEPLOY.md §4 |
| C50 | Q4 — `modules/` and `web/` must sit beside `server/`: the server imports from `../../../modules/` at runtime and reads pages from `../web/`. / ต้องมี modules/ และ web/ ข้าง server/ | WT `server/src/lib/ai.ts:5,9`, `payments.ts:4,8,9`, `quota.ts:30-32`, `subscriptions.ts:5,9,15`, `web-pages.ts:24`, `middleware/auth.ts:2-3`, `demo-auth.ts:2`, `tenant.ts:2` all import `../../../modules/…`; WT `server/src/lib/web-pages.ts:22` imports `../../../web/assets/i18n.js` and line 27 sets `WEB_ROOT = join(here, '../../../web')`. / WT source |
| C51 | Q5 — a process supervisor and TLS of your own; the Express process speaks plain HTTP. / supervisor และ TLS ของคุณเอง | WT `server/src/index.ts` calls `app.listen(port, …)` with no TLS options; `docs/house-swarm-7/WU5-DEPLOY.md` §4.3 states the process does not terminate TLS. No supervisor, proxy or compose file exists in WT. / WT, WU5-DEPLOY.md §4.3 |
| C52 | S1 — your own PostgreSQL database or your own Supabase Postgres connection string; no default, no bundled instance, no fallback address. / ฐานข้อมูลของคุณเอง ไม่มีค่าเริ่มต้น/ที่อยู่สำรอง | WT `server/src/lib/persistence/pg.ts` `getPgPool()` returns nothing when `DATABASE_URL` is unset, and `server/src/index.ts` then reports `persistent=false` instead of falling back. / WT source |
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
(ก) การไม่มีอยู่ของเส้นทางโค้ด และ (ข) ที่ที่เรดิสทอรีจงใจตอบด้วยรหัส "ยังไม่ได้ทำ" —
พฤติกรรมการปฏิเสธที่เห็นได้ แต่ละแถวล่างนี้ระบุทั้งสองอย่าง เมื่อมีทั้งสองอย่าง

| # | Claim in the sales documents / คำกล่าวอ้าง | Evidence / หลักฐาน |
|---|---|---|
| C56 | N1 — no OpenTelemetry exporter; traces are held in process memory only; no OTLP endpoint. / ไม่มี OpenTelemetry exporter เก็บ span ในหน่วยความจำเท่านั้น | WT `modules/enterprise-features/core/tracer.ts` implements `NoopTracer` and `MemoryTracer` only (`MemoryTracer` pushes to `this.completedSpans`; there is no export path). `grep -rn -i otlp server/src server/package.json modules/webhook-receiver` → 0 matches. / WU6-RUN |
| C57 | N2 — no LINE webhook verifier; it answers `WEBHOOK_UNKNOWN_PROVIDER`. / ไม่มีตัวตรวจสอบ webhook ของ LINE ตอบ WEBHOOK_UNKNOWN_PROVIDER | WT `modules/webhook-receiver/providers/line/index.ts:10` returns the code `'WEBHOOK_UNKNOWN_PROVIDER'` and states it is not implemented. / WT source |
| C58 | N3 — no GitHub webhook verifier; same behaviour. / ไม่มีของ GitHub พฤติกรรมเดียวกัน | WT `modules/webhook-receiver/providers/github/index.ts:10` returns the same code. / WT source |
| C59 | N4 — Supabase auth has never been verified against a real project and is untested; a buyer's Supabase Postgres connection string works; the persistence layer is not Supabase-backed and uses the pg driver. / auth Supabase ยังไม่ถูกทดสอบ connection string ของผู้ซื้อใช้ได้ ชั้น persistence ไม่ใช่ Supabase-backed ใช้ pg | The auth path exists in WT (`server/src/lib/supabase.ts`, `server/src/middleware/auth.ts`, `modules/auth-supabase/`) and no Supabase project is reachable from this work. The persistence layer uses `pg`: WT `server/src/lib/persistence/pg.ts` imports and pools from `pg`, and WT `server/src/lib/persistence/pg-repositories.ts` issues SQL through that pool. RPT(2) §7 records the test database as a **local** PostgreSQL instance, not a Supabase project. See the honesty note at the end of this file. / WT source, RPT(2) §7 |
| C60 | N5 — the rate limit on `POST /payment/webhook` is in-process only: the route has a limit, but a multi-instance deployment shares no counter and one key covers the endpoint rather than the caller. / rate limit บนเส้นทางนี้เป็นแบบในโปรเซสเดียว | WT `server/src/app.ts` mounts `webhookRateLimitMiddleware` first on `POST /payment/webhook`, ahead of `express.raw()` and the handler; WT `server/src/lib/rate-limit.ts` composes the key (`route:POST /payment/webhook`), reads the two env vars and maps a refusal to 429; WT `modules/rate-limit/` is the vendored Module Hub module with its provenance at `modules/rate-limit/PROVENANCE-RATELIMIT.md`. Observed in this work unit: `npx vitest run tests/webhook-rate-limit.test.ts` → 7 passed (7), and `node scripts/proofs/fu/ratelimit-proof.mjs` → 5 checks, 5 passed, 0 failed, with `HTTP 429 code=RATE_LIMITED` and `Retry-After "12"`. The single-process limit is the module's own documented one (`modules/rate-limit/MODULE.md`, §Known limitation) and is stated in `docs/house-swarm-7/FU-RATELIMIT.md`. / WU6-RUN (this follow-up), FU-RATELIMIT.md |
| C61 | N6 — no deployment has ever been performed anywhere; the product has been run on a developer machine against a local PostgreSQL only; no multi-instance proof. / ไม่เคย deploy ที่ใดเลย รันบนเครื่องนักพัฒนา กับ local PostgreSQL เท่านั้น ไม่มีหลักฐานหลายอินสแตนซ์ | `docs/house-swarm-7/WU5-DEPLOY.md` §1 states this about itself; RPT(5) §6 item 2 records it in the controller's own words; WT is a worktree and nothing in it records a deployment. The local test database is a machine-local PostgreSQL instance (RPT(2) §7). / WU5-DEPLOY.md §1, RPT(5) §6 |
| C62 | N7 — payments and AI providers need your own keys; no live charge and no live provider call was made. / ต้องใช้คีย์ของคุณเอง ไม่มีการเรียกเก็บเงินหรือเรียกผู้ให้บริการจริง | CG(3) and CG(4) harnesses stub `globalThis.fetch` to block real egress and count attempts; CG(4) G7 reports `call1_provider_calls=1` against a **stub**, and `branch=no-provider-configured` on this machine. The Stripe adapter is exercised through the mock/webhook path, not a live charge. / CG(3), CG(4) G7 |
| C63 | The UI evidence is HTTP-level and saved HTML, there are no screenshots, no headless browser was driven, and no claim is made about layout, styling or JS behaviour. / หลักฐาน UI เป็น HTTP/HTML ไม่มีภาพหน้าจอ ไม่ได้ขับเบราว์เซอร์ | CG(4) G8 lists the ten saved HTML files; RPT(4) §6 item 5 states in the controller's own words that the pages were not tested in a real browser and that the evidence is HTTP + saved HTML, not screenshots. A sweep of WT for `*.png/jpg/jpeg/gif/webp` finds 0 files. / CG(4) G8, RPT(4) §6, WU6-RUN |
| C64 | `npm test` writes subscription and ledger rows into the configured database and does not clean them up. / `npm test` เขียนแถวลงฐานข้อมูลและไม่ลบให้ | **WU6-RUN, measured by the author of this document**: row counts before the run `{"subscriptions":5,"billing_event_ledger":3,"usage_counters":0}` and after `{"subscriptions":7,"billing_event_ledger":3,"usage_counters":0}`. The leftover rows carry the ids `acct_apply_…` and `acct_replay_…` created by `tests/webhook.test.ts`; the two cleanup statements in `tests/postgres-persistence.test.ts` are scoped to its own `ACCOUNT_ID` only. / WU6-RUN |

## 7. Claims deliberately removed for lack of evidence / คำกล่าวอ้างที่ตั้งใจตัดออก เพราะไม่มีหลักฐาน

These were considered for the sales copy and **removed**, because no real evidence
could be attached to them. They are listed here so a reviewer can see they were
considered and dropped rather than quietly softened.

รายการเหล่านี้ถูกพิจารณาใส่ในข้อความขายแล้ว **ตัดออก** เพราะไม่มีหลักฐานจริงรองรับ
ระบุไว้ตรงนี้เพื่อให้ผู้ตรวจเห็นว่าถูกพิจารณาและตัดออก ไม่ใช่ถูกลดความลงเงียบ ๆ

| # | Claim considered / คำกล่าวอ้างที่พิจารณา | Why it was removed / เหตุผลที่ตัดออก |
|---|---|---|
| X1 | "The migrations have been proven to work" — as an unsupported sentence. / "migration พิสูจน์แล้ว" แบบไม่มีที่มา | Dropped in that bare form. Every sentence about the migration proof in the final documents **names the script** (`server/scripts/proofs/wu2/migrate-runner-proof.mts`) and the observation it prints (`migration_runner_idempotent=true`), per the work unit's rule that the proof must be named. / ต้องระบุวิธีพิสูจน์ทุกครั้ง |
| X2 | "Works with Supabase" / "Supabase-ready" / "tested with Supabase". / "ใช้กับ Supabase ได้" / "ทดสอบกับ Supabase แล้ว" | Removed entirely. Supabase auth has never been exercised against a real project and the persistence layer is not Supabase-backed, so no such claim can be evidenced. The final documents say the opposite, in both languages (N4 / C59). / ตัดออกทั้งหมด เพราะพิสูจน์ไม่ได้ |
| X3 | "Production-ready" / "production-grade" / "hardened". / "พร้อมใช้งาน production" / "แข็งแรง" | Removed. No deployment was ever performed, there was no rate limiting on the payment webhook at the time this claim was assessed, and there is no multi-instance proof. The documents instead carry the explicit limits N5, N6 and the closing "not validated by a different party" statement. (The rate-limit gap named here has since been closed by the follow-up work unit H7-FU-RATELIMIT — see the N5 row C60 — but the claim stays removed, because N5 is now a different limit rather than no limit.) / ตัดออก เพราะยังไม่มีหลักฐานรองรับ |
| X4 | "Zero-configuration" or "just clone and run". / "ไม่ต้องตั้งค่าอะไร" / "โคลนแล้วรันได้เลย" | Removed. `DATABASE_URL` is required for persistence, an AI provider key is required to reach the paid route, and migrations create the schema on first start. Section 7 and section 8 state these requirements instead. / ตัดออก เพราะต้องตั้งค่าจริง |
| X5 | "The UI has been visually verified" / any statement about how it looks. / "ตรวจ UI ด้วยตาแล้ว" | Removed. The UI evidence is HTTP-level and saved HTML; there are no screenshots and no headless browser run, so nothing about appearance can be claimed. The documents say exactly that (C63). / ตัดออก เพราะไม่มีภาพหน้าจอ |
| X6 | "Handles multiple instances" / "horizontally scalable". / "รองรับหลายอินสแตนซ์" | Removed. No multi-instance deployment proof exists; the in-memory fallback is per-process. Stated as limit N6. / ตัดออก เพราะไม่มีหลักฐาน |
| X7 | Any price, licence, currency, entitlement to resell, or purchase link. / ราคา license สกุลเงิน สิทธิ์การขายต่อ หรือลิงก์ซื้อ | Never included. Pricing and licensing are the Owner's decision and are explicitly outside this work unit's scope; where a price would appear, both documents state that commercial terms are provided separately and are not part of the document. Verified mechanically by the `no-price-or-licence-in-sales-docs` check. / นอกขอบเขตของใบงาน |
| X8 | "The test suite passes" — as an unconditional statement. / "ชุดเทสต์ผ่าน" แบบไม่มีเงื่อนไข | Weakened to the three measured cases with their exact counts (C38–C40), because the author's own run on a used database **failed** (1 failed | 50 passed). The unconditional form would have been false on a database the suite had already run against. / อ่อนลงตามที่วัดจริง |
| X9 | "All six tables are created by the migrations, proven by the migration script." / "migration สร้างตารางทั้งหก พิสูจน์ด้วยสคริปต์" | Kept, but the attribution was tightened: the six tables **are** observed by `migrate-runner-proof.mts` (`OBSERVATION tables=[…]`) and by `db-check.mjs`, and are read out of both migration files. The claim does not say the script created them in every environment. / คงไว้ แต่ระบุที่มาให้แคบลง |
| X10 | "Everything in this kit has been independently verified." / "ทุกอย่างในคิทนี้ถูกตรวจโดยอิสระแล้ว" | Removed. Parts of the kit were verified by a different agent in earlier layers (CG logs), but this document set has **not** been validated by a different party, and the WU-5 deployment manual records that it had not been walked through by another agent when it was written. Both sales documents close with that statement. / ตัดออก เพราะยังไม่จริงสำหรับเอกสารชุดนี้ |

---

## 8. Standing honesty constraints for this document set / ข้อกำหนดความซื่อสัตย์ถาวรของเอกสารชุดนี้

1. **No claim anywhere states or implies that anything was tested, run, verified or
   exercised with Supabase.** The permitted statements are exactly: a buyer's own
   Supabase Postgres connection string works because the connection is plain
   PostgreSQL through `pg`, and the Supabase auth product is untested. This is
   enforced mechanically by the `no-supabase-tested-claim` check in
   `server/scripts/proofs/wu6/claims-check.mjs`.
   / **ไม่มีข้อใดกล่าวหรือสื่อว่าอะไรถูกทดสอบ/รัน/ตรวจกับ Supabase** สิ่งที่อนุญาตมีเท่านั้น:
   connection string ของ Supabase Postgres ของผู้ซื้อใช้ได้ เพราะต่อเป็น PostgreSQL ธรรมดา
   ผ่าน `pg` และตัวผลิตภัณฑ์ auth ของ Supabase ยังไม่ถูกทดสอบ
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

**One statement about this file itself.** This map has not been reviewed by a
different party, and it is not an approval of the sales copy. It is a row-by-row
index from claim to evidence, written by the same author as the documents it
indexes; a reviewer who disagrees with a row should treat the evidence location as
the authority, not this table.

**ข้อความหนึ่งเกี่ยวกับไฟล์นี้เอง** แผนที่นี้ยังไม่ถูกตรวจโดยบุคคลอื่น และไม่ใช่การอนุมัติ
ข้อความขาย มันคือดัชนีจากคำกล่าวอ้างไปยังหลักฐาน ทีละแถว เขียนโดยผู้เขียนคนเดียวกับเอกสาร
ที่มันจัดทำดัชนี ผู้ตรวจที่ไม่เห็นด้วยกับแถวใด ควรถือที่อยู่หลักฐานเป็นข้อยุติ ไม่ใช่ตารางนี้
