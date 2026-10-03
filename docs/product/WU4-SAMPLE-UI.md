# WU-4 Sample UI — a walkable sample front end for the Multi-Tenant AI Starter Kit

# WU-4 หน้าตัวอย่าง — หน้าเว็บตัวอย่างที่เดินได้จริงสำหรับ Multi-Tenant AI Starter Kit

---

## 1. What this is / หน้าตัวอย่างนี้คืออะไร

Five static pages served by the same Express app as the API, so a buyer can see
the starter kit working end to end: enter a demo tenant id, activate the explicitly
free plan, use the AI, and see the quota the server enforces. Paid plans remain
visible in the catalogue but direct self-service activation is refused until a
trusted billing/admin integration establishes them. There is no build step, no
front-end framework, no CDN, no web font and no stock photo. Every visible
sentence comes from one bilingual dictionary.

หน้าตัวอย่างนี้คือหน้า static 5 หน้าที่เสิร์ฟโดย Express app ตัวเดียวกับ API เพื่อให้ผู้ซื้อเห็นว่า
สตาร์ทเตอร์คิททำงานได้ครบเส้นทางจริง: ใส่ demo tenant id → เปิดใช้แพ็กเกจ free ที่ระบุชัดว่าไม่มีราคา
→ ใช้ AI → เห็นโควตาที่เซิร์ฟเวอร์บังคับใช้จริง ส่วนแพ็กเกจเสียเงินยังแสดงใน catalogue แต่ self-service
จะถูกปฏิเสธจนกว่าจะมี billing/admin integration ที่เชื่อถือได้ ไม่มีขั้นตอน build ไม่มีเฟรมเวิร์กฝั่งหน้าเว็บ ไม่มี CDN ไม่มีฟอนต์เว็บ
และไม่มีรูปสต็อก ทุกประโยคที่เห็นมาจาก dictionary สองภาษาชุดเดียว

The pages are static files under `web/`; the server renders the shared shell
(header, navigation, language switch, footer) from the very same dictionary
(`web/assets/i18n.js`) that the browser uses, so the served HTML is readable in
either locale before any script runs.

หน้าเว็บเป็นไฟล์ static อยู่ใต้ `web/` ส่วนเซิร์ฟเวอร์เป็นตัว render shell ที่ใช้ร่วมกัน
(หัวเรื่อง เมนู ปุ่มสลับภาษา ท้ายเรื่อง) จาก dictionary ชุดเดียวกับที่เบราว์เซอร์ใช้
(`web/assets/i18n.js`) ดังนั้น HTML ที่เสิร์ฟออกไปอ่านได้ทั้งสองภาษาแม้ยังไม่รันสคริปต์

---

## 2. Starting the server on a clean machine / วิธีสตาร์ทเซิร์ฟเวอร์บนเครื่องสะอาด

### 2.1 Requirements / สิ่งที่ต้องมีก่อน

Node.js 22 or newer with npm. Nothing else: no global CLI, no database server
for the first path below.

ต้องมี Node.js 22 ขึ้นไปพร้อม npm เท่านั้น ไม่ต้องมีอะไรอื่น ไม่ต้องมี global CLI
และไม่ต้องมีเซิร์ฟเวอร์ฐานข้อมูลสำหรับวิธีแรกด้านล่าง

### 2.2 Without DATABASE_URL (in-memory repositories) / แบบไม่ตั้ง DATABASE_URL (ใช้ repository ในหน่วยความจำ)

Exact commands, from the repository root:

คำสั่งที่ใช้จริง จาก root ของที่เก็บโค้ด:

    cd server
    npm install
    DEMO_AUTH=true npm run start
    # open http://127.0.0.1:3003/ in a browser
    # เปิด http://127.0.0.1:3003/ ในเบราว์เซอร์

What you get: the server keeps its in-memory repositories. The pages, the plan
catalogue, the quota gate and the 402/429 refusals all work, and everything
resets when the process stops. This is the fastest way to see the screens.

สิ่งที่ได้: เซิร์ฟเวอร์ใช้ repository ในหน่วยความจำ หน้าเว็บ รายการแพ็กเกจ โควตาก็ต
และการปฏิเสธ 402/429 ทำงานครบ และทุกอย่างจะรีเซ็ตเมื่อปิดโปรเซส นี่คือวิธีที่เร็วที่สุด
ที่จะได้เห็นหน้าจอทั้งหมด

