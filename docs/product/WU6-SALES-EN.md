# WU-6 Sales Document — Multi-Tenant AI Starter Kit (MT01) / เอกสารขาย WU-6 — Multi-Tenant AI Starter Kit (MT01)

This is the English document. Its Thai counterpart is `docs/product/WU6-SALES-TH.md`.
Every factual claim in both documents is mapped to named evidence, row by row, in
`docs/product/WU6-CLAIMS-EVIDENCE.md`, and the claims a machine can check are
re-checked by `server/scripts/proofs/wu6/claims-check.mjs`.

---

## 1. What you are getting, in one paragraph you can repeat / สิ่งที่คุณได้รับ ในย่อหน้าเดียวที่คุณพูดต่อได้

**One paragraph, repeatable.** The Multi-Tenant AI Starter Kit is a working
Express reference server, written in TypeScript, that shows how to run a
multi-tenant AI product on PostgreSQL: it keeps tenants, plans, subscriptions and
a billing-event ledger in a real database, applies its own two SQL migrations at
start-up, enforces a paid-resource quota inside the database **before** it spends
money on an AI provider, serves a five-page sample web UI in Thai and English
from the same server, and ships the proof harnesses that produced every number in
this document. It is a reference implementation plus its evidence — not a hosted
service, not a finished product, and not a deployment.

**ย่อหน้าเดียว พูดต่อได้** Multi-Tenant AI Starter Kit คือ Express reference server ตัวจริง
เขียนด้วย TypeScript แสดงวิธีทำสินค้า AI แบบหลายผู้เช่าบน PostgreSQL: เก็บ tenant, แพ็กเกจ,
subscription และ ledger ของเหตุการณ์บิลในฐานข้อมูลจริง รัน SQL migration สองไฟล์ของตัวเอง
ตอนสตาร์ท บังคับโควตาทรัพยากรที่มีค่า **ในฐานข้อมูล** ก่อนที่จะเสียเงินกับผู้ให้บริการ AI
เสิร์ฟหน้าเว็บตัวอย่างห้าหน้าเป็นไทยและอังกฤษจากเซิร์ฟเวอร์เดียวกัน และแถม harness พิสูจน์
ที่ให้ตัวเลขทุกตัวในเอกสารนี้ มันคือ reference implementation พร้อมหลักฐานของมัน —
ไม่ใช่บริการโฮสต์ ไม่ใช่สินค้าที่เสร็จสมบูรณ์ และไม่ใช่การ deploy

**Commercial terms.** Commercial terms are provided separately and are not part
of this document. Nothing below is a statement of what anything costs, of what
you may do with the code, or of where to obtain it.

**เงื่อนไขทางการค้า** เงื่อนไขทางการค้าจะแจ้งแยกต่างหาก และไม่ใช่ส่วนหนึ่งของเอกสารนี้
ไม่มีข้อใดข้างล่างนี้เป็นการระบุว่าอะไรมีค่าใช้จ่ายเท่าไร คุณทำอะไรกับโค้ดได้ หรือหาได้ที่ไหน

---

## 2. The problem it solves and who it is for / ปัญหาที่มันแก้ และมันทำเพื่อใคร

**The problem.** Putting an AI feature behind a paid plan sounds like one task and
is really four: knowing which tenant is calling; keeping plans, subscriptions and
entitlements in durable storage rather than in process memory; counting and
refusing paid usage before the provider is called, so an over-quota account cannot
spend your money; and being able to show, afterwards, what was actually observed
rather than what was intended.

**ปัญหาที่แก้** การวางฟีเจอร์ AI ไว้หลังแพ็กเกจที่จ่ายเงิน ดูเหมือนงานเดียว แต่จริง ๆ มีสี่ส่วน:
รู้ว่าผู้เช่าคนไหนกำลังเรียก; เก็บแพ็กเกจ subscription และ entitlement ไว้ในที่ถาวรไม่ใช่ใน
หน่วยความจำของโปรเซส; นับและปฏิเสธการใช้ทรัพยากรที่มีค่าก่อนจะเรียกผู้ให้บริการ เพื่อให้บัญชี
ที่เกินโควตาใช้เงินคุณไม่ได้; และทำให้แสดงย้อนหลังได้ว่า **เห็นอะไรจริง** ไม่ใช่ **ตั้งใจจะทำอะไร**

**Who it is for.** A backend engineer or technical founder who is about to charge
for an AI feature and wants a small, complete, readable reference to read first —
someone who will judge this by running it, not by reading a brochure. It is a
starting point to copy from, and it is written to be checked.

**ทำเพื่อใคร** วิศวกรแบ็กเอนด์หรือผู้ก่อตั้งสายเทคนิคที่กำลังจะคิดเงินกับฟีเจอร์ AI และอยากได้
ตัวอย่างอ้างอิงที่เล็ก ครบ และอ่านออก ก่อนลงมือ — คนที่จะตัดสินมันด้วยการรันจริง ไม่ใช่ด้วย
การอ่านโบรชัวร์ มันคือจุดเริ่มต้นให้คัดลอก และถูกเขียนขึ้นให้ตรวจสอบได้

---

## 3. What you actually receive / สิ่งที่คุณได้รับจริง

The repository as it stands. Nothing in this list is a promise about a future
version.

