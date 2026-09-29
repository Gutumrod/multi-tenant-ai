# WU-5 Deployment Manual — Multi-Tenant AI Starter Kit (MT01)

# คู่มือ deploy WU-5 — Multi-Tenant AI Starter Kit (MT01)

One deployment path, stated plainly. Everything in this document was checked
against the source tree of this repository. Read section 1 first, because it
tells you what this document is not.

เส้นทาง deploy ทางเดียว ระบุตรง ๆ ทุกอย่างในเอกสารนี้ตรวจกับซอร์สของที่เก็บโค้ดนี้แล้ว
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

**ทำไมมีทางเดียว** เพราะในที่เก็บโค้ดนี้ไม่มีอย่างอื่นให้เลือก **ไม่มี `Dockerfile`
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
- **ที่เก็บโค้ดนี้ไม่มี credential และไม่มีฐานข้อมูลให้** คุณต้องใส่ที่อยู่ฐานข้อมูลและ
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
| 3 | A process supervisor of your own (systemd, your platform's service manager, or any supervisor you already run). / **process supervisor ของคุณเอง** (systemd, ตัวจัดการ service ของแพลตฟอร์มคุณ หรือ supervisor ใดก็ได้ที่มีอยู่แล้ว) | This repository ships none. The process must survive a crash and restart on boot; that is your layer, not this kit's. / ที่เก็บโค้ดนี้ไม่มีให้ โปรเซสต้องรอดจากการ crash และเริ่มใหม่ตอนบูต นั่นเป็นชั้นของคุณ ไม่ใช่ของคิทนี้ |

**Read that table as external software, not as install steps.** The three rows
above are the software you must *have*, and there is nothing else you must have.
They are **not** a claim that there is nothing to do: there is exactly one
mandatory install step, and it is yours — **`npm ci` must be run inside
`server/` before the first start** (section 3.2). Nothing arrives
pre-installed: the delivered folder contains no `node_modules/`, and no
dependency has been fetched for you. Skipping that step means `npm run start`
fails immediately with a module-not-found error.

**ให้อ่านตารางข้างบนเป็น "ซอฟต์แวร์ภายนอก" ไม่ใช่ "ขั้นตอนติดตั้ง"** สามแถวนั้นคือ
ซอฟต์แวร์ที่คุณต้อง*มี* และไม่มีอย่างอื่นที่คุณต้องมี มันไม่ได้บอกว่าไม่มีอะไรต้อง*ทำ*:
มีขั้นติดตั้งที่บังคับอยู่หนึ่งขั้น และเป็นของคุณ — **ต้องรัน `npm ci` ข้างใน `server/`
ก่อนสตาร์ทครั้งแรก** (ข้อ 3.2) ไม่มีอะไรติดตั้งมาให้ล่วงหน้า โฟลเดอร์ส่งมอบไม่มี
`node_modules/` และไม่มี dependency ถูกดึงมาให้ ถ้าข้ามขั้นนี้ `npm run start`
จะล้มเหลวทันทีด้วยข้อผิดพลาดหาโมดูลไม่เจอ

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

เอกสารรุ่นเก่าบางไฟล์ในที่เก็บโค้ดนี้ระบุว่า "Node.js 20 ขึ้นไป" **ข้อความนั้นผิด**
dependency ที่ติดตั้งอยู่ต้องการ **Node.js 22 ขึ้นไป** ให้ทำตามคู่มือนี้ ไม่ใช่ข้อความนั้น
บรรทัดที่ผิดนั้นถูกทิ้งไว้ตามเดิม แทนที่จะแก้เงียบ ๆ ในเอกสารที่ใบงานนี้ไม่ได้เป็นเจ้าของ

---

## 3. Step-by-step install — ขั้นตอนติดตั้งทีละขั้น

Every step below gives the exact command and the exact observation that tells you
it worked. Run them from the repository root unless a step says otherwise.

ทุกขั้นด้านล่างมีคำสั่งที่ใช้จริงและสิ่งที่คุณต้องเห็นเพื่อยืนยันว่าได้ผล รันจาก root
ของที่เก็บโค้ด เว้นแต่ขั้นนั้นระบุไว้เป็นอย่างอื่น

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

**If you received a delivered folder instead of a repository URL, do not use
`git clone`.** A delivered folder normally carries **no `.git` directory**, and
in that case **`git clone` and `git checkout` are unavailable** — they fail with
a git error saying the location is not a repository. The delivered folder *is*
the source. Obtain it without any git remote by copying it into place or by
unzipping the archive you were given, and then go straight on to step 3.2:

    cp -R <THE_DELIVERED_FOLDER> multi-tenant-ai
    cd multi-tenant-ai

Nothing else in this manual needs a git remote either: every other command runs
inside the folder you just placed, and the rollback in section 7 has a
no-git-history path for exactly this case.

**ถ้าคุณได้รับ "โฟลเดอร์ส่งมอบ" แทน URL ของที่เก็บโค้ด อย่าใช้ `git clone`**
โฟลเดอร์ส่งมอบปกติ**ไม่มีไดเรกทอรี `.git`** และในกรณีนั้น **`git clone` และ
`git checkout` ใช้ไม่ได้** — จะล้มเหลวด้วยข้อผิดพลาดของ git ว่าไม่ใช่รีโป
โฟลเดอร์ส่งมอบ*คือ*ซอร์ส รับมันโดยไม่ต้องมี git remote ด้วยการคัดลอกเข้ามา หรือ
แตกไฟล์ archive ที่คุณได้รับ แล้วไปขั้น 3.2 ได้เลย

    cp -R <โฟลเดอร์ส่งมอบของคุณ> multi-tenant-ai
    cd multi-tenant-ai

ข้ออื่นในคู่มือนี้ไม่ต้องใช้ git remote เช่นกัน เพราะทุกคำสั่งรันอยู่ในโฟลเดอร์ที่คุณ
วางไว้ และการย้อนกลับในข้อ 7 มีทางที่ไม่ต้องใช้ประวัติ git สำหรับกรณีนี้โดยเฉพาะ

**Copy the whole delivered folder — do not copy `server/` on its own.** Three
top-level directories must sit **beside `server/`** and travel together:
`server/`, `modules/` and `web/`. The source states why. `server/src` imports
runtime code from `../../../modules/` — for example `server/src/lib/ai.ts`
imports `../../../modules/ai-provider/index.js` and `server/src/lib/ai.ts`
imports `../../../modules/enterprise-features/index.js` — and the page shell
reads its files from `../web/`: `server/src/lib/web-pages.ts` sets
`WEB_ROOT = join(here, '../../../web')` and imports `../../../web/assets/i18n.js`.
**An install where only `server/` was copied cannot start**, because those
imports and the page assets are not there. `scripts/` is not needed by the
running process, but it is where the setup script and `db-check.mjs` live
(section 3.2), so keep it too. Keep all four directories as siblings.

**คัดลอกทั้งโฟลเดอร์ส่งมอบ — อย่าคัดลอกแค่ `server/`** มีไดเรกทอรีระดับบนสุดสามตัว
ที่ต้องอยู่**ข้าง `server/`** และไปด้วยกัน: `server/`, `modules/` และ `web/`
เหตุผลอยู่ในซอร์ส: `server/src` import โค้ดตอนรันจาก `../../../modules/` เช่น
`server/src/lib/ai.ts` import `../../../modules/ai-provider/index.js` และ
`../../../modules/enterprise-features/index.js` และเชลล์ของหน้าเว็บอ่านไฟล์จาก
`../web/`: `server/src/lib/web-pages.ts` ตั้ง `WEB_ROOT = join(here, '../../../web')`
และ import `../../../web/assets/i18n.js` **การติดตั้งที่คัดลอกมาแค่ `server/`
จะสตาร์ทไม่ขึ้น** เพราะ import เหล่านั้นและไฟล์หน้าเว็บไม่มีอยู่ `scripts/` ไม่จำเป็น
กับโปรเซสที่รันอยู่ แต่เป็นที่อยู่ของสคริปต์ตั้งค่าและ `db-check.mjs` (ข้อ 3.2)
จึงควรเก็บไว้ด้วย ให้เก็บทั้งสี่ไดเรกทอรีไว้เป็นพี่น้องกัน

### 3.2 Install dependencies / ขั้นที่ 2 ติดตั้ง dependency

    cd server
    npm ci

`npm ci` installs exactly the lockfile's versions and is the reproducible choice.
`npm install` also works if you intend to update the lockfile.

`npm ci` ติดตั้งเวอร์ชันตาม lockfile เป๊ะ ๆ และเป็นตัวเลือกที่ทำซ้ำได้ ส่วน `npm install`
ก็ใช้ได้ถ้าคุณตั้งใจจะอัปเดต lockfile

**Warning — `npm ci` under `NODE_ENV=production` omits devDependencies.**
`tsx`, `typescript` and `vitest` are devDependencies, so an install performed in
production mode produces a tree that **cannot run `npm run start`** (that script
is `tsx src/index.ts`) and **cannot run `npm run typecheck`** (`tsc --noEmit`).
Either run this step with `NODE_ENV` unset — the production value matters when you
**start** the server, at section 3.4, not when you install — or, if you need
`NODE_ENV=production` in the environment, install with
`npm ci --include=dev`. The setup script in this section does the latter.

**คำเตือน — `npm ci` ขณะตั้ง `NODE_ENV=production` จะไม่ติดตั้ง devDependencies**
`tsx`, `typescript` และ `vitest` เป็น devDependencies การติดตั้งในโหมด production
จึงได้ต้นไม้ที่ **รัน `npm run start` ไม่ได้** (สคริปต์นั้นคือ `tsx src/index.ts`) และ
**รัน `npm run typecheck` ไม่ได้** (`tsc --noEmit`) ให้รันขั้นนี้โดยไม่ตั้ง `NODE_ENV`
— ค่า production สำคัญตอน**สตาร์ท**เซิร์ฟเวอร์ที่ข้อ 3.4 ไม่ใช่ตอนติดตั้ง — หรือถ้าจำเป็น
ต้องมี `NODE_ENV=production` ในสภาพแวดล้อม ให้ติดตั้งด้วย `npm ci --include=dev`
สคริปต์ตั้งค่าในข้อนี้ใช้วิธีหลัง

**Run this step from inside `server/`.** The command above changes into it first,
and that is not optional: the manifest and the lockfile live in `server/`, not at
the top level, so `npm ci` run from the delivered folder's root finds nothing to
install and the server still cannot start.

**ต้องรันขั้นนี้จากข้างใน `server/`** คำสั่งข้างบนเข้าไปใน `server/` ก่อน และนั่นไม่ใช่
ทางเลือก เพราะ manifest กับ lockfile อยู่ใน `server/` ไม่ได้อยู่ที่ระดับบนสุด ถ้ารัน
`npm ci` จาก root ของโฟลเดอร์ส่งมอบ จะไม่มีอะไรให้ติดตั้ง และเซิร์ฟเวอร์ก็ยังสตาร์ทไม่ขึ้น

**A setup script ships with this manual and can do this step for you.** Two files
sit in the delivered folder beside `docs/`: the script
`scripts/house-swarm-7/setup.sh` and its description
`scripts/house-swarm-7/setup.md`. Read `setup.md` before running the script — it
is short and it is the script's own statement of what it does.

- **What the script does.** Five things in order, then it stops: it checks that
  Node.js 22 or newer and npm are present; it checks the environment (`DATABASE_URL`
  set unless you asked for in-memory mode, `PORT` numeric if set, `DEMO_AUTH` not
  `true`); it runs `npm ci --include=dev` here, in `server/`, from the lockfile
  (devDependencies included, so the tree can start and typecheck regardless of
  `NODE_ENV`); it runs the
  project's own `npm run typecheck`; and it runs
  `scripts/house-swarm-7/db-check.mjs` to report whether the database is reachable
  and whether the six migration tables and the two seed plans exist yet.
- **What the script does NOT do.** It does **not** start the server and does not
  deploy anything. It does **not** apply migrations — the server applies them at
  boot (section 5). It writes no file, so it cannot write a credential to one. It
  does not read a `.env` file, and it never sets `DEMO_AUTH`. It guesses no
  database address and no credential: a missing `DATABASE_URL` is a refusal, not a
  default.

    sh scripts/house-swarm-7/setup.sh                # against your own database
    sh scripts/house-swarm-7/setup.sh --in-memory    # no database; nothing persists

The script is **optional**. It automates steps 3.2 to 3.5 and checks the
environment; it is not a deployment and it is not a replacement for this manual.
Running the commands in this section by hand gives the same result. A reachable
database whose schema does not exist yet is reported `PENDING`, which is not an
error — it means the server has not run its migrations yet, and starting the
server once (section 3.4) creates them.

**มีสคริปต์ตั้งค่าแถมมากับคู่มือนี้ และทำขั้นนี้ให้คุณได้** มีสองไฟล์อยู่ในโฟลเดอร์ส่งมอบ
ข้าง ๆ `docs/`: ตัวสคริปต์ `scripts/house-swarm-7/setup.sh` และเอกสารอธิบาย
`scripts/house-swarm-7/setup.md` อ่าน `setup.md` ก่อนรันสคริปต์ — มันสั้น และเป็นคำอธิบาย
ของสคริปต์เองว่าทำอะไร

- **สคริปต์ทำอะไร** ห้าอย่างตามลำดับ แล้วหยุด: ตรวจว่ามี Node.js 22 ขึ้นไปและ npm,
  ตรวจตัวแปรสภาพแวดล้อม (`DATABASE_URL` ต้องตั้ง เว้นแต่ขอโหมด in-memory, `PORT` ต้องเป็น
  ตัวเลขถ้าตั้ง, `DEMO_AUTH` ต้องไม่ใช่ `true`), รัน `npm ci` ที่นี่ใน `server/` จาก lockfile,
  รัน `npm run typecheck` ของโปรเจกต์เอง และรัน `scripts/house-swarm-7/db-check.mjs`
  เพื่อรายงานว่าต่อฐานข้อมูลได้ไหม และตารางจาก migration หกตารางกับแพ็กเกจ seed สองตัวมีแล้วหรือยัง
- **สคริปต์ไม่ทำอะไร** **ไม่**สตาร์ทเซิร์ฟเวอร์และไม่ deploy อะไร **ไม่** apply migration —
  เซิร์ฟเวอร์ทำตอนบูต (ข้อ 5) ไม่เขียนไฟล์ใด จึงเขียน credential ลงไฟล์ไม่ได้ ไม่อ่านไฟล์
  `.env` และไม่ตั้ง `DEMO_AUTH` เลย ไม่เดาที่อยู่ฐานข้อมูลและไม่เดา credential: ถ้าไม่มี
  `DATABASE_URL` ถือเป็นการปฏิเสธ ไม่ใช่ค่าเริ่มต้น

สคริปต์นี้**ไม่บังคับ** มันช่วยรันขั้น 3.2 ถึง 3.5 และตรวจสภาพแวดล้อมให้ ไม่ใช่การ deploy
และไม่ใช่ตัวแทนของคู่มือนี้ การรันคำสั่งในข้อนี้เองให้ผลเหมือนกัน ฐานข้อมูลที่ต่อได้แต่ยังไม่มี
สคีมาจะถูกรายงานว่า `PENDING` ซึ่งไม่ใช่ข้อผิดพลาด — หมายความว่าเซิร์ฟเวอร์ยังไม่ได้รัน
migration และการสตาร์ทเซิร์ฟเวอร์หนึ่งครั้ง (ข้อ 3.4) จะสร้างสคีมาให้

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

ไฟล์ `server/.env.example` ในที่เก็บโค้ดนี้เป็น**เอกสารเท่านั้น** มันคือรายการชื่อตัวแปร
ที่โค้ดอ่าน เก็บไว้ให้เห็นครบในที่เดียว ไม่มีอะไรอ่านมัน อย่าถือว่ามันเป็นไฟล์คอนฟิก

**The complete set of variables the server reads — exactly thirteen:**

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
| `WEBHOOK_RATE_LIMIT_MAX` | optional / ไม่บังคับ | Rate limit for `POST /payment/webhook`: requests allowed per window. Unit is **requests** (a count, not seconds). Default `60`. A value that is not a positive integer is rejected, clamped to `60`, and warned about — it can never disable the limiter. / rate limit ของ `POST /payment/webhook`: จำนวนคำขอที่อนุญาตต่อหนึ่งหน้าต่าง หน่วยเป็น**จำนวนคำขอ** (ไม่ใช่วินาที) ค่าเริ่มต้น `60` ค่าที่ไม่ใช่จำนวนเต็มบวกจะถูกปฏิเสธ clamp เป็น `60` และมีคำเตือน — ปิด limiter ไม่ได้เด็ดขาด |
| `WEBHOOK_RATE_LIMIT_WINDOW_MS` | optional / ไม่บังคับ | Length of the rate limit window for `POST /payment/webhook`. Unit is **milliseconds**, not seconds. Default `60000` (60 requests per 60 seconds). See `docs/house-swarm-7/FU-RATELIMIT.md`. / ความยาวหน้าต่างของ rate limit สำหรับ `POST /payment/webhook` หน่วยเป็น**มิลลิวินาที** ไม่ใช่วินาที ค่าเริ่มต้น `60000` (60 คำขอต่อ 60 วินาที) ดู `docs/house-swarm-7/FU-RATELIMIT.md` |

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

**ที่อยู่และ credential เป็นของคุณ** ไม่มีอะไรในที่เก็บโค้ดนี้ และไม่มีอะไรในเอกสารนี้
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

Using this section does not mean the kit has been tested with Supabase: it has not
(see `docs/CURRENT_STATUS.md` item 4).

การใช้ข้อนี้ไม่ได้หมายความว่าคิทนี้เคยถูกทดสอบกับ Supabase — ยังไม่เคย
(ดู `docs/CURRENT_STATUS.md` ข้อ 4)

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

**`psql` is optional — do not assume it is installed.** That statement is given
as SQL, not as a `psql` command, because the PostgreSQL **client** tooling may be
absent from your machine even when the server is running somewhere reachable;
only the database server matters to this deployment. Use whichever of these you
have:

- **If you have `psql`:** run it against your own connection string, e.g.
  `psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"`.
- **If you do not have `psql` — use the project's own dependencies, which are
  already installed after step 3.2.** The kit ships exactly this probe:
  `scripts/house-swarm-7/db-check.mjs` runs the equivalent query through the
  `pg` package that `server/node_modules` already provides, prints whether the
  six migrated tables and the two seed plans are present, and adds no
  dependency. Run it with `DATABASE_URL` set in the process environment:

      node scripts/house-swarm-7/db-check.mjs

  It prints one `CHECK <name> PASS|FAIL <detail>` line per check and exits
  non-zero if any check fails. If the database is reachable but the schema is not
  created yet it reports the missing tables and tells you to start the server
  once; the setup script (section 3.2) treats that case as `PENDING`.
- **Or write the one query yourself** against the same `pg` package, from
  `server/`: any script that opens a `pg.Client` with `process.env.DATABASE_URL`
  and runs the statement above gets the same six rows.

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

`db-check.mjs` reports the same thing in its own shape:
`CHECK migration-tables PASS all 6 expected tables present` and
`CHECK seed-plans PASS both seed plans present: free, pro`.

**วิธีตรวจว่าได้ผล** — นับตารางที่มีอยู่ (คำสั่ง SQL ข้างบน)

**`psql` ไม่บังคับ — อย่าคิดว่ามันติดตั้งอยู่** คำสั่งข้างบนให้เป็น SQL ไม่ใช่คำสั่ง `psql`
เพราะเครื่องมือ **client** ของ PostgreSQL อาจไม่มีในเครื่องคุณ แม้เซิร์ฟเวอร์ฐานข้อมูลจะรัน
อยู่ที่ใดที่ต่อถึงได้ มีแต่ตัวเซิร์ฟเวอร์ฐานข้อมูลที่การ deploy นี้ต้องการ ใช้วิธีใดก็ได้ที่มี:

- **ถ้ามี `psql`:** รันกับ connection string ของคุณเอง เช่น `psql "$DATABASE_URL" -c "..."`
- **ถ้าไม่มี `psql` — ใช้ dependency ของโปรเจกต์เอง ซึ่งติดตั้งแล้วหลังขั้น 3.2** คิทนี้มีตัว
  ตรวจมาให้แล้ว: `scripts/house-swarm-7/db-check.mjs` รันคำสั่งเทียบเท่าผ่านแพ็กเกจ `pg`
  ที่ `server/node_modules` มีอยู่แล้ว รายงานว่าตารางจาก migration ทั้งหกและแพ็กเกจ seed
  สองตัวมีอยู่หรือไม่ และไม่เพิ่ม dependency ใหม่ รันโดยตั้ง `DATABASE_URL` ใน
  process environment: `node scripts/house-swarm-7/db-check.mjs`
  มันพิมพ์บรรทัด `CHECK <name> PASS|FAIL <detail>` ต่อหนึ่งข้อ และออกไม่เป็นศูนย์ถ้ามีข้อใด
  ล้มเหลว ถ้าฐานข้อมูลต่อได้แต่ยังไม่มีสคีมา มันจะรายงานตารางที่ขาดและบอกให้สตาร์ทเซิร์ฟเวอร์
  หนึ่งครั้ง สคริปต์ตั้งค่า (ข้อ 3.2) ถือกรณีนั้นเป็น `PENDING`

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
| 2 | `cd server && npm ci` then `npm run typecheck` (do **not** run this with `NODE_ENV=production` set — use `npm ci --include=dev` if you must, or the devDependencies `tsc`/`tsx` will be missing, §3.2) | exits 0 and prints no type error. / ออกด้วย 0 และไม่พิมพ์ type error |
| 3 | `cd server && npm test` — read §6.1 first: it gives the `DATABASE_URL` prerequisite and states what the suite does to your database | with `DATABASE_URL` **set against a fresh database** it exits 0 with every test file passing: `Test Files 6 passed (6)` and `Tests 58 passed (58)`. With `DATABASE_URL` **unset** it exits 0 with `Test Files 5 passed \| 1 skipped (6)` and `Tests 53 passed \| 5 skipped (58)`. / ออกด้วย 0 โดยไฟล์เทสต์ทั้งหมดผ่าน อ่าน §6.1 ก่อน เพราะมีเงื่อนไข `DATABASE_URL` และระบุว่าชุดเทสต์แตะฐานข้อมูลของคุณอย่างไร |
| 4 | start with `DATABASE_URL` unset / สตาร์ทโดยไม่ตั้ง `DATABASE_URL` | logs `persistent=false` then `Server listening on port 3003`. / พิมพ์ `persistent=false` แล้ว `Server listening on port 3003` |
| 5 | `curl -s http://127.0.0.1:3003/health` | `{"ok":true}` / เหมือนกัน |
| 6 | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/` | `200` — the sample UI landing page is served. / `200` — หน้าแรกของ UI ตัวอย่างถูกเสิร์ฟ |
| 7 | `curl -s -H 'x-tenant-id: acme' http://127.0.0.1:3003/me` | `503` with `Auth not configured on this server instance` when no Supabase keys are set. This is correct, not a failure: real log in needs your own Supabase project. / `503` พร้อม `Auth not configured on this server instance` เมื่อยังไม่ตั้งคีย์ Supabase นี่ถูกต้อง ไม่ใช่ความล้มเหลว เพราะ log in จริงต้องมีโปรเจกต์ Supabase ของคุณเอง |
| 8 | start with your `DATABASE_URL` set / สตาร์ทโดยตั้ง `DATABASE_URL` ของคุณ | logs `persistent=true subscriptions=PostgresSubscriptionRepository usageCounters=PostgresUsageCounterRepository`. / พิมพ์ตามนั้น |
| 9 | `curl -s http://127.0.0.1:3003/ui/plans.json` | `200` with a JSON body containing `free` and `pro` and their entitlements, read from **your** database. / `200` พร้อม JSON ที่มี `free` และ `pro` และ entitlement ของมัน อ่านจากฐานข้อมูล**ของคุณ** |
| 10 | start with `NODE_ENV=production DEMO_AUTH=true` / สตาร์ทด้วย `NODE_ENV=production DEMO_AUTH=true` | logs a `[demo-auth] REFUSED:` line, and `GET /me` answers `503` with code `DEMO_AUTH_REFUSED_IN_PRODUCTION`. / พิมพ์บรรทัด `[demo-auth] REFUSED:` และ `GET /me` ตอบ `503` พร้อมรหัส `DEMO_AUTH_REFUSED_IN_PRODUCTION` |

### 6.1 `npm test` in detail — the `DATABASE_URL` prerequisite and what the suite does to your database / รายละเอียดของ `npm test` — เงื่อนไข `DATABASE_URL` และสิ่งที่ชุดเทสต์ทำกับฐานข้อมูลของคุณ

**Prerequisite: `DATABASE_URL` changes what you observe.** The first observation
in checklist item 3 — `Test Files 6 passed (6)` and `Tests 58 passed (58)` — holds
**only when `DATABASE_URL` is set**. `server/tests/postgres-persistence.test.ts`
is an integration suite that skips itself when no database is configured. With
`DATABASE_URL` **unset** the same command still exits 0, but the observed result
is `Test Files 5 passed | 1 skipped (6)` and `Tests 53 passed | 5 skipped (58)`,
and the five skipped tests are that file's. Both results are a pass; they are
different observations of the same suite, and the condition is the database.
`server/tests/` holds six test files; with `DATABASE_URL` set all six run.

**เงื่อนไข: `DATABASE_URL` เปลี่ยนสิ่งที่คุณเห็น** ผลแรกในข้อ 3 — `Test Files 6 passed (6)`
และ `Tests 58 passed (58)` — เกิด**เฉพาะเมื่อตั้ง `DATABASE_URL`** ไฟล์
`server/tests/postgres-persistence.test.ts` เป็นชุด integration ที่ข้ามตัวเองเมื่อไม่มี
ฐานข้อมูล ถ้า**ไม่ตั้ง** `DATABASE_URL` คำสั่งเดิมยังออกด้วย 0 แต่ผลที่เห็นคือ
`Test Files 5 passed | 1 skipped (6)` และ `Tests 53 passed | 5 skipped (58)` โดยห้าเทสต์
ที่ข้ามคือของไฟล์นั้น ทั้งสองผลถือว่าผ่าน เป็นการสังเกตชุดเดียวกันต่างเงื่อนไข และเงื่อนไขคือฐานข้อมูล
`server/tests/` มีไฟล์เทสต์หกไฟล์ เมื่อตั้ง `DATABASE_URL` ทั้งหกไฟล์จะรัน

**What `DATABASE_URL` set means for your database — the rows are cleaned up.**
With `DATABASE_URL` set, `npm test` writes subscription and ledger rows into
whatever database is configured, and **it deletes exactly the rows it created
again before it exits**, so repeated runs against one database leave nothing
behind. Measured on the author's local test database: three consecutive
full-suite runs each reported `Test Files 6 passed (6)` and `Tests 58 passed (58)`,
and the row counts after all three runs were `subscriptions` 0 and
`billing_event_ledger` 0. Pointing a test suite at a scratch database rather than
a production one is still the right habit, but this suite is **repeatable**: the
same database can be used run after run. The rows come from two test files, and
both of them clean up after themselves:

- `server/tests/postgres-persistence.test.ts` — creates its own rows under one
  account id and deletes them again in its own teardown, so it leaves nothing
  behind.
- `server/tests/webhook.test.ts` — creates subscriptions through the real
  subscription core for account ids of the form `acct_apply_<timestamp>` and
  `acct_replay_<timestamp>`, and posts signed payment events with the fixed ids
  `evt_apply_1` and `evt_replay_1`. Its teardown deletes exactly the rows that run
  created: the subscriptions for the account ids it generated, and the two ledger
  rows its fixed event ids claimed. No table is truncated, and no row this file
  did not create is touched.

**History, so that an older copy does not mislead you.** An earlier version of
`server/tests/webhook.test.ts` deleted nothing, so a run left real rows in
`subscriptions` and `billing_event_ledger`, and re-running the suite against the
same database used to **fail**. The second run reported
`tests/webhook.test.ts:101 AssertionError: expected 'active' to be 'cancelled'`,
because the file's two billing-event ids are fixed (`evt_apply_1`,
`evt_replay_1`) and the ledger's `event_id` is its primary key — a row left from
an earlier run made the redelivery dedupe, so the subscription never reached
`cancelled`. That was a defect in the suite; it is fixed. **If you find a
row-leak warning in another copy of this manual, or in any document written
before this one, that warning is obsolete.**