### 2.3 With DATABASE_URL (PostgreSQL, the real database) / แบบตั้ง DATABASE_URL (PostgreSQL ฐานข้อมูลจริง)

Exact commands, from the repository root:

คำสั่งที่ใช้จริง จาก root ของที่เก็บโค้ด:

    cd server
    npm install
    DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE DEMO_AUTH=true npm run start
    # open http://127.0.0.1:3003/ in a browser
    # เปิด http://127.0.0.1:3003/ ในเบราว์เซอร์

Use your own database. Migrations in `server/migrations/` are applied
automatically at boot and are safe to run repeatedly, and the two seed plans
(`free`, `pro`) are upserted before the first request is served. With
`DATABASE_URL`, direct self-service activation writes only the explicitly free
plan to the `subscriptions` table. A direct `pro` attempt is refused with
`403 PAID_PLAN_REQUIRES_TRUSTED_ACTIVATION` and writes no subscription row.

ใช้ฐานข้อมูลของคุณเอง migration ใน `server/migrations/` จะถูกรันอัตโนมัติตอนบูต
และรันซ้ำได้ปลอดภัย ส่วนแพ็กเกจ seed สองตัว (`free`, `pro`) จะถูก upsert ก่อนเสิร์ฟคำขอแรก
เมื่อตั้ง `DATABASE_URL` self-service จะเขียน subscription ได้เฉพาะแพ็กเกจ free ที่ระบุราคาเป็น 0
ส่วนการเลือก `pro` โดยตรงจะได้ `403 PAID_PLAN_REQUIRES_TRUSTED_ACTIVATION` และไม่สร้าง row ใน
`subscriptions`

The demo-auth gate is OFF unless you set `DEMO_AUTH=true`. The commands above
set it on the same line as the server command so it applies to that process
only; nothing is written to any file.

โหมด demo-auth ปิดอยู่เสมอถ้าไม่ตั้ง `DEMO_AUTH=true` คำสั่งด้านบนตั้งค่าไว้บนบรรทัดเดียวกับ
คำสั่งรันเซิร์ฟเวอร์ เพื่อให้มีผลกับโปรเซสนั้นเท่านั้น ไม่มีการเขียนค่าลงไฟล์ใด ๆ

### 2.4 Ports and environment / พอร์ตและตัวแปรสภาพแวดล้อม

| Variable / ตัวแปร | Meaning / ความหมาย |
|---|---|
| `PORT` | Port for the server. Default `3003`. / พอร์ตของเซิร์ฟเวอร์ ค่าเริ่มต้น `3003` |
| `DATABASE_URL` | PostgreSQL connection string. Unset = in-memory repositories. / connection string ของ PostgreSQL ถ้าไม่ตั้ง = ใช้ repository ในหน่วยความจำ |
| `DEMO_AUTH` | `true` enables the demonstration identity gate. Off by default. / `true` เพื่อเปิดโหมดตัวตนสาธิต ปิดเป็นค่าเริ่มต้น |
| `NODE_ENV` | `production` makes the server refuse `DEMO_AUTH` outright. / ถ้าเป็น `production` เซิร์ฟเวอร์จะปฏิเสธ `DEMO_AUTH` ทันที |

### 2.5 Re-running the WU-4 evidence yourself / รันหลักฐานของ WU-4 ซ้ำด้วยตัวเอง

One command runs all three WU-4 harnesses (the demo-auth gate test, the i18n
parity harness and the end-to-end harness):

คำสั่งเดียวรัน harness ทั้งสามตัวของ WU-4 (เทสต์ demo-auth gate, harness ตรวจความครบของ
สองภาษา และ harness e2e):

    cd server
    DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE npm run test:web

The end-to-end harness saves the HTML it received for every page in both locales
under `server/scripts/proofs/wu4/wu4-e2e/` and exits non-zero if any check
fails. `npm run test:web:i18n` and `npm run test:web:e2e` run the parity harness
and the end-to-end harness on their own.

harness e2e จะบันทึก HTML ที่ได้รับจริงของทุกหน้าในทั้งสองภาษาไว้ที่
`server/scripts/proofs/wu4/wu4-e2e/` และจะคืนค่า exit ที่ไม่ใช่ศูนย์ถ้ามีข้อใดไม่ผ่าน
ส่วน `npm run test:web:i18n` และ `npm run test:web:e2e` ใช้รัน harness ตรวจภาษา
และ harness e2e แยกกัน