ที่เก็บโค้ดตามที่เป็นอยู่จริง ไม่มีข้อใดในรายการนี้เป็นคำมั่นเกี่ยวกับเวอร์ชันในอนาคต

- **R1 — `server/src`**: 17 TypeScript source files — the Express app, the route
  handlers, the middleware, and the library code for persistence, quota and the
  page shell. / **R1 — `server/src`**: ไฟล์ TypeScript 17 ไฟล์ — ตัวแอป Express,
  ตัวจัดการเส้นทาง, middleware และโค้ดไลบรารีสำหรับ persistence, โควตา และเชลล์ของหน้าเว็บ
- **R2 — `server/migrations`**: exactly two SQL files, `0001_persistence.sql` and
  `0002_usage.sql`. / **R2 — `server/migrations`**: ไฟล์ SQL สองไฟล์เท่านั้น
- **R3 — `server/tests` and `server/package.json`**: five test files, plus a
  manifest declaring exactly three runtime dependencies — `express`, `pg` and
  `@supabase/supabase-js`. / **R3 — `server/tests` และ `server/package.json`**:
  ไฟล์เทสต์ห้าไฟล์ และ manifest ที่ประกาศ runtime dependency สามตัวเท่านั้น
- **R4 — `modules/`**: seven reusable modules — `ai-provider`, `auth-supabase`,
  `enterprise-features`, `payment`, `subscription`, `tenant-context`,
  `webhook-receiver`. / **R4 — `modules/`**: โมดูลนำกลับมาใช้ได้เจ็ดตัว
- **R5 — `web/`**: the five sample pages (`index`, `signup`, `login`, `plans`,
  `app`) and four asset files (`app.css`, `app.js`, `i18n.js`, `i18n.d.ts`).
  / **R5 — `web/`**: หน้าตัวอย่างห้าหน้า และไฟล์ asset สี่ไฟล์
- **R6 — `scripts/house-swarm-7/`**: the setup script `setup.sh`, its document
  `setup.md`, and `db-check.mjs`. / **R6 — `scripts/house-swarm-7/`**: สคริปต์ตั้งค่า
  `setup.sh`, เอกสาร `setup.md` และ `db-check.mjs`
- **R7 — `server/scripts/proofs/`**: the proof harnesses for layers WU-2 to WU-6,
  plus ten saved HTML pages under `server/scripts/proofs/wu4/wu4-e2e/`.
  / **R7 — `server/scripts/proofs/`**: harness พิสูจน์ของชั้น WU-2 ถึง WU-6 และหน้า
  HTML ที่บันทึกไว้สิบไฟล์ใต้ `server/scripts/proofs/wu4/wu4-e2e/`

Also in the tree: the operating documents under `docs/product/`
(`WU3-PAID-ROUTE-INVENTORY.md`, `WU4-SAMPLE-UI.md`, `WU5-DEPLOY.md`, this document
set), `BRIEF.md`, and `STAGE3_EVIDENCE_REPORT.md`.

ในทรีเดียวกันยังมีเอกสารปฏิบัติงานใต้ `docs/product/` (`WU3-PAID-ROUTE-INVENTORY.md`,
`WU4-SAMPLE-UI.md`, `WU5-DEPLOY.md`, ชุดเอกสารนี้), `BRIEF.md` และ `STAGE3_EVIDENCE_REPORT.md`

---

## 4. What it does — the measured behaviours / มันทำอะไร — พฤติกรรมที่วัดได้จริง

Each item below is a behaviour that was observed, not a design intention. The
observation behind each one is named.

แต่ละข้อด้านล่างคือพฤติกรรมที่ **เห็นจริง** ไม่ใช่ความตั้งใจในแบบออกแบบ หลักฐานของแต่ละข้อ
ถูกระบุไว้

- **B1 — Migrations run at start-up and are idempotent.** There are exactly two
  migration files; `server/src/index.ts` applies them **before** the port opens,
  and the six tables that result are `billing_event_ledger`, `plans`,
  `schema_migrations`, `subscriptions`, `tenants`, `usage_counters`. Running the
  server a second time applies nothing and prints no error.
  / **B1 — migration รันตอนสตาร์ทและรันซ้ำได้** มี migration สองไฟล์เท่านั้น
  `server/src/index.ts` รันมัน **ก่อน** เปิดพอร์ต และได้ตารางหกตารางตามรายชื่อนี้
  สตาร์ทเซิร์ฟเวอร์ครั้งที่สองจะไม่ทำอะไรเพิ่มและไม่พิมพ์ข้อผิดพลาด
- **B2 — The migrations are proven, and the proof has a name.**
  `server/scripts/proofs/wu2/migrate-runner-proof.mts` runs the real migration
  runner three times, reads `schema_migrations` back, creates a subscription
  through the subscription core and reads the row back out of PostgreSQL, prints
  `migration_runner_idempotent=true`, and exits 0.
  / **B2 — migration ถูกพิสูจน์แล้ว และการพิสูจน์มีชื่อระบุได้**
  `server/scripts/proofs/wu2/migrate-runner-proof.mts` รันตัวรัน migration ของจริงสามครั้ง
  อ่าน `schema_migrations` กลับ สร้าง subscription ผ่าน core แล้วอ่านแถวกลับจาก PostgreSQL
  พิมพ์ `migration_runner_idempotent=true` และออกด้วยรหัส 0