**การตั้ง `DATABASE_URL` หมายถึงอะไรกับฐานข้อมูลของคุณ — แถวถูกลบให้เรียบร้อย**
เมื่อตั้ง `DATABASE_URL` แล้ว `npm test` จะเขียนแถวของ subscription และ ledger ลงฐานข้อมูล
ที่ถูกตั้งไว้ และ **มันลบแถวที่ตัวเองสร้างทิ้งก่อนจบ** การรันซ้ำบนฐานข้อมูลเดิมจึงไม่ทิ้งอะไรไว้
วัดบนฐานข้อมูลทดสอบในเครื่องผู้เขียน: สามรอบรันติดกันรายงาน `Test Files 6 passed (6)` และ
`Tests 58 passed (58)` ทุกรอบ และจำนวนแถวหลังทั้งสามรอบคือ `subscriptions` 0 และ
`billing_event_ledger` 0 การชี้ชุดเทสต์ไปที่ฐานข้อมูลทดสอบแทน production ยังเป็นนิสัยที่ถูก
แต่ชุดเทสต์นี้**รันซ้ำได้**: ใช้ฐานข้อมูลเดิมซ้ำได้ทุกรอบ แถวเหล่านั้นมาจากไฟล์เทสต์สองไฟล์ และ
ทั้งสองไฟล์เก็บกวาดของตัวเอง:

- `server/tests/postgres-persistence.test.ts` — สร้างแถวของตัวเองใต้ account id เดียว และ
  ลบใน teardown ของตัวเอง จึงไม่ทิ้งอะไรไว้
- `server/tests/webhook.test.ts` — สร้าง subscription ผ่าน core จริงด้วย account id รูปแบบ
  `acct_apply_<timestamp>` และ `acct_replay_<timestamp>` และส่ง payment event ที่เซ็นแล้วด้วย
  id คงที่ `evt_apply_1` และ `evt_replay_1` teardown ของมันลบเฉพาะแถวที่รอบนั้นสร้าง: แถว
  subscription ของ account id ที่มันสร้าง และแถว ledger สองแถวที่ event id คงที่ของมันจับจอง
  ไม่มีการ truncate ตาราง และไม่แตะแถวที่ไฟล์นี้ไม่ได้สร้าง

**ประวัติ เพื่อไม่ให้สำเนาเก่าทำให้คุณเข้าใจผิด** `server/tests/webhook.test.ts` เวอร์ชันก่อน
**ไม่**ลบอะไรเลย การรันหนึ่งครั้งจึงทิ้งแถวจริงไว้ใน `subscriptions` และ
`billing_event_ledger` และการรันซ้ำบนฐานข้อมูลเดิม**เคยล้มเหลว** รอบที่สองรายงาน
`tests/webhook.test.ts:101 AssertionError: expected 'active' to be 'cancelled'` เพราะ id ของ
billing event สองตัวของไฟล์นี้คงที่ (`evt_apply_1`, `evt_replay_1`) และ `event_id` ของ ledger
เป็น primary key — แถวที่ค้างจากรอบก่อนทำให้การส่งซ้ำถูก dedupe subscription จึงไม่ถึงสถานะ
`cancelled` นั่นเป็น defect ของชุดเทสต์ และแก้แล้ว **ถ้าคุณพบคำเตือนเรื่องแถวค้างในคู่มือ
สำเนาอื่น หรือในเอกสารใดที่เขียนก่อนหน้านี้ คำเตือนนั้นล้าสมัยแล้ว**

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
- `npm test` → exit code 0, summary lines `Test Files  6 passed (6)` and
  `Tests  58 passed (58)` — observed with `DATABASE_URL` set, on the local test
  database (with `DATABASE_URL` unset the same command gives
  `5 passed | 1 skipped (6)` and `53 passed | 5 skipped (58)`; see §6.1)
