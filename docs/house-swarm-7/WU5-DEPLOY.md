# WU-5 Deployment Manual — Multi-Tenant AI Starter Kit (MT01)

# คู่มือ deploy WU-5 — Multi-Tenant AI Starter Kit (MT01)

One deployment path, stated plainly. Everything in this document was checked
against the source tree of this repository. Read section 1 first, because it
tells you what this document is not.

เส้นทาง deploy ทางเดียว ระบุตรง ๆ ทุกอย่างในเอกสารนี้ตรวจกับซอร์สของเรดิสทอรีนี้แล้ว
อ่านข้อ 1 ก่อน เพราะมันบอกว่าเอกสารนี้ "ไม่ใช่" อะไร

---

## 1. What you are deploying / what you are NOT — สิ่งที่คุณกำลัง deploy และสิ่งที่ไม่ใช่

**What this is.** A deployment manual for a plain **Node.js 22+ process that
talks to PostgreSQL**. The application is one Express server; its only external
service is one PostgreSQL database reached through `DATABASE_URL`. That is the
whole topology.

**เอกสารนี้คืออะไร** คู่มือ deploy สำหรับ **โปรเซส Node.js 22 ขึ้นไปที่คุยกับ
PostgreSQL** แอปพลิเคชันคือ Express server ตัวเดียว บริการภายนอกเดียวที่มันต่อคือ
ฐานข้อมูล PostgreSQL หนึ่งตัวซึ่งเข้าถึงผ่าน `DATABASE_URL` เท่านั้น นั่นคือโครงสร้างทั้งหมด

**Why there is exactly one path.** There is nothing else in the tree to choose
from. There is **no `Dockerfile`, no compose file, no reverse proxy, no TLS
terminator and no process supervisor** anywhere in this repository. So the single
path is: the operator runs the Node process, the operator supervises it, and the
operator terminates TLS — or puts it behind their own proxy. Nothing here
requires a container, and no container is offered.

**ทำไมมีทางเดียว** เพราะในเรดิสทอรีนี้ไม่มีอย่างอื่นให้เลือก **ไม่มี `Dockerfile`
ไม่มีไฟล์ compose ไม่มี reverse proxy ไม่มีตัวจบ TLS และไม่มี process supervisor**
ในที่ใดเลย ดังนั้นทางเดียวคือ ผู้ปฏิบัติรันโปรเซส Node เอง ดูแลโปรเซสเอง และจบ TLS เอง
หรือวางไว้หลังพร็อกซีของผู้ปฏิบัติเอง เอกสารนี้ไม่ต้องใช้ container และไม่ได้เสนอ container

**What you are NOT deploying.** This is the part that matters most:

- **No deployment was performed anywhere by the authors of this document.** It is
  a manual. It is instructions you follow on your machine, not a record of
  something that was done.
- **Nothing in this document has ever been run against a buyer's server, a
  buyer's database, or a production host.** The commands and observations below
  were produced on the author's own local machine against a local test database,
  and against no network host at all.
- **This repository ships no credentials and no database.** You supply your own
  database address and your own credentials. Nothing here is a value to copy.
- **No container, no cloud configuration and no infrastructure-as-code** is part
  of this deliverable, and none is permitted to be invented for it.

**สิ่งที่คุณ "ไม่ได้" กำลัง deploy** ส่วนนี้สำคัญที่สุด

- **ไม่มี deploy เกิดขึ้นที่ใดเลยจากผู้เขียนเอกสารนี้** นี่คือคู่มือ เป็นคำสั่งที่คุณทำตาม
  บนเครื่องของคุณ ไม่ใช่บันทึกของสิ่งที่ทำไปแล้ว
- **ไม่มีข้อใดในเอกสารนี้เคยรันกับเซิร์ฟเวอร์ของผู้ซื้อ ฐานข้อมูลของผู้ซื้อ หรือโฮสต์
  production เลย** คำสั่งและผลลัพธ์ด้านล่างผลิตบนเครื่องของผู้เขียนกับฐานข้อมูลทดสอบ
  ในเครื่องเท่านั้น และไม่ได้แตะโฮสต์บนเครือข่ายเลย
- **เรดิสทอรีนี้ไม่มี credential และไม่มีฐานข้อมูลให้** คุณต้องใส่ที่อยู่ฐานข้อมูลและ
  credential ของคุณเอง ไม่มีค่าใดในเอกสารนี้ที่ควรเอาไปคัดลอกใช้
- **ไม่มี container ไม่มีคอนฟิกคลาวด์ และไม่มี infrastructure-as-code** อยู่ในงานส่งมอบนี้
  และไม่อนุญาตให้คิดขึ้นเองเพื่องานนี้

---

## 2. Prerequisites — สิ่งที่ต้องมีก่อน

Exactly three things, and nothing else:

**มีเพียงสามอย่าง ไม่ต้องมีอย่างอื่น**