- **B3 — The quota gate is enforced in the database with one atomic statement.**
  The counter increment is a single `INSERT ... ON CONFLICT ... DO UPDATE ...`
  statement with a `RETURNING`: no read-then-write, no SELECT first, and the
  update target is the table's own column plus the proposed row. Sixteen
  concurrent increments from two independent pools produced sixteen distinct
  values and a final counter of sixteen.
  / **B3 — ประตูโควตาถูกบังคับในฐานข้อมูลด้วยคำสั่งเดียวแบบ atomic** การเพิ่มตัวนับเป็น
  คำสั่งเดียว มี `RETURNING` ไม่มีการอ่านก่อนเขียน และไม่มีการ SELECT ก่อน การเพิ่มพร้อมกัน
  16 ครั้งจากสองพูลอิสระให้ค่าที่แตกต่างกัน 16 ค่า และตัวนับสุดท้ายเท่ากับ 16
- **B4 — An account with no entitlement is refused before anything is spent.**
  Over real HTTP, an account with no subscription gets **402** with code
  `QUOTA_NOT_ENTITLED` from the paid AI route.
  / **B4 — บัญชีที่ไม่ได้รับสิทธิ์ถูกปฏิเสธก่อนจะเสียอะไรไป** ผ่าน HTTP จริง บัญชีที่ไม่มี
  subscription ได้ **402** พร้อมรหัส `QUOTA_NOT_ENTITLED` จากเส้นทาง AI ที่มีค่าใช้จ่าย
- **B5 — An account over its quota is refused before the provider is called.**
  Over real HTTP, an account at its plan limit gets **429** with code
  `QUOTA_EXCEEDED`, and the provider was never called: the harness recorded
  `provider_fetch_attempts=0`. A refusal does not consume.
  / **B5 — บัญชีที่เกินโควตาถูกปฏิเสธก่อนเรียกผู้ให้บริการ** ผ่าน HTTP จริง บัญชีที่ถึงลิมิต
  ของแพ็กเกจได้ **429** พร้อมรหัส `QUOTA_EXCEEDED` และผู้ให้บริการไม่ถูกเรียกเลย harness
  บันทึก `provider_fetch_attempts=0` การปฏิเสธไม่กินโควตา
- **B6 — A successful call consumes exactly one unit; a failed call consumes
  none.** Observed with the provider transport stubbed: the counter went
  `0 -> 1 -> 2` over two successful calls, and a call whose provider returned an
  error left the counter unchanged.
  / **B6 — การเรียกที่สำเร็จกินหนึ่งหน่วยพอดี การเรียกที่ล้มเหลวไม่กินเลย** เห็นจริงโดย stub
  การขนส่งไปผู้ให้บริการ: ตัวนับเป็น `0 -> 1 -> 2` ในการเรียกที่สำเร็จสองครั้ง และการเรียกที่
  ผู้ให้บริการตอบผิดพลาดทำให้ตัวนับไม่ขยับ
- **B7 — The sample UI is five pages, Thai and English, with no external
  dependencies.** The same server serves `index`, `signup`, `login`, `plans` and
  `app`, each in Thai and English; the dictionary carries **124 keys per
  language** and the two key sets are identical; there is **no CDN, no web font,
  no stock image and no new UI framework**.
  / **B7 — UI ตัวอย่างมีห้าหน้า ไทยและอังกฤษ และไม่พึ่งของภายนอก** เซิร์ฟเวอร์เดียวกันเสิร์ฟ
  `index`, `signup`, `login`, `plans` และ `app` ทั้งภาษาไทยและอังกฤษ พจนานุกรมมี
  **124 คีย์ต่อภาษา** และชุดคีย์ของสองภาษาเหมือนกันทุกตัว **ไม่มี CDN ไม่มีเว็บฟอนต์
  ไม่มีภาพสต็อก และไม่เพิ่ม UI framework ใหม่**
- **B8 — There is a demonstration identity mode, it is off by default, and it is
  not authentication.** `DEMO_AUTH` is opt-in; when it is switched on while
  `NODE_ENV=production` the server refuses to activate it — over real HTTP the
  protected route answers **503** with code `DEMO_AUTH_REFUSED_IN_PRODUCTION`.
  It establishes identity from a header the caller types, with no password, no
  user record and no signature, and it must never be enabled where real users or
  real data are involved.
  / **B8 — มีโหมดตัวตนสาธิต ปิดอยู่โดยค่าเริ่มต้น และไม่ใช่การยืนยันตัวตน** `DEMO_AUTH`
  ต้องเปิดเอง เมื่อเปิดพร้อม `NODE_ENV=production` เซิร์ฟเวอร์ปฏิเสธที่จะเปิดใช้งาน —
  ผ่าน HTTP จริง เส้นทางที่ป้องกันไว้ตอบ **503** พร้อมรหัส `DEMO_AUTH_REFUSED_IN_PRODUCTION`
  มันสร้างตัวตนจาก header ที่ผู้เรียกพิมพ์เอง ไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้ และไม่มีลายเซ็น
  และต้องไม่ถูกเปิดที่ใดที่มีผู้ใช้จริงหรือข้อมูลจริง