- `npm test` with `DATABASE_URL` set left **no** rows behind: three consecutive
  runs against one database each reported `6 passed (6)` / `58 passed (58)`, and
  the row counts afterwards were `subscriptions` 0 and `billing_event_ledger` 0 —
  the suite deletes the rows it creates; see §6.1
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
unit, so nothing is mid-migration while you act. On Windows Git-Bash, where this
stop command was verified, killing the `npm run start` wrapper is **not** enough —
the `tsx` child keeps listening on the port, and that was observed four times in
this work stream (pids 23736, 29192, 24496 and 30144 all outlived their wrapper).
Find the pid that owns the port and kill **that** one, then prove the port is free:

    netstat -ano | grep :3003
    cmd.exe /c "taskkill /F /PID <pid>"
    netstat -ano | grep LISTENING | grep :3003     # prints nothing when the port is free

The first `netstat` lists the socket with the pid that is LISTENING on it; substitute
that pid for `<pid>`. The last command is the check: when it prints nothing, nothing
is listening on the port any more. Substitute your own port if you did not use
`3003`. On a systemd host the equivalent is `systemctl stop <your-unit>`.

/ **หยุดโปรเซสใหม่** หยุดโปรเซสที่คุณเริ่ม หรือปิด service unit เพื่อไม่ให้มีอะไรกำลัง
migration ระหว่างที่คุณดำเนินการ บน Windows Git-Bash ซึ่งเป็นเชลล์ที่ตรวจคำสั่งหยุดนี้
การฆ่า wrapper `npm run start` **ไม่พอ** — ลูก `tsx` ยังฟังพอร์ตอยู่ และสังเกตเห็นสี่ครั้ง
ในสายงานนี้ (pid 23736, 29192, 24496 และ 30144 อยู่รอดเกิน wrapper ทั้งหมด) ให้หา pid
ที่ถือพอร์ตแล้วฆ่า**ตัวนั้น** แล้วพิสูจน์ว่าพอร์ตว่าง:

    netstat -ano | grep :3003
    cmd.exe /c "taskkill /F /PID <pid>"
    netstat -ano | grep LISTENING | grep :3003     # ไม่พิมพ์อะไรเมื่อพอร์ตว่าง