The end-to-end harness refuses to run against a non-loopback database host and
refuses to run with `NODE_ENV=production`; it deletes every row it created.

harness e2e จะปฏิเสธไม่รันถ้าฐานข้อมูลไม่ได้อยู่บน loopback และปฏิเสธไม่รันเมื่อ
`NODE_ENV=production` และจะลบทุกแถวที่มันสร้างขึ้นเอง

---

## 3. The five screens / หน้าจอทั้งห้า

| # | Page / หน้า | URL | What it does / ทำอะไร |
|---|---|---|---|
| 1 | Landing / หน้าแรก | `/` | Explains what the sample UI is, shows the four-step flow, the demonstration-mode section, and the full not-implemented list. Carries the language switch. / อธิบายว่าหน้าตัวอย่างนี้คืออะไร แสดงเส้นทาง 4 ขั้น ส่วนโหมดสาธิต และรายการ "ยังไม่ได้ทำ" ครบถ้วน พร้อมปุ่มสลับภาษา |
| 2 | Sign up / สมัคร | `/signup` | Enter or generate a demo tenant id, and see the plans the server actually has (read from the plan table). Creates no account and no subscription. / ใส่หรือกดสร้าง demo tenant id และดูแพ็กเกจที่เซิร์ฟเวอร์มีจริง (อ่านจากตาราง plan) หน้านี้ไม่สร้างบัญชีและไม่สร้าง subscription |
| 3 | Log in / เข้าสู่ระบบ | `/login` | Enter the same demo tenant id again. There is no password and no verification; this screen only tells the sample UI which id to send. / ใส่ demo tenant id เดิมอีกครั้ง ไม่มีรหัสผ่านและไม่มีการตรวจสอบ หน้านี้แค่บอกหน้าตัวอย่างว่าจะส่ง id ตัวไหน |
| 4 | Choose a plan / เลือกแพ็กเกจ | `/plans` | Shows the plan catalogue with each plan's `ai_requests_per_month` and `payments_per_month` limits. Direct self-service can persist only the explicitly free plan; a paid-plan attempt is refused until trusted billing/admin activation exists. A second allowed attempt on the same account gets the server's own 409. / แสดงรายการแพ็กเกจพร้อมเพดาน `ai_requests_per_month` และ `payments_per_month` ของแต่ละแพ็กเกจ โดย self-service เขียนได้เฉพาะแพ็กเกจ free ที่ระบุราคาเป็น 0 ส่วนแพ็กเกจเสียเงินจะถูกปฏิเสธจนกว่าจะผ่าน billing/admin ที่เชื่อถือได้ ถ้าลองสร้างแพ็กเกจ free ซ้ำบัญชีเดิมจะได้ 409 จากเซิร์ฟเวอร์เอง |
| 5 | Use the AI / ใช้ AI | `/app` | Reads `GET /me` and reports whether the server answered with a demonstration identity or the real auth path; shows the plan, the usage counter and the limit; sends `POST /ai/demo` and prints the server's response body verbatim, including 402 `QUOTA_NOT_ENTITLED` and 429 `QUOTA_EXCEEDED`. / อ่าน `GET /me` แล้วรายงานว่าเซิร์ฟเวอร์ตอบด้วยตัวตนสาธิตหรือเส้นทาง auth จริง แสดงแพ็กเกจ ตัวนับการใช้ และเพดาน ส่ง `POST /ai/demo` แล้วพิมพ์คำตอบของเซิร์ฟเวอร์ตามจริง รวมทั้ง 402 `QUOTA_NOT_ENTITLED` และ 429 `QUOTA_EXCEEDED` |

Language switch / การสลับภาษา: every page has a switch in the header. It is a
`?lang=th` / `?lang=en` link, so it works without JavaScript, and the choice is
also kept in `localStorage` for the next page.

ทุกหน้ามีปุ่มสลับภาษาอยู่ที่หัวเรื่อง เป็นลิงก์ `?lang=th` / `?lang=en` จึงทำงานได้
แม้ปิด JavaScript และตัวเลือกจะถูกเก็บใน `localStorage` ไว้ใช้กับหน้าถัดไปด้วย