- **B9 — There is no `.env` reader, and Node.js 22 or newer is required.**
  Configuration arrives through the process environment only; there is no dotenv
  anywhere and nothing reads a `.env` file. The installed
  `@supabase/supabase-js` declares `engines.node = ">=22.0.0"`, so Node.js 22 is a
  hard floor. / **B9 — ไม่มีตัวอ่าน `.env` และต้องใช้ Node.js 22 ขึ้นไป**
  คอนฟิกมาทาง process environment เท่านั้น ไม่มี dotenv ที่ไหน และไม่มีอะไรอ่านไฟล์ `.env`
  ตัว `@supabase/supabase-js` ที่ติดตั้งอยู่ประกาศ `engines.node = ">=22.0.0"`
  ดังนั้น Node.js 22 คือพื้นขั้นต่ำ

**How the UI was observed, stated plainly.** The evidence for the sample UI is
**HTTP-level and saved HTML**: real HTTP responses, and the ten HTML files the
harness saved under `server/scripts/proofs/wu4/wu4-e2e/`. There are **no
screenshots**, no headless browser was driven, and no claim is made about layout,
styling or JavaScript behaviour in a real browser.

**หลักฐานของ UI ระบุตรง ๆ** หลักฐานของหน้าเว็บตัวอย่างเป็น **ระดับ HTTP และ HTML ที่บันทึกไว้**:
คำตอบ HTTP จริง และไฟล์ HTML สิบไฟล์ที่ harness บันทึกไว้ใต้
`server/scripts/proofs/wu4/wu4-e2e/` **ไม่มีภาพหน้าจอ** ไม่ได้ขับเบราว์เซอร์จริง และไม่มีการ
อ้างเรื่องการจัดวาง การตกแต่ง หรือพฤติกรรม JavaScript ในเบราว์เซอร์จริง

---

## 5. How to verify every claim yourself / วิธีตรวจทุกคำกล่าวอ้างด้วยตัวคุณเอง

Run these yourself. Each line names the command and the observation that means it
worked. Substitute your own database connection string for the placeholder — this
document contains no address of anyone's database, and there is none in the
repository to copy.

รันเองได้ ทุกบรรทัดระบุคำสั่งและสิ่งที่ต้องเห็นจึงจะถือว่าได้ผล ให้แทนที่ connection string
ของฐานข้อมูลด้วยของคุณเอง — เอกสารนี้ไม่มีที่อยู่ฐานข้อมูลของใครเลย และไม่มีในที่เก็บโค้ดนี้ให้คัดลอก

- **V1** — `node --version` → `v22.` or higher. / **V1** — `node --version` → `v22.` ขึ้นไป
- **V2** — `cd server && npm ci` → exits 0 and installs the three runtime
  dependencies `express`, `pg`, `@supabase/supabase-js`. / **V2** — ติดตั้ง
  dependency สามตัวนั้น และออกด้วย 0
- **V3** — `cd server && npm run typecheck` → exits 0 and prints no type error.
  / **V3** — ออกด้วย 0 และไม่พิมพ์ type error
- **V4** — `cd server && npm test`, in two cases, both observed:
  with `DATABASE_URL` **unset** → exits 0 with `Test Files 6 passed | 1 skipped (7)`
  and `Tests 66 passed | 5 skipped (71)` (measured in this work unit); the five
  skipped tests are `tests/postgres-persistence.test.ts`'s, which skips itself when
  no database is configured;
  with `DATABASE_URL` **set** → exits 0 with `Test Files 7 passed (7)` and
  `Tests 71 passed (71)` (measured in this work unit). So: the database-backed test
  file only runs when `DATABASE_URL` is set, and the full-suite figures hold **only**
  under that condition; and the suite is **repeatable** — it deletes the rows it
  created, so the same database can be used run after run. These are the same two
  observations stated in section 6 and in `docs/product/WU5-DEPLOY.md` §6.1.
  / **V4** — `cd server && npm test` ในสองกรณี ซึ่งเห็นจริงทั้งสอง: ไม่ตั้ง
  `DATABASE_URL` → ออกด้วย 0 ด้วย `Test Files 6 passed | 1 skipped (7)` และ
  `Tests 66 passed | 5 skipped (71)` (วัดในใบงานนี้) โดยห้าเทสต์ที่ข้ามคือของ
  `tests/postgres-persistence.test.ts` ซึ่งข้ามตัวเองเมื่อไม่มีฐานข้อมูล;
  ตั้ง `DATABASE_URL` → ออกด้วย 0 ด้วย `Test Files 7 passed (7)` และ
  `Tests 71 passed (71)` (วัดในใบงานนี้) สรุป: ไฟล์เทสต์ที่ใช้ฐานข้อมูลจะรันก็ต่อเมื่อ
  ตั้ง `DATABASE_URL` และตัวเลขครบชุดเกิด**เฉพาะ**เมื่อมีเงื่อนไขนั้น และชุดเทสต์นี้
  **รันซ้ำได้** — มันลบแถวที่ตัวเองสร้างทิ้ง ใช้ฐานข้อมูลเดิมซ้ำได้ทุกรอบ
  นี่คือการสังเกตสองข้อเดียวกับที่ระบุในข้อ 6 และใน `docs/product/WU5-DEPLOY.md` §6.1