`netstat` ตัวแรกแสดง socket พร้อม pid ที่ LISTENING อยู่ ให้แทน pid นั้นใน `<pid>`
คำสั่งสุดท้ายคือการตรวจ: เมื่อไม่พิมพ์อะไร แปลว่าไม่มีอะไรฟังพอร์ตนั้นแล้ว ถ้าคุณไม่ได้ใช้
พอร์ต `3003` ให้เปลี่ยนเป็นพอร์ตของคุณ บนโฮสต์ที่ใช้ systemd คำสั่งเทียบเท่าคือ
`systemctl stop <unit ของคุณ>`

**2. Roll back the code, not the data.** Check out the previous revision of the
code and restart:

    git -C . log --oneline -5
    git -C . checkout <PREVIOUS_REVISION>
    cd server && npm ci --include=dev && npm run start

(`--include=dev` for the same reason as section 3.2: with `NODE_ENV=production`
in the environment, a plain `npm ci` omits the devDependencies that `npm run
start` needs.)

**ย้อนโค้ด ไม่ใช่ย้อนข้อมูล** checkout รีโปเวอร์ชันก่อนหน้าแล้วสตาร์ทใหม่

**If your delivery is a folder and not a repository, `git checkout` is
unavailable — restore the previous folder copy instead.** As stated in section
3.1, a delivered folder normally carries no `.git` directory, so **`git clone`
and `git checkout` are unavailable** and the three commands above fail with a git
error — verified: in this delivery `git log` and `git checkout` both print
`fatal: not a git repository (or any of the parent directories): .git` and **exit
128**. The rollback that needs no git history is a folder swap, and it is the
recommended path whenever you are unsure the folder is a repository:

**The copy you swap back to must be taken at delivery time, before any change is
made.** A folder copy named `multi-tenant-ai.previous` **does not ship with this
delivery** — the delivered folder contains no such folder, so the instruction
below cannot be executed as written unless you made the copy yourself. Take it
the moment you receive the delivery and before you run any command that changes
anything:

    cp -R multi-tenant-ai multi-tenant-ai.previous    # before your first change

**If you did not take that copy**, the folder swap is still available to you and
is not lost: you can reconstruct the previous state without it. Unpack the
archive you were given (or copy the delivered folder) **again** to a second
location, which restores exactly the state the delivery arrived in, and use that
fresh copy as `multi-tenant-ai.previous`:

    cp -R <THE_DELIVERED_FOLDER> multi-tenant-ai.previous    # the untouched state

That is the same content the copy would have held, because it is the same
delivery. It cannot recover changes you made *before* the unmodified copy was
made, which is exactly why the copy belongs at delivery time. If you no longer
have the archive or the original folder at all, say so plainly: there is no
source of the previous folder in this delivery, git history is unavailable, and
the previous state cannot be reconstructed — the fallback then is the current
tree plus the database, whose schema is untouched by a code rollback (step 3).

1. **Stop the process** (step 1 above) so nothing is mid-migration.
2. **Keep a copy of the current folder** before you change it, so this rollback
   is itself reversible:
   `mv multi-tenant-ai multi-tenant-ai.broken`