---

## 4. What DEMO_AUTH demonstration mode IS and IS NOT / โหมดสาธิต DEMO_AUTH คืออะไร และไม่ใช่อะไร

### 4.1 What it IS / สิ่งที่มันเป็น

- A way to walk the four screens on a clean machine that has no Supabase
  project, because this repository ships no credentials and cannot ship them.
  / วิธีเดินครบทั้งสี่หน้าบนเครื่องสะอาดที่ไม่มีโปรเจกต์ Supabase เพราะที่เก็บโค้ดนี้
  ไม่มี credential และไม่สามารถแถมให้ได้
- Off by default. Only the exact string `DEMO_AUTH=true` turns it on; unset, an
  empty value and `false` all leave the real authentication path exactly as it
  was. / ปิดเป็นค่าเริ่มต้น เฉพาะค่า `DEMO_AUTH=true` เท่านั้นที่เปิด ถ้าไม่ตั้ง ค่าว่าง
  หรือ `false` จะคงเส้นทางยืนยันตัวตนจริงไว้เหมือนเดิมทุกประการ
- A tenant identity taken from a header you type (`x-demo-account`, falling back
  to `x-tenant-id`), validated against a fixed allow-list: letters, digits and
  `. _ - @`, 1–64 characters. / ตัวตน tenant ที่มาจาก header ที่คุณพิมพ์เอง
  (`x-demo-account` โดยถอยไปใช้ `x-tenant-id` ได้) ตรวจกับ allow-list ตายตัว:
  ตัวอักษร ตัวเลข และ `. _ - @` ความยาว 1–64 ตัวอักษร
- Reported honestly in the UI: the "Use the AI" screen reads `GET /me` and labels
  itself a demonstration identity, and the footer shows `DEMO_AUTH on` or
  `DEMO_AUTH off` as reported by the server. / หน้ารายงานตามจริง: หน้า "ใช้ AI"
  อ่าน `GET /me` แล้วติดป้ายว่ากำลังใช้ตัวตนสาธิต และท้ายเรื่องแสดง `DEMO_AUTH on`
  หรือ `DEMO_AUTH off` ตามที่เซิร์ฟเวอร์รายงาน

### 4.2 What it IS NOT / สิ่งที่มันไม่ใช่

- **Not authentication.** It establishes no identity you own.
  / **ไม่ใช่การยืนยันตัวตน** ไม่ได้สร้างตัวตนที่เป็นของคุณ
- **No password, no user record, no token, no signature.** Nothing is verified,
  and nothing is looked up. / **ไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้ ไม่มีโทเคน ไม่มีลายเซ็น**
  ไม่มีการตรวจสอบใด ๆ และไม่มีการค้นหาข้อมูลใด ๆ
- **No privilege.** Every other check in the system still runs: it has no
  subscription until the explicitly free plan is activated, and a direct paid-plan
  request is refused. The quota gate then enforces the real 402/429 shapes exactly
  as it would for any other account. / **ไม่ได้ให้สิทธิ์ใด ๆ** การตรวจสอบอื่นทั้งหมดในระบบยังทำงานตามเดิม
  มันไม่มี subscription จนกว่าจะเปิดใช้แพ็กเกจ free ที่ระบุราคาเป็น 0 และการขอแพ็กเกจเสียเงินโดยตรง
  จะถูกปฏิเสธ จากนั้นโควตายังคงบังคับใช้รูปแบบ 402/429 จริงเหมือนบัญชีอื่นทุกบัญชี
- **Never active in production.** With `DEMO_AUTH=true` and
  `NODE_ENV=production` the server refuses to mount the gate and answers 503 with
  code `DEMO_AUTH_REFUSED_IN_PRODUCTION`, and logs one line beginning
  `[demo-auth] REFUSED`. / **ไม่เปิดเด็ดขาดบน production** ถ้าตั้ง `DEMO_AUTH=true`
  พร้อม `NODE_ENV=production` เซิร์ฟเวอร์จะปฏิเสธไม่ mount gate และตอบ 503 พร้อมรหัส
  `DEMO_AUTH_REFUSED_IN_PRODUCTION` พร้อมพิมพ์ log หนึ่งบรรทัดที่ขึ้นต้นด้วย
  `[demo-auth] REFUSED`