- **V5** — `cd server && DATABASE_URL='<your own connection string>' npm run start`,
  then `curl -s http://127.0.0.1:3003/health` → `{"ok":true}`, and
  `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/` → `200` (the
  sample UI landing page is served). / **V5** — สตาร์ทแล้ว `/health` ตอบ
  `{"ok":true}` และหน้าแรกของ UI ตอบ `200`
- **V6** — `cd server && npx tsx scripts/proofs/wu2/migrate-runner-proof.mts` →
  prints its `OBSERVATION` lines including `migration_runner_idempotent=true` and
  exits 0. / **V6** — พิมพ์บรรทัด `OBSERVATION` รวมทั้ง
  `migration_runner_idempotent=true` และออกด้วย 0
- **V7** — `cd server && node scripts/proofs/wu3/quota-proof.mjs` → six
  `CHECK ... PASS` lines, including the 429 refusal with
  `provider_fetch_attempts=0`. / **V7** — ได้บรรทัด `CHECK ... PASS` หกบรรทัด
  รวมการปฏิเสธ 429 ที่ `provider_fetch_attempts=0`
- **V8** — `cd server && node scripts/proofs/wu4/i18n-parity.mjs` → eight
  `CHECK ... PASS` lines including `keys_per_locale=th:124 en:124`, and
  `cd server && node scripts/proofs/wu4/e2e-web.mjs` → nine `CHECK ... PASS` lines
  plus the saved HTML files. / **V8** — ได้ `CHECK ... PASS` แปดบรรทัด รวม
  `keys_per_locale=th:124 en:124` และอีกเก้าบรรทัดจากการรัน e2e พร้อมไฟล์ HTML ที่บันทึกไว้
- **V9** — `node server/scripts/proofs/wu5/deploy-preflight.mjs` → seven
  `CHECK ... PASS` lines about the deployment artifact. / **V9** — ได้
  `CHECK ... PASS` เจ็ดบรรทัดเกี่ยวกับชิ้นงาน deploy
- **V10** — `node server/scripts/proofs/wu6/claims-check.mjs` → nine
  `CHECK ... PASS` lines, one per check name, re-checking the claims in this
  document set; the ninth, `sales-numbers-agree-with-ledger`, compares the
  test-count figures stated here with the ledger's.
  / **V10** — ได้ `CHECK ... PASS` เก้าบรรทัด หนึ่งบรรทัดต่อหนึ่งชื่อ check
  ซึ่งตรวจคำกล่าวอ้างในชุดเอกสารนี้อีกครั้ง โดยบรรทัดที่เก้า
  `sales-numbers-agree-with-ledger` เทียบตัวเลขชุดเทสต์ที่ระบุในเอกสารนี้กับ ledger

Run the same file on the Thai document set: `WU6-SALES-TH.md` is checked by the
same harness, and the harness fails if the two documents disagree on section
headings or on the not-implemented list.

รันไฟล์เดียวกันกับชุดเอกสารภาษาไทยได้: `WU6-SALES-TH.md` ถูกตรวจโดย harness ตัวเดียวกัน และ
harness จะล้มเหลวถ้าเอกสารสองภาษาไม่ตรงกันเรื่องหัวข้อ หรือรายการสิ่งที่ยังไม่ได้ทำ

---

## 6. What is not included and not implemented / สิ่งที่ไม่มีให้ และยังไม่ได้ทำ

Read this section as carefully as section 4. Nothing above should be read as a
claim that any of the following exists.

อ่านข้อนี้ให้ละเอียดเท่าข้อ 4 ไม่มีข้อใดข้างบนควรถูกตีความเป็นคำรับรองว่าสิ่งต่อไปนี้มีอยู่

- **N1 — No OpenTelemetry exporter.** The tracing code records spans **in process
  memory** only. There is no OTLP endpoint and nothing is exported anywhere.
  / **N1 — ไม่มี OpenTelemetry exporter** โค้ด tracing เก็บ span ไว้ **ในหน่วยความจำของโปรเซส**
  เท่านั้น ไม่มี OTLP endpoint และไม่มีการส่งออกไปที่ใดเลย
- **N2 — No LINE webhook verifier.** The LINE provider answers
  `WEBHOOK_UNKNOWN_PROVIDER` and states plainly that it is not implemented.
  / **N2 — ไม่มีตัวตรวจสอบ webhook ของ LINE** ผู้ให้บริการ LINE ตอบ
  `WEBHOOK_UNKNOWN_PROVIDER` และระบุตรง ๆ ว่ายังไม่ได้ทำ
- **N3 — No GitHub webhook verifier.** Same behaviour:
  `WEBHOOK_UNKNOWN_PROVIDER`. / **N3 — ไม่มีตัวตรวจสอบ webhook ของ GitHub** พฤติกรรม
  เดียวกัน: `WEBHOOK_UNKNOWN_PROVIDER`
- **N4 — Supabase has not been tested.** This kit has been tested with PostgreSQL
  16 and has **not** been tested with Supabase; testing against a real Supabase
  project is scheduled before the kit goes on sale. Supabase auth is untested: it
  has never been verified against a real project. The persistence layer is not
  Supabase-backed: it talks to PostgreSQL through the `pg` driver.
  / **N4 — Supabase ยังไม่ถูกทดสอบ** คิทนี้ทดสอบกับ PostgreSQL 16 แล้ว
  แต่ยังไม่ทดสอบกับ Supabase โดยกำหนดทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย
  การยืนยันตัวตน Supabase ยังไม่เคยถูกตรวจกับโปรเจกต์จริง ชั้น persistence
  ไม่ใช่ Supabase-backed: มันคุยกับ PostgreSQL ผ่านไดรเวอร์ `pg`