3. **Put the previous folder copy back in place** — the copy you took before the
   change you are undoing: `cp -R multi-tenant-ai.previous multi-tenant-ai`
4. **Reinstall inside the restored copy**, because `node_modules/` must match
   that copy's lockfile: `cd multi-tenant-ai/server && npm ci`
5. **Start it again**: `npm run start`

The database is untouched by all of this, and step 3 of the rollback below still
applies: do not reverse the migrations by dropping tables.

**ถ้าโฟลเดอร์ส่งมอบไม่ใช่รีโป `git checkout` ใช้ไม่ได้ — ให้กู้จากสำเนาโฟลเดอร์
ก่อนหน้าแทน** ตามที่ระบุในข้อ 3.1 โฟลเดอร์ส่งมอบปกติไม่มีไดเรกทอรี `.git` ดังนั้น
**`git clone` และ `git checkout` ใช้ไม่ได้** และสามคำสั่งข้างบนจะล้มเหลวด้วยข้อผิดพลาดของ
git — ตรวจแล้ว: ในงานส่งมอบนี้ `git log` และ `git checkout` พิมพ์
`fatal: not a git repository (or any of the parent directories): .git` และ **ออกด้วยรหัส
128** การย้อนกลับที่ไม่ต้องใช้ประวัติ git คือการสลับโฟลเดอร์ และเป็นวิธีที่แนะนำเมื่อคุณไม่แน่ใจ
ว่าโฟลเดอร์นั้นเป็นรีโป

**สำเนาที่จะสลับกลับต้องทำตอนรับงาน ก่อนแก้สิ่งใด** สำเนาโฟลเดอร์ชื่อ
`multi-tenant-ai.previous` **ไม่ได้แถมมากับงานส่งมอบนี้** โฟลเดอร์ส่งมอบไม่มีโฟลเดอร์นั้น
คำสั่งด้านล่างจึงรันตามตัวอักษรไม่ได้ เว้นแต่คุณทำสำเนาเอง ให้ทำทันทีที่รับงานและก่อนรัน
คำสั่งใดที่เปลี่ยนแปลงอะไร:

    cp -R multi-tenant-ai multi-tenant-ai.previous    # ก่อนการแก้ครั้งแรกของคุณ

**ถ้าคุณไม่ได้ทำสำเนานั้นไว้** การสลับโฟลเดอร์ยังทำได้และไม่ได้หายไป: คุณสร้างสภาพก่อนหน้า
กลับคืนได้โดยไม่ต้องมีสำเนา แตกไฟล์ archive ที่คุณได้รับ (หรือคัดลอกโฟลเดอร์ส่งมอบ) **อีกครั้ง**
ไปยังตำแหน่งที่สอง ซึ่งคืนสภาพที่งานส่งมอบมาถึงเป๊ะ ๆ แล้วใช้สำเนาใหม่นั้นเป็น
`multi-tenant-ai.previous`:

    cp -R <โฟลเดอร์ส่งมอบของคุณ> multi-tenant-ai.previous    # สภาพที่ยังไม่ถูกแตะ

นั่นคือเนื้อหาเดียวกับที่สำเนาจะมี เพราะเป็นงานส่งมอบเดียวกัน มันกู้การแก้ไขที่คุณทำ*ก่อน*ที่
สำเนาที่ไม่ถูกแตะจะถูกสร้างไม่ได้ ซึ่งเป็นเหตุผลว่าทำไมสำเนาจึงควรทำตอนรับงาน ถ้าคุณไม่มี
archive หรือโฟลเดอร์ต้นฉบับแล้ว ให้พูดตรง ๆ ว่า: ไม่มีแหล่งของโฟลเดอร์ก่อนหน้าในงานส่งมอบนี้
ประวัติ git ใช้ไม่ได้ และสภาพก่อนหน้าสร้างคืนไม่ได้ ทางถอยในกรณีนั้นคือต้นไม้ปัจจุบันบวก
ฐานข้อมูล ซึ่งสคีมาไม่ถูกแตะจากการย้อนโค้ด (ข้อ 3)

1. **หยุดโปรเซส** (ข้อ 1 ข้างบน) เพื่อไม่ให้มีอะไรกำลัง migration
2. **เก็บสำเนาโฟลเดอร์ปัจจุบัน** ก่อนแก้ เพื่อให้การย้อนกลับนี้ย้อนกลับได้อีกชั้น
3. **วางสำเนาโฟลเดอร์ก่อนหน้ากลับเข้าที่** — สำเนาที่คุณทำไว้ก่อนการเปลี่ยนแปลงที่กำลังย้อน
4. **ติดตั้งใหม่ในสำเนาที่กู้มา** เพราะ `node_modules/` ต้องตรงกับ lockfile ของสำเนานั้น
5. **สตาร์ทใหม่**

ฐานข้อมูลไม่ถูกแตะจากการย้อนกลับนี้ และข้อ 3 ด้านล่างยังใช้อยู่: อย่าย้อน migration ด้วยการ
drop ตาราง

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
  / **ที่เก็บโค้ดนี้ไม่มี credential จริง** มีแต่คำนำหน้าแบบตัวอย่างในเอกสารและไฟล์เทสต์
  ซึ่งไม่ใช่ค่าที่ใช้ได้
- **Keep `NODE_ENV=production` set on a real deployment.** It is not only for the
  demo refusal; it is the signal the process uses to know it is not a demo.
  / **ตั้ง `NODE_ENV=production` บน deploy จริง** ไม่ได้มีไว้แค่การปฏิเสธโหมดสาธิต
  มันเป็นสัญญาณที่โปรเซสบอกตัวเองว่าที่นี่ไม่ใช่โหมดสาธิต