- **Not a substitute for your Supabase project.** Real log in requires your own
  Supabase URL and anon key in the environment. / **ไม่ใช่ตัวแทนโปรเจกต์ Supabase
  ของคุณ** การเข้าสู่ระบบจริงต้องใช้ Supabase URL และ anon key ของคุณเองในตัวแปร
  สภาพแวดล้อม

---

## 5. Not implemented / ยังไม่ได้ทำ

These capabilities are not part of this build, and the landing page does not
pretend otherwise. They are listed on the landing page in both locales.

ความสามารถต่อไปนี้ยังไม่มีในบิลด์นี้ และหน้าแรกไม่ได้แกล้งทำเป็นว่ามี รายการนี้แสดงบน
หน้าแรกทั้งสองภาษา

1. **OpenTelemetry exporter.** The tracing module records spans in process memory
   (`MemoryTracer`) only. There is no OTLP endpoint and no collector export.
   / **OpenTelemetry exporter** โมดูล tracing เก็บ span ไว้ในหน่วยความจำของโปรเซส
   เท่านั้น (`MemoryTracer`) ไม่มี OTLP endpoint และไม่มีการส่งออกไป collector
2. **LINE webhook verifier.** The verifier returns the error code
   `WEBHOOK_UNKNOWN_PROVIDER` and states plainly that it is not implemented.
   / **ตัวตรวจสอบ webhook ของ LINE** คืนรหัสข้อผิดพลาด `WEBHOOK_UNKNOWN_PROVIDER`
   และระบุตรง ๆ ว่ายังไม่ได้ทำ
3. **GitHub webhook verifier.** Same behaviour: `WEBHOOK_UNKNOWN_PROVIDER`, not
   implemented. / **ตัวตรวจสอบ webhook ของ GitHub** พฤติกรรมเดียวกัน:
   `WEBHOOK_UNKNOWN_PROVIDER` ยังไม่ได้ทำ
4. **Real Supabase auth verification.** The authentication path exists, but it is
   unverified here because this repository ships no Supabase project and no
   credentials. / **การยืนยันตัวตน Supabase จริง** เส้นทาง auth มีอยู่ แต่ยังพิสูจน์
   ที่นี่ไม่ได้ เพราะที่เก็บโค้ดนี้ไม่มีโปรเจกต์ Supabase และไม่มี credential
5. **Production deployment.** There is no container, no reverse proxy, no TLS and
   no process supervisor in this repository. Run it on your own machine only.
   / **การ deploy ขึ้น production** ไม่มี container ไม่มี reverse proxy ไม่มี TLS
   และไม่มี process supervisor ในที่เก็บโค้ดนี้ ใช้รันบนเครื่องตัวเองเท่านั้น
6. **Demo identity as authentication.** It is a tenant id typed into a form, with
   no password and no session token. / **ตัวตนสาธิตในฐานะการยืนยันตัวตน** มันคือ
   tenant id ที่พิมพ์ในฟอร์ม ไม่มีรหัสผ่านและไม่มี session token

---

## 6. Evidence and limits / หลักฐานและข้อจำกัด

- The i18n parity harness (`server/scripts/proofs/wu4/i18n-parity.mjs`) asserts
  that the two locale dictionaries hold identical key sets, that no page file
  contains a visible string outside the dictionary, and that the behaviour script
  holds no prose literal. / harness ตรวจความครบสองภาษา
  (`server/scripts/proofs/wu4/i18n-parity.mjs`) ตรวจว่า dictionary ทั้งสองภาษา
  มีชุดคีย์เหมือนกันทุกตัว ไม่มีไฟล์หน้าเว็บใดมีข้อความที่ผู้ใช้เห็นนอก dictionary
  และสคริปต์พฤติกรรมไม่มีสตริงที่เป็นประโยค
- The end-to-end harness (`server/scripts/proofs/wu4/e2e-web.mjs`) starts the
  real app against the real database, drives all five pages in both locales,
  saves the served HTML, and prints one `CHECK <name> PASS|FAIL <detail>` line per
  check. / harness e2e (`server/scripts/proofs/wu4/e2e-web.mjs`) สตาร์ทแอปจริง
  กับฐานข้อมูลจริง เดินครบทั้งห้าหน้าในสองภาษา บันทึก HTML ที่เสิร์ฟจริง และพิมพ์
  บรรทัด `CHECK <name> PASS|FAIL <detail>` หนึ่งบรรทัดต่อหนึ่งข้อ