- **N5 — The rate limit on `POST /payment/webhook` is in-process only.** That
  route now HAS a rate limit: the Module Hub `rate-limit` module is vendored at
  `modules/rate-limit/`. Counting is **per source**, and the delivery's signature is
  verified before the tight count, so **only requests whose signature is wrong** are
  charged to a source's bucket — a correctly-signed delivery is never refused because of
  someone else's flood. A **coarse every-request backstop** sits under that, so total work
  cannot be unbounded; a request over the backstop is refused with **429** `RATE_LIMITED`
  and a `Retry-After` header. What it still does **not** do: its counter
  lives in one process's memory, so a **multi-instance deployment shares no
  counter** and the effective ceiling multiplies by the number of instances; a source is
  a socket address, which is a coarse identity, so an attacker spread over many addresses
  still reaches the backstop; and verifying the signature before counting means a flood
  **does** cost HMAC work, bounded only coarsely by the backstop. It remains
  no substitute for TLS, a supervisor or a shared store, and an edge/proxy rate limit
  remains the real answer under attack. Do not treat it as
  hardened. / **N5 — rate limit บน `POST /payment/webhook` เป็นแบบในโปรเซสเดียว**
  เส้นทางนั้น**มี** rate limit แล้ว: โมดูล `rate-limit` จาก Module Hub ถูก vendor
  ไว้ที่ `modules/rate-limit/` การนับเป็น **แยกตาม source** และมีการตรวจลายเซ็นของคำขอก่อน
  การนับแบบเข้มงวด คำขอที่ลายเซ็น**ผิด**เท่านั้นจึงถูกคิดเข้า bucket ของ source นั้น
  คำขอที่ลายเซ็นถูกต้องจึงไม่ถูกปฏิเสธเพราะการยิงถล่มของคนอื่น ใต้ลงมามี**แบ็กสต็อปหยาบ
  ระดับทุกคำขอ** งานทั้งหมดจึงไม่ไร้ขอบเขต คำขอที่เกินแบ็กสต็อปถูกปฏิเสธด้วย **429**
  `RATE_LIMITED` พร้อม header `Retry-After` สิ่งที่มันยัง**ไม่**ทำ: ตัวนับอยู่ในหน่วยความจำ
  ของโปรเซสเดียว การ deploy **หลายอินสแตนซ์จึงไม่แชร์ตัวนับกัน** เพดานที่แท้จริงจึงคูณตาม
  จำนวนอินสแตนซ์ source คือที่อยู่ซ็อกเก็ตซึ่งเป็นตัวตนแบบหยาบ ผู้โจมตีที่กระจายหลายที่อยู่
  จึงยังไปถึงแบ็กสต็อปได้ และเพราะตรวจลายเซ็นก่อนนับ การยิงถล่มจึง**กินงาน HMAC** จริง
  ถูกจำกัดขอบเขตแค่แบบหยาบด้วยแบ็กสต็อป มันยังแทน TLS, supervisor หรือ shared store ไม่ได้
  และ rate limit ที่ชั้น reverse proxy ยังเป็นคำตอบจริงเมื่อถูกโจมตี อย่าถือว่ามันแข็งแรงแล้ว
- **N6 — No multi-instance deployment proof, and no deployment at all.** No
  deployment has ever been performed anywhere by the authors: the product has been
  run and exercised on a developer machine against a local PostgreSQL only.
  Multi-instance and clustered operation has not been tested, and the in-memory
  fallback is per-process. / **N6 — ไม่มีหลักฐาน deploy หลายอินสแตนซ์ และไม่มีการ
  deploy เลย** ไม่เคยมีการ deploy ที่ใดเลยโดยผู้เขียน: สินค้านี้ถูกรันและทดสอบบนเครื่อง
  นักพัฒนา กับ PostgreSQL ในเครื่องเท่านั้น การรันหลายอินสแตนซ์ยังไม่ถูกทดสอบ และโหมด
  หน่วยความจำแยกตามโปรเซส
- **N7 — Payments and AI providers need your own keys.** The AI provider path and
  the payment path are reachable only with **your own key** (`OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` for AI; your own Stripe keys for the
  payment demo). With no AI provider key the paid AI route answers **503** by
  design. No live charge and no live provider call was made by the authors.
  / **N7 — payment และผู้ให้บริการ AI ต้องใช้คีย์ของคุณเอง** เส้นทางผู้ให้บริการ AI และ
  เส้นทาง payment เข้าถึงได้ด้วย **คีย์ของคุณเอง** เท่านั้น (`OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY` หรือ `GEMINI_API_KEY` สำหรับ AI และคีย์ Stripe ของคุณเองสำหรับ
  payment demo) ถ้าไม่มีคีย์ผู้ให้บริการ AI เส้นทาง AI ที่มีค่าจะตอบ **503** ตามการออกแบบ
  ผู้เขียนไม่ได้ทำการเรียกเก็บเงินจริงหรือเรียกผู้ให้บริการจริงเลย