---

## 9. Limits — ข้อจำกัด

What is still **not implemented**, and what is implemented but **not hardened**.
Do not read anything above as a claim that these exist, or that they are safe for
an internet-facing multi-instance deployment.

สิ่งที่**ยังไม่ได้ทำ** และสิ่งที่ทำแล้วแต่**ยังไม่แข็งแรงพอสำหรับ production**
อย่าตีความข้อใดข้างบนว่าเป็นคำรับรองว่าสิ่งเหล่านี้มีอยู่ หรือปลอดภัยสำหรับการ deploy
หลายอินสแตนซ์ที่เปิดสู่อินเทอร์เน็ต

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
   กับโปรเจกต์ Supabase จริง เพราะที่เก็บโค้ดนี้ไม่มีและผู้เขียนไม่ได้ใช้ คุณจะเป็น
   คนแรกที่ชี้มันไปที่โปรเจกต์จริง และส่วนนั้นยังไม่ถูกทดสอบ
5. **Rate limiting on `POST /payment/webhook` is in-process only.** The route
   **is** rate limited. `server/src/app.ts` mounts `webhookRateLimitMiddleware`
   on `POST /payment/webhook` ahead of `express.raw()` and ahead of the handler,
   so a request over the limit is refused **before** signature verification and
   **before** any HMAC work is done — a flood costs no HMAC. The limiter is not
   new code written for this delivery: it is the Module Hub `rate-limit` module,
   vendored at `modules/rate-limit/` (provenance in
   `modules/rate-limit/PROVENANCE-RATELIMIT.md`), wired on the host side by
   `server/src/lib/rate-limit.ts`. A refusal is **HTTP 429**, body code
   **`RATE_LIMITED`**, carrying a **`Retry-After`** header. The limits are the two
   environment variables listed in §3.3: `WEBHOOK_RATE_LIMIT_MAX`, default `60`
   requests, and `WEBHOOK_RATE_LIMIT_WINDOW_MS`, default `60000` milliseconds —
   that is 60 requests per 60 seconds. `docs/house-swarm-7/FU-RATELIMIT.md` is the
   full account of it. What it is **not**: the counter lives in one process's
   memory, so the limit is **per-instance and resets when the process restarts**;
   several instances behind a load balancer share no counter, so the effective
   ceiling multiplies by the number of instances; and one key covers the endpoint
   rather than the caller, so a burst of legitimate Stripe deliveries is throttled
   together with a flood of hostile ones. It is a process-protection limit, **not**
   a substitute for a rate limit at your edge or reverse proxy in a multi-instance
   deployment. Replay defence is a separate question and unchanged: the signature
   verifier refuses a signature whose timestamp falls outside its tolerance window
   (code `WEBHOOK_EXPIRED_TIMESTAMP`), and the subscription ledger's idempotency is
   what makes a redelivered event apply at most once. An earlier version of this
   section asserted the opposite about rate limiting; that statement is obsolete.
   / **rate limiting บน `POST /payment/webhook` เป็นแบบในโปรเซสเดียว**
   เส้นทางนี้**มี** rate limit แล้ว `server/src/app.ts` ติดตั้ง
   `webhookRateLimitMiddleware` บน `POST /payment/webhook` **ก่อน** `express.raw()`
   และก่อน handler คำขอที่เกินขีดจึงถูกปฏิเสธ**ก่อน**การตรวจลายเซ็นและ**ก่อน**งาน HMAC
   การยิงถล่มจึงไม่กินงาน HMAC ตัวจำกัดนี้ไม่ใช่โค้ดใหม่ของงานนี้: มันคือโมดูล
   `rate-limit` จาก Module Hub ที่ vendor ไว้ที่ `modules/rate-limit/` (ที่มา
   `modules/rate-limit/PROVENANCE-RATELIMIT.md`) ต่อสายฝั่งโฮสต์ใน
   `server/src/lib/rate-limit.ts` การปฏิเสธคือ **HTTP 429** รหัสใน body
   **`RATE_LIMITED`** พร้อม header **`Retry-After`** ขีดจำกัดคือตัวแปรสภาพแวดล้อมสองตัว
   ในข้อ 3.3: `WEBHOOK_RATE_LIMIT_MAX` ค่าเริ่มต้น `60` คำขอ และ
   `WEBHOOK_RATE_LIMIT_WINDOW_MS` ค่าเริ่มต้น `60000` มิลลิวินาที คือ 60 คำขอต่อ 60 วินาที
   รายละเอียดทั้งหมดอยู่ที่ `docs/house-swarm-7/FU-RATELIMIT.md` สิ่งที่มัน**ไม่**ใช่:
   ตัวนับอยู่ในหน่วยความจำของโปรเซสเดียว ขีดจำกัดจึง**แยกตามอินสแตนซ์และรีเซ็ตเมื่อโปรเซส
   รีสตาร์ท** หลายอินสแตนซ์หลังโหลดบาลานเซอร์ไม่แชร์ตัวนับ เพดานจริงจึงคูณตามจำนวน
   อินสแตนซ์ และคีย์หนึ่งตัวคลุมทั้งเส้นทางไม่ใช่ต่อผู้เรียก การส่งของ Stripe ที่ถูกต้อง
   จึงถูกจำกัดไปพร้อมการยิงถล่ม มันเป็นขีดจำกัดเพื่อป้องกันโปรเซส **ไม่**ใช่สิ่งทดแทน
   rate limit ที่ edge หรือ reverse proxy ของคุณในการ deploy หลายอินสแตนซ์ การป้องกัน
   การเล่นซ้ำเป็นเรื่องแยกและไม่เปลี่ยน: ตัวตรวจลายเซ็นปฏิเสธลายเซ็นที่เวลาอยู่นอกหน้าต่าง
   tolerance (รหัส `WEBHOOK_EXPIRED_TIMESTAMP`) และ idempotency ของ ledger คือสิ่งที่ทำให้
   เหตุการณ์ที่ส่งซ้ำมีผลครั้งเดียว ฉบับก่อนของข้อนี้เขียนไว้ตรงกันข้าม คำกล่าวนั้นล้าสมัยแล้ว
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