- The demo-auth gate is covered over real HTTP by
  `server/tests/demo-auth-gate.test.ts`, which asserts that with `DEMO_AUTH` off
  the paid routes still answer the original 503 and no demo middleware is
  reachable, and that `DEMO_AUTH=true` with `NODE_ENV=production` is refused.
  / gate ของ demo-auth ถูกตรวจผ่าน HTTP จริงโดย
  `server/tests/demo-auth-gate.test.ts` ซึ่งยืนยันว่าเมื่อ `DEMO_AUTH` ปิด เส้นทาง
  ที่มีค่าใช้จ่ายยังตอบ 503 เดิมและไม่มี demo middleware เข้าถึงได้เลย และเมื่อ
  `DEMO_AUTH=true` พร้อม `NODE_ENV=production` จะถูกปฏิเสธ
- The AI screen needs an AI provider key (`OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`) to complete a generation. Without a
  key the server answers 503 and gives the quota unit back; the quota gate itself
  is still exercised end to end by the 402 and 429 checks. This is stated in the
  UI rather than hidden. / หน้าใช้ AI ต้องมีคีย์ผู้ให้บริการ AI (`OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY` หรือ `GEMINI_API_KEY`) เพื่อสร้างคำตอบได้ครบ ถ้าไม่มีคีย์
  เซิร์ฟเวอร์จะตอบ 503 และคืนโควตาหนึ่งหน่วยกลับ ส่วนโควตาก็ตเองยังถูกทดสอบครบ
  เส้นทางด้วยการตรวจ 402 และ 429 เรื่องนี้ระบุในหน้าจอ ไม่ได้ปิดไว้
- This is a reference sample, not a production front end: there is no user
  account, no session, no password reset, no email and no styling framework.
  / นี่เป็นตัวอย่างอ้างอิง ไม่ใช่หน้าเว็บ production: ไม่มีบัญชีผู้ใช้ ไม่มี session
  ไม่มีรีเซ็ตรหัสผ่าน ไม่มีอีเมล และไม่มีเฟรมเวิร์กตกแต่ง

---

## 7. Files / ไฟล์

| Path | Role / หน้าที่ |
|---|---|
| `web/index.html` | Landing page with the language switch and the not-implemented list. / หน้าแรกพร้อมปุ่มสลับภาษาและรายการยังไม่ได้ทำ |
| `web/signup.html` | Sign-up screen. / หน้าสมัคร |
| `web/login.html` | Log-in screen. / หน้าเข้าสู่ระบบ |
| `web/plans.html` | Choose-a-plan screen. / หน้าเลือกแพ็กเกจ |
| `web/app.html` | Use-the-AI and quota screen. / หน้าใช้ AI และดูโควตา |
| `web/assets/i18n.js` | The only place a visible string may live, for both locales. / ที่เดียวที่ข้อความที่ผู้ใช้เห็นอาศัยอยู่ได้ ทั้งสองภาษา |
| `web/assets/app.js` | Page behaviour. Contains no visible text. / พฤติกรรมของหน้า ไม่มีข้อความที่ผู้ใช้เห็น |
| `web/assets/app.css` | Styling. No external font or image. / การตกแต่ง ไม่มีฟอนต์หรือรูปภายนอก |
| `server/src/lib/web-pages.ts` | Serves the pages and renders the shared shell from the dictionary. / เสิร์ฟหน้าเว็บและ render shell ร่วมจาก dictionary |
| `server/src/middleware/demo-auth.ts` | The demonstration identity gate (off by default). / gate ตัวตนสาธิต (ปิดเป็นค่าเริ่มต้น) |
| `server/scripts/proofs/wu4/i18n-parity.mjs` | Bilingual parity harness. / harness ตรวจความครบสองภาษา |
| `server/scripts/proofs/wu4/e2e-web.mjs` | End-to-end harness; writes `wu4-e2e/` HTML evidence. / harness e2e และเขียนหลักฐาน HTML ลง `wu4-e2e/` |
| `server/tests/demo-auth-gate.test.ts` | Demo-auth gate proof over real HTTP. / หลักฐาน gate demo-auth ผ่าน HTTP จริง |