**One more limit, about the UI.** There is no in-browser UI test: **no
screenshots** exist in this repository — none are shipped and none were taken —
and the saved HTML files under `server/scripts/proofs/wu4/wu4-e2e/` are the whole
UI evidence. / **ข้อจำกัดอีกข้อ เกี่ยวกับ UI** ไม่มีการทดสอบ UI ในเบราว์เซอร์
**ไม่มีภาพหน้าจอ** ในที่เก็บโค้ดนี้ — ไม่มีส่งมาและไม่ได้ถ่ายไว้ — และไฟล์ HTML ที่บันทึกไว้ใต้
`server/scripts/proofs/wu4/wu4-e2e/` คือหลักฐาน UI ทั้งหมด

**And one warning you must not skip, about running the test suite — the rows are
cleaned up, and the suite is repeatable.**

`npm test` writes subscription and billing-ledger rows into whatever database is
configured, and **it deletes exactly the rows it created again before it exits**, so
repeated runs against one database leave nothing behind. Measured on the author's local
test database: three consecutive full-suite runs each reported `Test Files 7 passed (7)`
and `Tests 71 passed (71)`, and the row counts after all three runs were `subscriptions`
0 and `billing_event_ledger` 0. Pointing a test suite at a scratch database rather than a
production one is still the right habit, but this suite is **repeatable**: the same
database can be used run after run. `docs/product/WU5-DEPLOY.md` §6.1 states the
same position with the same figures.

**History, so that an older copy does not mislead you.** An earlier version of
`server/tests/webhook.test.ts` deleted nothing, so a run left real rows in
`subscriptions` and `billing_event_ledger`, and re-running the suite against the same
database used to **fail**: the second run reported
`tests/webhook.test.ts:101 AssertionError: expected 'active' to be 'cancelled'`, because
the file's two billing-event ids are fixed (`evt_apply_1`, `evt_replay_1`) and the
ledger's `event_id` is its primary key — a row left from an earlier run made the
redelivery dedupe, so the subscription never reached `cancelled`. That was a defect in
the suite; **it is fixed**, and the run that used to fail now passes with
`Test Files 7 passed (7)` and `Tests 71 passed (71)`. The obsolete warning said the row
counts went from 5 subscriptions and 3 ledger rows to 7 and 3, and that the suite was
not repeatable against the same database; **both statements are superseded and no longer
true.** If you find that row-leak warning in another copy of this document set, or in any
document written before this one, **that warning is obsolete.**

**คำเตือนข้อเดียวที่ห้ามข้าม เกี่ยวกับการรันชุดเทสต์ — แถวถูกลบให้เรียบร้อย และชุดเทสต์รันซ้ำได้**

`npm test` เขียนแถว subscription และแถว ledger ลงในฐานข้อมูลที่ตั้งไว้ และ**มันลบแถวที่
ตัวเองสร้างทิ้งก่อนจบ** การรันซ้ำบนฐานข้อมูลเดิมจึงไม่ทิ้งอะไรไว้ วัดบนฐานข้อมูลทดสอบในเครื่อง
ผู้เขียน: สามรอบรันติดกันรายงาน `Test Files 7 passed (7)` และ `Tests 71 passed (71)` ทุกรอบ
และจำนวนแถวหลังทั้งสามรอบคือ `subscriptions` 0 และ `billing_event_ledger` 0 การชี้ชุดเทสต์
ไปที่ฐานข้อมูลทดสอบแทน production ยังเป็นนิสัยที่ถูก แต่ชุดเทสต์นี้**รันซ้ำได้**: ใช้ฐานข้อมูล
เดิมซ้ำได้ทุกรอบ `docs/product/WU5-DEPLOY.md` §6.1 ระบุสถานะเดียวกันด้วยตัวเลขเดียวกัน

**ประวัติ เพื่อไม่ให้สำเนาเก่าทำให้คุณเข้าใจผิด** `server/tests/webhook.test.ts` เวอร์ชันก่อน
**ไม่**ลบอะไรเลย การรันหนึ่งครั้งจึงทิ้งแถวจริงไว้ใน `subscriptions` และ
`billing_event_ledger` และการรันซ้ำบนฐานข้อมูลเดิม**เคยล้มเหลว** รอบที่สองรายงาน
`tests/webhook.test.ts:101 AssertionError: expected 'active' to be 'cancelled'` เพราะ id ของ
billing event สองตัวของไฟล์นี้คงที่ (`evt_apply_1`, `evt_replay_1`) และ `event_id` ของ ledger
เป็น primary key — แถวที่ค้างจากรอบก่อนทำให้การส่งซ้ำถูก dedupe subscription จึงไม่ถึงสถานะ
`cancelled` นั่นเป็น defect ของชุดเทสต์ และ**แก้แล้ว** รอบที่เคยล้มเหลวตอนนี้ผ่านด้วย
`Test Files 7 passed (7)` และ `Tests 71 passed (71)` คำเตือนที่ล้าสมัยระบุว่าจำนวนแถวเปลี่ยนจาก
subscription 5 แถว และ ledger 3 แถว เป็น 7 แถว และ 3 แถว และระบุว่าชุดเทสต์รันซ้ำกับฐานข้อมูล
เดิมไม่ได้ **ทั้งสองข้อความถูกล้มเลิกและไม่จริงอีกต่อไป** ถ้าคุณพบคำเตือนเรื่องแถวค้างนั้น
ในสำเนาอื่นของเอกสารชุดนี้ หรือในเอกสารใดที่เขียนก่อนหน้านี้ **คำเตือนนั้นล้าสมัยแล้ว**