| # | Requirement / สิ่งที่ต้องมี | Why / เหตุผล |
|---|---|---|
| 1 | **Node.js 22 or newer** with npm. / **Node.js 22 ขึ้นไป** พร้อม npm | Required by the installed `@supabase/supabase-js`, which declares `engines.node = ">=22.0.0"`. / เป็นข้อกำหนดของ `@supabase/supabase-js` ที่ติดตั้งอยู่ ซึ่งประกาศ `engines.node = ">=22.0.0"` |
| 2 | **PostgreSQL 16 or newer**, or a **Supabase Postgres connection string**. / **PostgreSQL 16 ขึ้นไป** หรือ **connection string ของ Supabase Postgres** | The server's only external service. The schema uses `jsonb`, `timestamptz` and `ON CONFLICT`, all long-standing, but PostgreSQL 16 is what this build was checked against. / เป็นบริการภายนอกเดียวของเซิร์ฟเวอร์ สคีมาใช้ `jsonb`, `timestamptz` และ `ON CONFLICT` ซึ่งมีมานานแล้ว แต่ PostgreSQL 16 คือเวอร์ชันที่บิลด์นี้ตรวจด้วย |
| 3 | A process supervisor of your own (systemd, your platform's service manager, or any supervisor you already run). / **process supervisor ของคุณเอง** (systemd, ตัวจัดการ service ของแพลตฟอร์มคุณ หรือ supervisor ใดก็ได้ที่มีอยู่แล้ว) | This repository ships none. The process must survive a crash and restart on boot; that is your layer, not this kit's. / เรดิสทอรีนี้ไม่มีให้ โปรเซสต้องรอดจากการ crash และเริ่มใหม่ตอนบูต นั่นเป็นชั้นของคุณ ไม่ใช่ของคิทนี้ |

Two things you explicitly do **not** need: a Docker runtime, and any cloud
account belonging to these authors. Nothing in this kit contacts a service
belonging to anyone but you.

สองอย่างที่คุณ **ไม่** ต้องมี: Docker runtime และบัญชีคลาวด์ใด ๆ ของผู้เขียนชุดนี้
ไม่มีอะไรในคิทนี้ต่อกับบริการของใครนอกจากของคุณเอง

### Node.js version warning / คำเตือนเรื่องเวอร์ชัน Node.js

Some older project documentation in this repository states "Node.js 20 or newer".
**That statement is wrong.** The installed dependency requires **Node.js 22 or
newer**. Follow this manual, not that statement. The wrong line has been left in
place rather than silently edited out of a document this work unit does not own.

เอกสารรุ่นเก่าบางไฟล์ในเรดิสทอรีนี้ระบุว่า "Node.js 20 ขึ้นไป" **ข้อความนั้นผิด**
dependency ที่ติดตั้งอยู่ต้องการ **Node.js 22 ขึ้นไป** ให้ทำตามคู่มือนี้ ไม่ใช่ข้อความนั้น
บรรทัดที่ผิดนั้นถูกทิ้งไว้ตามเดิม แทนที่จะแก้เงียบ ๆ ในเอกสารที่ใบงานนี้ไม่ได้เป็นเจ้าของ

---

## 3. Step-by-step install — ขั้นตอนติดตั้งทีละขั้น

Every step below gives the exact command and the exact observation that tells you
it worked. Run them from the repository root unless a step says otherwise.

ทุกขั้นด้านล่างมีคำสั่งที่ใช้จริงและสิ่งที่คุณต้องเห็นเพื่อยืนยันว่าได้ผล รันจาก root
ของเรดิสทอรี เว้นแต่ขั้นนั้นระบุไว้เป็นอย่างอื่น

### 3.1 Obtain the source / ขั้นที่ 1 รับซอร์ส

    git clone <THE_REPOSITORY_URL_YOU_WERE_GIVEN> multi-tenant-ai
    cd multi-tenant-ai

Replace `<THE_REPOSITORY_URL_YOU_WERE_GIVEN>` with the address you received.
There is no address to copy from this document.

แทน `<THE_REPOSITORY_URL_YOU_WERE_GIVEN>` ด้วยที่อยู่ที่คุณได้รับ ไม่มีที่อยู่ในเอกสารนี้
ให้คัดลอก

**Expected output (expected output):** git prints its normal clone progress and
creates the `multi-tenant-ai` directory. A non-zero exit means the clone failed;
nothing after this step will work until it succeeds.

### 3.2 Install dependencies / ขั้นที่ 2 ติดตั้ง dependency

    cd server
    npm ci

`npm ci` installs exactly the lockfile's versions and is the reproducible choice.
`npm install` also works if you intend to update the lockfile.

`npm ci` ติดตั้งเวอร์ชันตาม lockfile เป๊ะ ๆ และเป็นตัวเลือกที่ทำซ้ำได้ ส่วน `npm install`
ก็ใช้ได้ถ้าคุณตั้งใจจะอัปเดต lockfile

**Expected output (expected output):** npm reports the packages it added and
exits 0 without listing any error. There are three runtime dependencies only:
`@supabase/supabase-js`, `express`, `pg`.

### 3.3 Set the environment — in the process environment, NOT in a file / ขั้นที่ 3 ตั้งตัวแปรสภาพแวดล้อม — ใน process environment ไม่ใช่ในไฟล์

**This is the step people get wrong.** **There is no dotenv in this project.**
Nothing in `server/src`, `server/tests` or `server/package.json` reads a `.env`
file. Creating a `.env` file will do **nothing at all** — it is not loaded and
the process will not see it. The environment must be supplied **to the process**,
by the shell that starts it, by your supervisor's `Environment=`/`EnvironmentFile=`
directive, or by your platform's secret store.

**นี่คือขั้นที่คนพลาดบ่อย** **โปรเจกต์นี้ไม่มี dotenv** ไม่มีอะไรใน `server/src`,
`server/tests` หรือ `server/package.json` ที่อ่านไฟล์ `.env` การสร้างไฟล์ `.env`
จะ**ไม่มีผลอะไรเลย** เพราะมันไม่ถูกโหลดและโปรเซสจะไม่เห็นมัน ตัวแปรสภาพแวดล้อมต้องส่ง
**ให้โปรเซส** โดยเชลล์ที่เริ่มโปรเซส โดย directive `Environment=`/`EnvironmentFile=`
ของ supervisor หรือโดย secret store ของแพลตฟอร์มคุณ

The file `server/.env.example` in this repository is **documentation only**. It is
a list of the variable names the code reads, kept so you can see them all in one
place. Nothing reads it. Do not treat it as a configuration file.

ไฟล์ `server/.env.example` ในเรดิสทอรีนี้เป็น**เอกสารเท่านั้น** มันคือรายการชื่อตัวแปร
ที่โค้ดอ่าน เก็บไว้ให้เห็นครบในที่เดียว ไม่มีอะไรอ่านมัน อย่าถือว่ามันเป็นไฟล์คอนฟิก

**The complete set of variables the server reads — exactly ten:**

| Variable / ตัวแปร | Required? / ต้องใส่ไหม | Meaning / ความหมาย |
|---|---|---|
| `PORT` | optional / ไม่บังคับ | Port to listen on. Default `3003`. / พอร์ตที่จะฟัง ค่าเริ่มต้น `3003` |
| `NODE_ENV` | recommended / แนะนำ | Set to `production` on a real deployment. This is what makes the `DEMO_AUTH` refusal operate (section 8). / ตั้งเป็น `production` บน deploy จริง นี่คือสิ่งที่ทำให้การปฏิเสธ `DEMO_AUTH` ทำงาน (ข้อ 8) |
| `DATABASE_URL` | for the real database / สำหรับฐานข้อมูลจริง | PostgreSQL connection string. Unset = in-memory repositories that reset when the process stops. / connection string ของ PostgreSQL ถ้าไม่ตั้ง = ใช้ repository ในหน่วยความจำ ซึ่งรีเซ็ตเมื่อโปรเซสหยุด |
| `DEMO_AUTH` | **must stay unset in production** / **ต้องไม่ตั้งบน production** | The demonstration identity gate. Never enable it in production. See section 8. / gate ตัวตนสาธิต ห้ามเปิดบน production ดูข้อ 8 |
| `SUPABASE_URL` | for real log in / สำหรับ log in จริง | Your own Supabase project URL. / URL โปรเจกต์ Supabase ของคุณเอง |
| `SUPABASE_ANON_KEY` | for real log in / สำหรับ log in จริง | Your own Supabase project anon key. / anon key ของโปรเจกต์ Supabase ของคุณเอง |
| `OPENAI_API_KEY` | optional / ไม่บังคับ | OpenAI key. One AI provider key is enough. / คีย์ OpenAI ใช้คีย์ผู้ให้บริการ AI ตัวใดตัวหนึ่งก็พอ |
| `ANTHROPIC_API_KEY` | optional / ไม่บังคับ | Anthropic key, alternative to the above. / คีย์ Anthropic ใช้แทนตัวข้างบนได้ |
| `GEMINI_API_KEY` | optional / ไม่บังคับ | Gemini key, alternative to the above. / คีย์ Gemini ใช้แทนตัวข้างบนได้ |
| `STRIPE_SECRET_KEY` | optional / ไม่บังคับ | Your own Stripe secret key, for the payment demo route. / คีย์ลับ Stripe ของคุณเอง สำหรับเส้นทาง payment demo |
| `STRIPE_WEBHOOK_SECRET` | optional / ไม่บังคับ | Your own Stripe webhook signing secret, for verifying incoming webhooks. / signing secret สำหรับ webhook ของ Stripe ของคุณเอง ใช้ยืนยัน webhook ที่เข้ามา |

Set them for the process. A POSIX shell does it on the command line, so the value
exists only in that process and is written to no file:

ตั้งค่าสำหรับโปรเซส เชลล์แบบ POSIX ตั้งบนบรรทัดคำสั่งได้ ค่าจึงอยู่แค่ในโปรเซสนั้น
และไม่ถูกเขียนลงไฟล์ใด

    export NODE_ENV=production
    export PORT=3003
    export DATABASE_URL='postgres://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME'
    npm run start

On Windows, set the variables with `set` in cmd or `$env:NAME='value'` in
PowerShell before running `npm run start`; or export them in Git-Bash exactly as
above. The requirement is the same in every case: the **process** must receive
them. No file is read.

บน Windows ใช้ `set` ใน cmd หรือ `$env:NAME='value'` ใน PowerShell ก่อนรัน
`npm run start` หรือจะ export ใน Git-Bash เหมือนข้างบนก็ได้ ข้อกำหนดเหมือนกันทุกกรณี:
**โปรเซส** ต้องได้รับค่าเหล่านี้ ไม่มีไฟล์ใดถูกอ่าน

### 3.4 First start / ขั้นที่ 4 สตาร์ทครั้งแรก

    cd server
    npm run start

`npm run start` runs `tsx src/index.ts`. The process applies its migrations and
writes its seed plans **before** it starts listening.

`npm run start` รัน `tsx src/index.ts` โปรเซสจะรัน migration และเขียนแพ็กเกจ seed
**ก่อน** ที่จะเริ่มฟังพอร์ต

**Expected output (expected output):** two lines. With `DATABASE_URL` set:

```expected output
Subscription repositories ready: persistent=true subscriptions=PostgresSubscriptionRepository usageCounters=PostgresUsageCounterRepository
Server listening on port 3003
```

With `DATABASE_URL` unset, the same two lines read `persistent=false
subscriptions=Object usageCounters=Object`, which is correct and means the
in-memory repositories are in use.

### 3.5 Verify / ขั้นที่ 5 ตรวจสอบ

    curl -s http://127.0.0.1:3003/health

**Expected output (expected output):**

```expected output
{"ok":true}
```

A 200 with that exact body means the process is serving. Then run the full
checklist in section 6 before you trust the deployment.

ได้ 200 พร้อมเนื้อความนั้นเป๊ะแปลว่าโปรเซสเสิร์ฟอยู่ จากนั้นรันรายการตรวจในข้อ 6 ให้ครบ
ก่อนจะเชื่อถือ deployment นี้

---

## 4. Pointing it at your own database — ชี้ไปที่ฐานข้อมูลของคุณเอง

**The address and the credentials are yours.** Nothing in this repository, and
nothing in this document, is a database you may use. There is no default, no
bundled instance and no fallback address in the code: if `DATABASE_URL` is unset
the server simply runs its in-memory repositories and stores nothing.

**ที่อยู่และ credential เป็นของคุณ** ไม่มีอะไรในเรดิสทอรีนี้ และไม่มีอะไรในเอกสารนี้
ที่เป็นฐานข้อมูลที่คุณเอาไปใช้ได้ ไม่มีค่าเริ่มต้น ไม่มีอินสแตนซ์แถมมา และไม่มีที่อยู่
สำรองในโค้ด: ถ้าไม่ตั้ง `DATABASE_URL` เซิร์ฟเวอร์จะใช้ repository ในหน่วยความจำ
และไม่เก็บอะไรเลย

### 4.1 Plain PostgreSQL / PostgreSQL ธรรมดา

    export DATABASE_URL='postgres://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME'

The user needs permission to create tables and indexes in that database, because
the migrations create the schema on first start (section 5). If your database
requires TLS, keep the `sslmode` parameter in the URL, as described next.

ผู้ใช้ต้องมีสิทธิ์สร้างตารางและ index ในฐานข้อมูลนั้น เพราะ migration จะสร้างสคีมา
ตอนสตาร์ทครั้งแรก (ข้อ 5) ถ้าฐานข้อมูลของคุณบังคับ TLS ให้เก็บพารามิเตอร์ `sslmode`
ไว้ใน URL ตามที่จะอธิบายต่อไป

### 4.2 Supabase Postgres / Supabase Postgres

Take the connection string from **your own** Supabase project dashboard
(Database → Connection string) and keep its `sslmode` parameter. The `pg` driver
turns that parameter into TLS settings for you:

คัด connection string จาก dashboard ของ**โปรเจกต์ Supabase ของคุณเอง**
(Database → Connection string) และเก็บพารามิเตอร์ `sslmode` ไว้ ไดรเวอร์ `pg`
จะแปลงพารามิเตอร์นั้นเป็นค่าตั้ง TLS ให้เอง

    export DATABASE_URL='postgres://DB_USER:DB_PASSWORD@DB_HOST:5432/postgres?sslmode=require'

- `sslmode=require` → the driver enables TLS. **Keep this.** Supabase requires it.
  / `sslmode=require` → ไดรเวอร์เปิด TLS **ต้องเก็บไว้** Supabase บังคับ
- `sslmode=no-verify` → TLS is enabled but the server certificate is not verified.
  / `sslmode=no-verify` → เปิด TLS แต่ไม่ตรวจใบรับรองของเซิร์ฟเวอร์
- `sslmode=disable` → TLS is off entirely. / `sslmode=disable` → ปิด TLS ทั้งหมด

There is **no separate TLS configuration to write** and no certificate path to
set: the `sslmode` parameter in your connection string is the entire mechanism.
Dropping it, or setting `sslmode=disable` against Supabase, will make the process
fail to connect — that is the expected failure, not a bug.

**ไม่มีคอนฟิก TLS แยกให้เขียน** และไม่มี path ใบรับรองให้ตั้ง พารามิเตอร์ `sslmode`
ใน connection string ของคุณคือกลไกทั้งหมด ถ้าเอาออก หรือตั้ง `sslmode=disable`
กับ Supabase โปรเซสจะต่อไม่ติด นั่นคือความล้มเหลวที่คาดไว้ ไม่ใช่บั๊ก

### 4.3 TLS for the HTTP listener / TLS ของตัว HTTP listener

The Express process itself speaks plain HTTP and does **not** terminate TLS. If
your deployment needs HTTPS, put it behind a proxy or a load balancer **that you
run**, and let that layer hold the certificate. This kit ships neither.

ตัวโปรเซส Express เองพูด HTTP ธรรมดา และ**ไม่ได้**จบ TLS ถ้า deploy ของคุณต้องใช้ HTTPS
ให้วางไว้หลังพร็อกซีหรือโหลดบาลานเซอร์**ที่คุณรันเอง** และให้ชั้นนั้นถือใบรับรอง
คิทนี้ไม่ได้ให้ทั้งสองอย่าง

---

## 5. Migrations — การ migration

There are **exactly two** migration files, and they are the only schema authority:

มี migration **สองไฟล์เท่านั้น** และเป็นแหล่งกำหนดสคีมาเพียงแหล่งเดียว

| File / ไฟล์ | Creates / สร้าง |
|---|---|
| `server/migrations/0001_persistence.sql` | the bookkeeping table `schema_migrations`; plus `tenants`, `plans`, `subscriptions`, `billing_event_ledger` and their indexes; and the two seed plans (`free`, `pro`). / ตารางบันทึกเวอร์ชัน `schema_migrations` รวมทั้ง `tenants`, `plans`, `subscriptions`, `billing_event_ledger` และ index ของมัน และแพ็กเกจ seed สองตัว (`free`, `pro`) |
| `server/migrations/0002_usage.sql` | the durable usage counter table `usage_counters` and its indexes; and it re-asserts the same two seed plan entitlements. / ตารางตัวนับการใช้แบบถาวร `usage_counters` และ index ของมัน และย้ำค่า entitlement ของแพ็กเกจ seed สองตัวเดิม |

**When they run.** At process start, and never at any other time. `server/src/index.ts`
calls `initSubscriptionRepositories()` **before** `app.listen`, so the migrations
are applied and the seed plans are upserted before the first request is served —
the plan catalogue can never be read against a half-migrated schema. There is no
separate `migrate` command to remember and no manual step: starting the server is
the migration.

**รันเมื่อไร** ตอนสตาร์ทโปรเซส และไม่รันเวลาอื่นเลย `server/src/index.ts` เรียก
`initSubscriptionRepositories()` **ก่อน** `app.listen` ดังนั้น migration จะถูกรันและ
แพ็กเกจ seed จะถูก upsert ก่อนเสิร์ฟคำขอแรก รายการแพ็กเกจจึงไม่ถูกอ่านกับสคีมาที่
migration ไม่ครบ ไม่มีคำสั่ง `migrate` แยกให้จำ และไม่มีขั้นที่ต้องทำมือ การสตาร์ท
เซิร์ฟเวอร์คือการ migration

**They are idempotent.** The runner reads `server/migrations/*.sql` in lexical
order, skips any version already recorded in `schema_migrations`, and runs each
pending file inside its own transaction together with its version insert. Every
statement in both files is itself re-runnable (`CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `ON CONFLICT` upsert). Starting the server twice
applies nothing the second time and prints no error.

**รันซ้ำได้** ตัวรันอ่าน `server/migrations/*.sql` ตามลำดับตัวอักษร ข้ามเวอร์ชันที่
บันทึกใน `schema_migrations` แล้ว และรันไฟล์ที่ยังค้างใน transaction ของตัวเอง
พร้อมกับการบันทึกเวอร์ชัน ทุกคำสั่งในทั้งสองไฟล์รันซ้ำได้เอง
(`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, upsert ด้วย
`ON CONFLICT`) การสตาร์ทเซิร์ฟเวอร์ครั้งที่สองจะไม่ทำอะไรเพิ่มและไม่พิมพ์ข้อผิดพลาด

**How to confirm it worked** — count the tables that exist:

    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name;

**Expected output (expected output):** six rows naming `billing_event_ledger`,
`plans`, `schema_migrations`, `subscriptions`, `tenants`, `usage_counters`.

```expected output
billing_event_ledger
plans
schema_migrations
subscriptions
tenants
usage_counters
```

Two seed plans result from the migrations alone: `free` (50 AI requests and 5
payments per month) and `pro` (1000 AI requests and 100 payments per month).

แพ็กเกจ seed สองตัวเกิดจาก migration เอง: `free` (AI 50 คำขอ และชำระเงิน 5 ครั้งต่อเดือน)
และ `pro` (AI 1000 คำขอ และชำระเงิน 100 ครั้งต่อเดือน)

---

## 6. Verification checklist — รายการตรวจสอบ

Run every line. Each has the observation that means it passed. Substitute your
own port if you did not use `3003`.

รันทุกบรรทัด แต่ละบรรทัดมีสิ่งที่ต้องเห็นจึงจะถือว่าผ่าน ถ้าคุณไม่ได้ใช้พอร์ต `3003`
ให้เปลี่ยนเป็นพอร์ตของคุณ

| # | Command / คำสั่ง | Expected observation / สิ่งที่ต้องเห็น |
|---|---|---|
| 1 | `node --version` | `v22.` or higher. / `v22.` ขึ้นไป |
| 2 | `cd server && npm ci` then `npm run typecheck` | exits 0 and prints no type error. / ออกด้วย 0 และไม่พิมพ์ type error |
| 3 | `cd server && npm test` | exits 0 with all test files passing. / ออกด้วย 0 โดยไฟล์เทสต์ทั้งหมดผ่าน |
| 4 | start with `DATABASE_URL` unset / สตาร์ทโดยไม่ตั้ง `DATABASE_URL` | logs `persistent=false` then `Server listening on port 3003`. / พิมพ์ `persistent=false` แล้ว `Server listening on port 3003` |
| 5 | `curl -s http://127.0.0.1:3003/health` | `{"ok":true}` / เหมือนกัน |
| 6 | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/` | `200` — the sample UI landing page is served. / `200` — หน้าแรกของ UI ตัวอย่างถูกเสิร์ฟ |
| 7 | `curl -s -H 'x-tenant-id: acme' http://127.0.0.1:3003/me` | `503` with `Auth not configured on this server instance` when no Supabase keys are set. This is correct, not a failure: real log in needs your own Supabase project. / `503` พร้อม `Auth not configured on this server instance` เมื่อยังไม่ตั้งคีย์ Supabase นี่ถูกต้อง ไม่ใช่ความล้มเหลว เพราะ log in จริงต้องมีโปรเจกต์ Supabase ของคุณเอง |
| 8 | start with your `DATABASE_URL` set / สตาร์ทโดยตั้ง `DATABASE_URL` ของคุณ | logs `persistent=true subscriptions=PostgresSubscriptionRepository usageCounters=PostgresUsageCounterRepository`. / พิมพ์ตามนั้น |
| 9 | `curl -s http://127.0.0.1:3003/ui/plans.json` | `200` with a JSON body containing `free` and `pro` and their entitlements, read from **your** database. / `200` พร้อม JSON ที่มี `free` และ `pro` และ entitlement ของมัน อ่านจากฐานข้อมูล**ของคุณ** |
| 10 | start with `NODE_ENV=production DEMO_AUTH=true` / สตาร์ทด้วย `NODE_ENV=production DEMO_AUTH=true` | logs a `[demo-auth] REFUSED:` line, and `GET /me` answers `503` with code `DEMO_AUTH_REFUSED_IN_PRODUCTION`. / พิมพ์บรรทัด `[demo-auth] REFUSED:` และ `GET /me` ตอบ `503` พร้อมรหัส `DEMO_AUTH_REFUSED_IN_PRODUCTION` |

### The routes this server actually registers / เส้นทางที่เซิร์ฟเวอร์นี้ลงทะเบียนจริง

Every route below is registered in `server/src/app.ts` or served by the page map
in `server/src/lib/web-pages.ts`. Nothing else is routed.

ทุกเส้นทางด้านล่างลงทะเบียนใน `server/src/app.ts` หรือเสิร์ฟโดยแผนผังหน้าเว็บใน
`server/src/lib/web-pages.ts` ไม่มีเส้นทางอื่น

| Method / เมธอด | Path / เส้นทาง | Notes / หมายเหตุ |
|---|---|---|
| POST | `/payment/webhook` | Mounted first, before the JSON body parser, so the raw signed body survives for signature verification. / mount ก่อนเป็นอันแรก ก่อนตัวแยก JSON เพื่อให้เนื้อความที่เซ็นแล้วคงสภาพไว้ตรวจลายเซ็น |
| GET | `/health` | Public liveness check. / ตรวจว่ายังทำงาน สาธารณะ |
| GET | `/` and `/index.html` | Sample UI landing page. / หน้าแรกของ UI ตัวอย่าง |
| GET | `/signup` and `/signup.html` | Sample UI sign-up screen. / หน้าสมัคร |
| GET | `/login` and `/login.html` | Sample UI log-in screen. / หน้าเข้าสู่ระบบ |
| GET | `/plans` and `/plans.html` | Sample UI choose-a-plan screen. / หน้าเลือกแพ็กเกจ |
| GET | `/app` and `/app.html` | Sample UI use-the-AI screen. / หน้าใช้ AI |
| GET | `/assets/*` | Static JS and CSS for the sample UI. / ไฟล์ JS และ CSS ของ UI ตัวอย่าง |
| GET | `/ui/plans.json` | Public read-only plan catalogue. / รายการแพ็กเกจแบบอ่านอย่างเดียว |
| GET | `/whoami` | Echoes the resolved tenant context. / สะท้อน tenant context ที่ resolve แล้ว |
| GET | `/me` | Identity endpoint. / เส้นทางตัวตน |
| POST | `/ai/demo` | Quota-gated AI call. / เรียก AI ซึ่งผ่านโควตาก็ |
| POST | `/subscription/subscribe` | Creates a subscription. / สร้าง subscription |
| GET | `/subscription/status` | Reads subscription and entitlement. / อ่าน subscription และ entitlement |
| POST | `/payment/demo-charge` | Quota-gated payment call. / เรียก payment ซึ่งผ่านโควตาก็ |

### What the author of this manual observed / ผู้เขียนคู่มือนี้เห็นอะไรจริง

These are the observations produced while writing this manual, on the author's
machine, against a local test database. They are recorded so you know what the
output looks like — they are **not** a claim about your machine or your host.

นี่คือผลที่เห็นจริงตอนเขียนคู่มือนี้ บนเครื่องผู้เขียน กับฐานข้อมูลทดสอบในเครื่อง
บันทึกไว้ให้รู้ว่าผลลัพธ์หน้าตาเป็นอย่างไร — **ไม่ใช่** คำรับรองเกี่ยวกับเครื่องหรือ
โฮสต์ของคุณ

- `node --version` → `v24.19.0`; `npm --version` → `11.11.1`
- `npm run typecheck` → exit code 0
- `npm test` → exit code 0, summary lines `Test Files  5 passed (5)` and
  `Tests  51 passed (51)`
- start without `DATABASE_URL` → `persistent=false subscriptions=Object usageCounters=Object`
- `GET /health` → `{"ok":true}`; `GET /` → HTTP 200; `GET /me` with `x-tenant-id` → HTTP 503
- start with a database URL → `persistent=true subscriptions=PostgresSubscriptionRepository usageCounters=PostgresUsageCounterRepository`
- `NODE_ENV=production DEMO_AUTH=true` → the `[demo-auth] REFUSED:` line, and `GET /me` → HTTP 503 with `DEMO_AUTH_REFUSED_IN_PRODUCTION`

---

## 7. Rollback — การย้อนกลับ

Go back to the previous state safely. The process has no state of its own worth
preserving; the database does.

ย้อนกลับสู่สภาพก่อนหน้าอย่างปลอดภัย ตัวโปรเซสไม่มีสถานะของตัวเองที่ต้องรักษา
ส่วนฐานข้อมูลมี

**1. Stop the new process.** Stop the process you started, or disable the service
unit, so nothing is mid-migration while you act. / **หยุดโปรเซสใหม่** หยุดโปรเซสที่คุณ
เริ่ม หรือปิด service unit เพื่อไม่ให้มีอะไรกำลัง migration ระหว่างที่คุณดำเนินการ

**2. Roll back the code, not the data.** Check out the previous revision of the
code and restart:

    git -C . log --oneline -5
    git -C . checkout <PREVIOUS_REVISION>
    cd server && npm ci && npm run start

**ย้อนโค้ด ไม่ใช่ย้อนข้อมูล** checkout เรดิสทอรีเวอร์ชันก่อนหน้าแล้วสตาร์ทใหม่

**3. Do NOT reverse the migrations by dropping tables.** The migrations are
additive and idempotent: they only `CREATE ... IF NOT EXISTS` and upsert two plan
rows. An older revision of the code ignores the tables it does not know about, so
rolling the code back **without touching the schema** is the safe rollback. There
is no `down` migration and none is needed.

**อย่าย้อน migration ด้วยการ drop ตาราง** migration เป็นการเพิ่มและรันซ้ำได้: มันแค่
`CREATE ... IF NOT EXISTS` และ upsert แพ็กเกจสองแถว โค้ดเวอร์ชันเก่าจะไม่สนใจตารางที่
มันไม่รู้จัก ดังนั้นการย้อนโค้ด**โดยไม่แตะสคีมา**คือวิธีที่ปลอดภัย ไม่มี migration
แบบ `down` และไม่จำเป็นต้องมี

**4. If a start failed on a bad connection string**, the rollback is simply
correcting `DATABASE_URL` in the process environment and restarting. A failed
migration run rolls its own transaction back, so a half-applied migration is not
left behind. / **ถ้าสตาร์ทล้มเหลวเพราะ connection string ผิด** การย้อนกลับคือแก้
`DATABASE_URL` ใน process environment แล้วสตาร์ทใหม่ การ migration ที่ล้มเหลวจะ
rollback transaction ของตัวเอง จึงไม่เหลือ migration ที่ทำไปครึ่งเดียว

**5. Last resort — restore from your own backup.** If you need the database
itself back to an earlier state, restore from the backup **you** took before
deploying. This kit ships no backup tool and no snapshot. / **ทางเลือกสุดท้าย —
กู้จากแบ็กอัปของคุณเอง** ถ้าต้องให้ฐานข้อมูลกลับไปสู่สภาพก่อนหน้า ให้กู้จากแบ็กอัป
ที่**คุณ**ทำไว้ก่อน deploy คิทนี้ไม่มีเครื่องมือแบ็กอัปและไม่มี snapshot

---

## 8. Security — ความปลอดภัย

### `DEMO_AUTH` must never be enabled in production / `DEMO_AUTH` ต้องไม่ถูกเปิดบน production เด็ดขาด

`DEMO_AUTH=true` turns on a **demonstration identity gate** that exists so the
sample UI can be walked on a clean machine with no Supabase project. It is not
authentication and it must never be enabled where real users or real data are
involved.

`DEMO_AUTH=true` เปิด **gate ตัวตนสาธิต** ซึ่งมีไว้ให้เดินหน้า UI ตัวอย่างบนเครื่องสะอาด
ที่ไม่มีโปรเจกต์ Supabase มันไม่ใช่การยืนยันตัวตน และต้องไม่ถูกเปิดที่ใดที่มีผู้ใช้จริง
หรือข้อมูลจริง

**The demo identity is NOT authentication.** It establishes identity from a
header the caller types (`x-demo-account`, falling back to `x-tenant-id`), with no
password, no user record, no token and no signature. Nothing is verified and
nothing is looked up. Anyone who can reach the port can name any account.

**ตัวตนสาธิตไม่ใช่การยืนยันตัวตน** มันสร้างตัวตนจาก header ที่ผู้เรียกพิมพ์เอง
(`x-demo-account` หรือถอยไปใช้ `x-tenant-id`) โดยไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้
ไม่มีโทเคน และไม่มีลายเซ็น ไม่มีการตรวจสอบใด ๆ และไม่มีการค้นข้อมูลใด ๆ
ใครก็ตามที่ต่อถึงพอร์ตได้ สามารถตั้งชื่อบัญชีใดก็ได้

**The code enforces the refusal.** You do not have to remember this rule — the
server refuses for you. When `DEMO_AUTH=true` and `NODE_ENV=production`, the
server:

1. prints one line beginning `[demo-auth] REFUSED:` at boot;
2. mounts the refusal middleware **instead of** the demo gate, so no demo
   identity can ever be established on that process; and
3. answers `503` with code `DEMO_AUTH_REFUSED_IN_PRODUCTION` on the protected
   routes.

**โค้ดบังคับการปฏิเสธให้เอง** คุณไม่ต้องจำกฎนี้ เซิร์ฟเวอร์ปฏิเสธให้ เมื่อ
`DEMO_AUTH=true` และ `NODE_ENV=production` เซิร์ฟเวอร์จะ

1. พิมพ์บรรทัดที่ขึ้นต้นด้วย `[demo-auth] REFUSED:` ตอนบูต
2. mount middleware ที่ปฏิเสธ **แทน** gate สาธิต ตัวตนสาธิตจึงถูกสร้างบนโปรเซสนั้นไม่ได้เลย
3. ตอบ `503` พร้อมรหัส `DEMO_AUTH_REFUSED_IN_PRODUCTION` บนเส้นทางที่ป้องกันไว้

**Expected output (expected output):** with those two variables set, `GET /me`
answers:

```expected output
{"error":"Demonstration identity mode (DEMO_AUTH) is refused on a production server instance","code":"DEMO_AUTH_REFUSED_IN_PRODUCTION"}
```

**What the refusal does and does not cover.** It is a hard stop for the demo gate,
and it is the guarantee that this kit cannot accidentally ship a demo identity in
production. It does **not** make the deployment production-safe on its own: you
still own TLS, rate limiting, secret storage and the Supabase project the real
auth path verifies against. See section 9.

**การปฏิเสธนี้ครอบอะไร และไม่ครอบอะไร** มันหยุด gate สาธิตแบบเด็ดขาด และเป็น
หลักประกันว่าคิทนี้จะไม่เผลอส่งตัวตนสาธิตขึ้น production แต่ตัวมันเอง**ไม่ได้**ทำให้
deployment ปลอดภัยสำหรับ production: คุณยังต้องดูแล TLS, rate limiting,
การเก็บ secret และโปรเจกต์ Supabase ที่เส้นทาง auth จริงใช้ตรวจเอง ดูข้อ 9

### Other security facts worth stating plainly / ข้อเท็จจริงด้านความปลอดภัยอื่นที่ควรระบุตรง ๆ

- **No credential is stored in any file by this kit.** There is no `.env` reader
  to store one in (section 3.3). Secrets travel in the process environment or in
  your platform's secret store.
  / **คิทนี้ไม่เก็บ credential ลงไฟล์ใด** ไม่มีตัวอ่าน `.env` ให้เก็บ (ข้อ 3.3)
  secret เดินทางใน process environment หรือ secret store ของแพลตฟอร์มคุณ
- **The repository contains no real credential.** It contains placeholder prefixes
  in documentation and test fixtures only, and those are not usable values.
  / **เรดิสทอรีนี้ไม่มี credential จริง** มีแต่คำนำหน้าแบบตัวอย่างในเอกสารและไฟล์เทสต์
  ซึ่งไม่ใช่ค่าที่ใช้ได้
- **Keep `NODE_ENV=production` set on a real deployment.** It is not only for the
  demo refusal; it is the signal the process uses to know it is not a demo.
  / **ตั้ง `NODE_ENV=production` บน deploy จริง** ไม่ได้มีไว้แค่การปฏิเสธโหมดสาธิต
  มันเป็นสัญญาณที่โปรเซสบอกตัวเองว่าที่นี่ไม่ใช่โหมดสาธิต

---

## 9. Limits — ข้อจำกัด

What is still **not implemented**. Do not read anything above as a claim that
these exist.

สิ่งที่**ยังไม่ได้ทำ** อย่าตีความข้อใดข้างบนว่าเป็นคำรับรองว่าสิ่งเหล่านี้มีอยู่

1. **No OpenTelemetry exporter.** The tracing module records spans in process
   memory only. There is no OTLP endpoint and no collector export. / **ไม่มี
   OpenTelemetry exporter** โมดูล tracing เก็บ span ในหน่วยความจำของโปรเซสเท่านั้น
   ไม่มี OTLP endpoint และไม่มีการส่งออกไป collector
2. **No LINE webhook verifier.** The verifier returns `WEBHOOK_UNKNOWN_PROVIDER`
   and states plainly that it is not implemented. / **ไม่มีตัวตรวจสอบ webhook ของ
   LINE** ตัวตรวจสอบคืน `WEBHOOK_UNKNOWN_PROVIDER` และระบุตรง ๆ ว่ายังไม่ได้ทำ
3. **No GitHub webhook verifier.** Same behaviour: `WEBHOOK_UNKNOWN_PROVIDER`.
   / **ไม่มีตัวตรวจสอบ webhook ของ GitHub** พฤติกรรมเดียวกัน: `WEBHOOK_UNKNOWN_PROVIDER`
4. **No real Supabase auth verification against your own project.** The auth path
   exists in code, but it has never been exercised against a real Supabase
   project, because this repository ships none and the authors used none. You are
   the first to point it at a real project, and that is untested. / **ไม่มีการ
   ยืนยันตัวตน Supabase จริงกับโปรเจกต์ของคุณ** เส้นทาง auth มีในโค้ด แต่ไม่เคยถูกใช้
   กับโปรเจกต์ Supabase จริง เพราะเรดิสทอรีนี้ไม่มีและผู้เขียนไม่ได้ใช้ คุณจะเป็น
   คนแรกที่ชี้มันไปที่โปรเจกต์จริง และส่วนนั้นยังไม่ถูกทดสอบ
5. **No rate limiting on `POST /payment/webhook`.** The endpoint is authenticated
   by webhook signature verification, not by tenant identity, and it has no rate
   limit and no replay-window defence beyond its idempotency ledger. Do not treat
   it as hardened. / **ไม่มี rate limiting บน `POST /payment/webhook`** เส้นทางนี้
   ยืนยันด้วยลายเซ็น webhook ไม่ใช่ด้วยตัวตน tenant และไม่มี rate limit และไม่มี
   การป้องกันการเล่นซ้ำเกินกว่า ledger กันซ้ำของมัน อย่าถือว่ามันแข็งแรงแล้ว
6. **No multi-instance deployment proof.** Everything here was run as a single
   process against a single database. Running several instances behind a load
   balancer has not been tested, and the in-memory fallback is per-process.
   / **ไม่มีหลักฐานการ deploy หลายอินสแตนซ์** ทุกอย่างที่นี่รันเป็นโปรเซสเดียวกับ
   ฐานข้อมูลเดียว การรันหลายอินสแตนซ์หลังโหลดบาลานเซอร์ยังไม่ถูกทดสอบ และโหมด
   ในหน่วยความจำแยกตามโปรเซส
7. **No in-browser UI test.** The sample UI evidence is real HTTP responses and
   saved HTML files, not browser screenshots. No headless browser was driven, so
   no claim is made about layout, styling or JavaScript behaviour in a real
   browser. / **ไม่มีการทดสอบ UI ในเบราว์เซอร์** หลักฐานของ UI ตัวอย่างคือคำตอบ HTTP
   จริงและไฟล์ HTML ที่บันทึกไว้ ไม่ใช่ภาพหน้าจอจากเบราว์เซอร์ ไม่ได้ขับเบราว์เซอร์
   จริง จึงไม่มีการอ้างเรื่องการจัดวาง การตกแต่ง หรือพฤติกรรม JavaScript ในเบราว์เซอร์จริง

**One more limit, stated about this document itself.** This manual has **not**
been validated by a different agent following it on a fresh folder. That
validation is a separate step, performed by someone other than the author of
these files, and it had not been performed when this document was written. Until
it is, treat this manual as **written and gated, not proven**.

**ข้อจำกัดอีกข้อ เกี่ยวกับเอกสารนี้เอง** คู่มือนี้**ยังไม่**ถูกตรวจสอบโดย agent อีกตัว
ที่ทำตามบนโฟลเดอร์ใหม่ การตรวจนั้นเป็นขั้นแยก ทำโดยคนอื่นที่ไม่ใช่ผู้เขียนไฟล์เหล่านี้
และยังไม่ได้ทำตอนเขียนเอกสารนี้ ตราบใดที่ยังไม่ทำ ให้ถือว่าคู่มือนี้**เขียนเสร็จและผ่าน
gate แล้ว แต่ยังไม่ถูกพิสูจน์**

Nothing in this document is an approval, and none of the checks above constitute
a PASS by an independent party.

ไม่มีข้อใดในเอกสารนี้เป็นการอนุมัติ และการตรวจข้อใดข้างบนไม่ถือเป็น PASS โดยบุคคลที่
เป็นอิสระ