---

## 7. Requirements to run it / สิ่งที่ต้องมีเพื่อรัน

- **Q1 — Node.js 22 or newer, with npm.** Not a preference: the installed
  `@supabase/supabase-js` declares `engines.node = ">=22.0.0"`.
  / **Q1 — Node.js 22 ขึ้นไป พร้อม npm** ไม่ใช่ความชอบส่วนตัว เพราะ
  `@supabase/supabase-js` ที่ติดตั้งอยู่ประกาศ `engines.node = ">=22.0.0"`
- **Q2 — Dependencies must be installed inside `server/`.** The install and every
  command after it run from `server/`; there is no install at the repository root
  and none at the top of a delivered folder. / **Q2 — ต้องติดตั้ง dependency
  ข้างใน `server/`** การติดตั้งและทุกคำสั่งหลังจากนั้นรันจาก `server/` ไม่มีการติดตั้งที่
  root ของที่เก็บโค้ด และไม่มีที่โฟลเดอร์บนสุดของโฟลเดอร์ส่งมอบ
- **Q3 — A PostgreSQL 16 or newer database.** PostgreSQL is the server's only
  external service, and PostgreSQL 16 is what this kit has been tested with. A
  Supabase Postgres URL speaks the same protocol on the wire, but it is untested
  here (see N4). / **Q3 — ฐานข้อมูล PostgreSQL 16 ขึ้นไป** PostgreSQL เป็นบริการ
  ภายนอกเดียวของเซิร์ฟเวอร์ และ PostgreSQL 16 คือเวอร์ชันที่คิทนี้ทดสอบแล้ว
  — ส่วน URL ของ Supabase Postgres ยังไม่ถูกทดสอบที่นี่ แม้จะพูดโปรโตคอลเดียวกัน (ดู N4)
- **Q4 — `modules/` and `web/` must sit beside `server/`.** The server imports
  from `../../../modules/` at runtime and reads the pages from `../web/`. Copying
  only `server/` produces a server that cannot start. / **Q4 — `modules/` และ `web/`
  ต้องอยู่ข้าง `server/`** เซิร์ฟเวอร์ import จาก `../../../modules/` ตอนรัน และอ่านหน้าเว็บ
  จาก `../web/` การคัดลอกแค่ `server/` จะได้เซิร์ฟเวอร์ที่สตาร์ทไม่ขึ้น
- **Q5 — A process supervisor and TLS of your own.** This kit ships no supervisor,
  no reverse proxy and no TLS terminator; the Express process speaks plain HTTP.
  / **Q5 — process supervisor และ TLS ของคุณเอง** คิทนี้ไม่มี supervisor ไม่มี reverse
  proxy และไม่มีตัวจบ TLS โปรเซส Express พูด HTTP ธรรมดา

---

## 8. What you must supply / สิ่งที่คุณต้องเตรียมเอง

- **S1 — Your own PostgreSQL database, PostgreSQL 16 or newer.** There is no
  default, no bundled instance and no fallback address in the code. A Supabase
  Postgres URL is the same protocol on the wire, but it is untested here (see N4).
  / **S1 — ฐานข้อมูล PostgreSQL ของคุณเอง เวอร์ชัน 16 ขึ้นไป** ไม่มีค่าเริ่มต้น
  ไม่มีอินสแตนซ์แถมมา และไม่มีที่อยู่สำรองในโค้ด
  — ส่วน URL ของ Supabase Postgres ยังไม่ถูกทดสอบที่นี่ แม้จะพูดโปรโตคอลเดียวกัน (ดู N4)
- **S2 — Your own AI provider key** — one of `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`. Without one, the paid AI route answers
  503 by design. / **S2 — คีย์ของผู้ให้บริการ AI ของคุณเอง** — หนึ่งใน
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` ถ้าไม่มี เส้นทาง AI ที่มีค่าจะ
  ตอบ 503 ตามการออกแบบ
- **S3 — Your own Stripe keys if you want the payment demo** —
  `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. / **S3 — คีย์ Stripe ของคุณเอง
  ถ้าต้องการ payment demo** — `STRIPE_SECRET_KEY` และ `STRIPE_WEBHOOK_SECRET`
- **S4 — Your own TLS termination, process supervision and secret storage.**
  Secrets travel in the process environment or your platform's secret store;
  there is no `.env` file to put them in. / **S4 — TLS, การดูแลโปรเซส และที่เก็บ secret
  ของคุณเอง** secret เดินทางใน process environment หรือ secret store ของแพลตฟอร์มคุณ
  ไม่มีไฟล์ `.env` ให้ใส่

---

This document has not been validated by a different party following it on a fresh
folder, and nothing in it is an approval. Commercial terms are provided
separately and are not part of this document.

เอกสารนี้ยังไม่ถูกตรวจสอบโดยบุคคลอื่นที่ทำตามบนโฟลเดอร์ใหม่ และไม่มีข้อใดในนี้เป็นการอนุมัติ
เงื่อนไขทางการค้าจะแจ้งแยกต่างหาก และไม่ใช่ส่วนหนึ่งของเอกสารนี้
