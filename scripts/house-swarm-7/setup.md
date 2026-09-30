# WU-5 Setup Script — `scripts/house-swarm-7/setup.sh`

# สคริปต์ตั้งค่า WU-5 — `scripts/house-swarm-7/setup.sh`

A short description of the script that sits next to the deployment manual. The
manual is `docs/product/WU5-DEPLOY.md`; this file only describes the script.

คำอธิบายสั้น ๆ ของสคริปต์ที่วางอยู่ข้างคู่มือ deploy คู่มือคือ
`docs/product/WU5-DEPLOY.md` ส่วนไฟล์นี้อธิบายเฉพาะสคริปต์

---

## 1. What the script does / สคริปต์ทำอะไร

Five things, in this order, and then it stops:

ห้าอย่าง ตามลำดับนี้ แล้วหยุด

1. **Checks the runtime.** Requires **Node.js 22 or newer** and npm. 22 is not a
   preference: the installed `@supabase/supabase-js` declares
   `engines.node = ">=22.0.0"`. / **ตรวจ runtime** ต้องมี **Node.js 22 ขึ้นไป**
   และ npm เลข 22 ไม่ใช่ความชอบส่วนตัว เพราะ `@supabase/supabase-js` ที่ติดตั้งอยู่
   ประกาศ `engines.node = ">=22.0.0"`
2. **Checks the environment.** It verifies that `DATABASE_URL` is set (unless you
   asked for in-memory mode), that `PORT` is numeric if you set it, and that
   `DEMO_AUTH` is **not** `true`. / **ตรวจตัวแปรสภาพแวดล้อม** ตรวจว่า `DATABASE_URL`
   ถูกตั้งไว้ (เว้นแต่คุณขอโหมด in-memory) ว่า `PORT` เป็นตัวเลขถ้าคุณตั้ง และว่า
   `DEMO_AUTH` **ไม่ใช่** `true`
3. **Installs dependencies.** `npm ci --include=dev` from the lockfile, which is
   the reproducible choice. **`--include=dev` is there for a reason:** npm omits
   devDependencies when `NODE_ENV=production`, and `tsx` (`npm run start`) and
   `typescript` (`npm run typecheck`) are devDependencies. Including them is what
   lets this script work in the production environment step 2 describes. /
   **ติดตั้ง dependency** ด้วย `npm ci --include=dev` จาก lockfile ซึ่งเป็นตัวเลือกที่
   ทำซ้ำได้ **`--include=dev` มีเหตุผล:** npm จะไม่ติดตั้ง devDependencies เมื่อ
   `NODE_ENV=production` และ `tsx` (`npm run start`) กับ `typescript`
   (`npm run typecheck`) เป็น devDependencies การรวมมันเข้ามาคือสิ่งที่ทำให้สคริปต์นี้
   ทำงานได้ในสภาพแวดล้อม production ที่ข้อ 2 อธิบาย
4. **Runs the project's own typecheck.** `npm run typecheck`, the gate that
   already exists in the project. / **รัน typecheck ของโปรเจกต์เอง**
   `npm run typecheck` ซึ่งเป็น gate ที่โปรเจกต์มีอยู่แล้ว
5. **Verifies the database.** Runs `scripts/house-swarm-7/db-check.mjs`, which
   connects using `DATABASE_URL` and reports whether the six migration tables and
   the two seed plans exist. Every check is named after the step that ran it —
   `connection`, `migration-tables`, `seed-plans` — so a failing check tells you
   what actually failed. Only a connection that could not be opened at all is
   reported as `CHECK connection FAIL`; the seed-plan query is **not** run before
   the tables it reads exist. / **ตรวจฐานข้อมูล** รัน
   `scripts/house-swarm-7/db-check.mjs` ซึ่งต่อโดยใช้ `DATABASE_URL` แล้วรายงานว่า
   ตารางจาก migration ทั้งหกและแพ็กเกจ seed สองตัวมีอยู่หรือไม่ ทุกข้อตรวจตั้งชื่อตาม
   ขั้นที่รันจริง — `connection`, `migration-tables`, `seed-plans` — ข้อที่ล้มเหลวจึงบอกได้ว่า
   อะไรล้มเหลวจริง มีแต่การต่อที่เปิดไม่ขึ้นเลยเท่านั้นที่ถูกรายงานเป็น `CHECK connection FAIL`
   ส่วนคำสั่งอ่าน seed plans จะ**ไม่**ถูกรันก่อนที่ตารางที่มันอ่านจะถูกสร้าง

### The two outcomes of the database step / ผลลัพธ์สองแบบของขั้นตรวจฐานข้อมูล

- **Reachable database, schema not created yet → PENDING.** The output is
  `CHECK connection PASS ...`, then `CHECK migration-tables FAIL missing: ...`,
  then `CHECK seed-plans FAIL not run: the schema is not created yet, so there is
  no plans table to read; start the server once so the migrations run`. There is
  **no** `CHECK connection FAIL` line: the connection succeeded, and the two
  failing checks name the schema rather than the connection. The script then says
  `PENDING` and tells you to start the server once, because the server applies
  its migrations at boot (`server/src/index.ts` runs them before `app.listen`).
  This is not an error. / **ต่อฐานข้อมูลได้ แต่ยังไม่มีสคีมา → PENDING** ผลที่เห็นคือ
  `CHECK connection PASS ...` แล้วตามด้วย `CHECK migration-tables FAIL missing: ...`
  และ `CHECK seed-plans FAIL not run: the schema is not created yet, ...` — **ไม่มี**
  บรรทัด `CHECK connection FAIL` เพราะการต่อสำเร็จ และข้อที่ล้มเหลวสองข้อชื่อสคีมา ไม่ใช่การต่อ
  จากนั้นสคริปต์จะบอก `PENDING` และให้คุณสตาร์ทเซิร์ฟเวอร์หนึ่งครั้ง เพราะเซิร์ฟเวอร์รัน
  migration ตอนบูต (`server/src/index.ts` รันก่อน `app.listen`) ไม่ใช่ข้อผิดพลาด
- **Cannot reach the database → failure, exit non-zero.** A wrong host, port,
  database name or credential is a real failure and the script stops. `db-check`
  prints `CHECK connection FAIL <reason>` — the only line that may ever carry
  that verdict — and no schema check runs, because nothing could be observed. /
  **ต่อฐานข้อมูลไม่ได้ → ล้มเหลว exit ไม่เป็นศูนย์** host พอร์ต ชื่อฐานข้อมูล หรือ
  credential ที่ผิดคือความล้มเหลวจริง และสคริปต์จะหยุด `db-check` จะพิมพ์
  `CHECK connection FAIL <เหตุผล>` ซึ่งเป็นบรรทัดเดียวที่อาจมีผลตัดสินนี้ และจะไม่มีข้อตรวจ
  สคีมารันเลย เพราะไม่สามารถสังเกตอะไรได้

---

## 2. What the script does NOT do / สคริปต์ไม่ทำอะไร

This list matters as much as the one above.

รายการนี้สำคัญพอ ๆ กับรายการข้างบน

- **It does not start the server and it does not deploy anything.** Setup and
  run are separate steps, and starting the server is yours to do. / **ไม่สตาร์ท
  เซิร์ฟเวอร์ และไม่ deploy อะไรเลย** การตั้งค่ากับการรันเป็นคนละขั้น และการสตาร์ท
  เซิร์ฟเวอร์เป็นเรื่องของคุณ
- **It does not apply migrations.** The server does that at boot. / **ไม่ apply
  migration** เซิร์ฟเวอร์ทำตอนบูต
- **It writes no file, and therefore cannot write a credential to one.** There is
  no output file, no generated config and no log of secret values. / **ไม่เขียน
  ไฟล์ใด จึงเขียน credential ลงไฟล์ไม่ได้** ไม่มีไฟล์ผลลัพธ์ ไม่มีคอนฟิกที่สร้างขึ้น
  และไม่มีบันทึกค่าลับ
- **It never sets `DEMO_AUTH`.** It refuses to run when `DEMO_AUTH=true` is
  already set in the environment, because that gate is not authentication and
  must never be enabled on a deployment. / **ไม่ตั้ง `DEMO_AUTH` เด็ดขาด** มันปฏิเสธ
  ไม่รันเมื่อ `DEMO_AUTH=true` ถูกตั้งไว้แล้วในสภาพแวดล้อม เพราะ gate นั้นไม่ใช่การ
  ยืนยันตัวตนและต้องไม่ถูกเปิดบน deploy
- **It guesses nothing.** No default database address, no default credentials, no
  fallback host. A missing required variable is a refusal, not a default. /
  **ไม่เดาอะไรเลย** ไม่มีที่อยู่ฐานข้อมูลเริ่มต้น ไม่มี credential เริ่มต้น ไม่มี
  โฮสต์สำรอง ตัวแปรที่จำเป็นหายไปคือการปฏิเสธ ไม่ใช่ค่าเริ่มต้น
- **It does not read a `.env` file.** This project has no dotenv and nothing reads
  a `.env` file, so such a file would have no effect. See
  `docs/product/WU5-DEPLOY.md` section 3.3. / **ไม่อ่านไฟล์ `.env`** โปรเจกต์นี้
  ไม่มี dotenv และไม่มีอะไรอ่านไฟล์ `.env` ไฟล์นั้นจึงไม่มีผล ดู
  `docs/product/WU5-DEPLOY.md` ข้อ 3.3
- **It creates no container and no cloud configuration.** It is a shell script
  that installs dependencies and checks two things. / **ไม่สร้าง container และไม่สร้าง
  คอนฟิกคลาวด์** มันเป็นสคริปต์เชลล์ที่ติดตั้ง dependency และตรวจสองอย่าง

---

## 3. Exact usage / วิธีใช้ที่แน่นอน

Non-interactive: it never prompts and never reads stdin. Set the environment in
the shell that launches it, then run it.

ไม่มีการถามตอบ: ไม่มี prompt และไม่อ่าน stdin ตั้งตัวแปรสภาพแวดล้อมในเชลล์ที่เรียกมัน
แล้วรัน

### 3.1 Against your own database / กับฐานข้อมูลของคุณเอง

    cd <your checkout>
    export DATABASE_URL='postgres://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME'
    sh scripts/house-swarm-7/setup.sh

`DATABASE_URL` is required here. If it is missing the script refuses and exits
non-zero, rather than pointing at an address of its own. Replace every part of it
with your own values — there is no address in this repository to copy.

`DATABASE_URL` จำเป็นในโหมดนี้ ถ้าไม่มี สคริปต์จะปฏิเสธและ exit ไม่เป็นศูนย์ แทนที่จะ
ชี้ไปที่อยู่ของตัวเอง ให้แทนทุกส่วนด้วยค่าของคุณเอง — ไม่มีที่อยู่ในที่เก็บโค้ดนี้ให้คัดลอก

**`NODE_ENV` is deliberately not exported in this example, and this step does not
need it.** npm honours `NODE_ENV=production` and **omits devDependencies** from an
install made in that environment, and `tsx`, `typescript` and `vitest` are
devDependencies — so an install made under `NODE_ENV=production` produces a tree
that cannot run `npm run start` (it needs `tsx`) or `npm run typecheck` (it needs
`typescript`). Set `NODE_ENV=production` when you **start** the server — that is
what makes the `DEMO_AUTH` refusal operate — not before the install. The script
itself is safe either way: it installs with **`npm ci --include=dev`**, which
includes devDependencies in every environment.

**ตัวอย่างนี้ไม่ได้ export `NODE_ENV` โดยตั้งใจ และขั้นนี้ไม่ต้องใช้มัน** npm เคารพ
`NODE_ENV=production` และ**จะไม่ติดตั้ง devDependencies** เมื่อติดตั้งในสภาพแวดล้อมนั้น
ส่วน `tsx`, `typescript` และ `vitest` เป็น devDependencies การติดตั้งภายใต้
`NODE_ENV=production` จึงได้ต้นไม้ที่รัน `npm run start` ไม่ได้ (ต้องใช้ `tsx`) และรัน
`npm run typecheck` ไม่ได้ (ต้องใช้ `typescript`) ให้ตั้ง `NODE_ENV=production` ตอน**สตาร์ท**
เซิร์ฟเวอร์ ซึ่งเป็นสิ่งที่ทำให้การปฏิเสธ `DEMO_AUTH` ทำงาน ไม่ใช่ก่อนติดตั้ง และตัวสคริปต์
เองปลอดภัยทั้งสองแบบ เพราะติดตั้งด้วย **`npm ci --include=dev`** ซึ่งรวม devDependencies
ในทุกสภาพแวดล้อม

### 3.2 Without a database / ไม่มีฐานข้อมูล

    cd <your checkout>
    sh scripts/house-swarm-7/setup.sh --in-memory

Skips the database step entirely. The server then keeps its in-memory
repositories and **nothing is persisted when the process stops**. The script
warns about this in plain words, because in-memory mode is not a real deployment.

ข้ามขั้นตรวจฐานข้อมูลทั้งหมด เซิร์ฟเวอร์จะใช้ repository ในหน่วยความจำ และ**ไม่มีอะไร
ถูกเก็บไว้เมื่อโปรเซสหยุด** สคริปต์จะเตือนเรื่องนี้ตรง ๆ เพราะโหมด in-memory ไม่ใช่
deploy จริง

### 3.3 Help / ขอความช่วยเหลือ

    sh scripts/house-swarm-7/setup.sh --help

Prints the usage text and exits 0. / พิมพ์ข้อความวิธีใช้และ exit 0

### 3.4 Running it the second time / รันครั้งที่สอง

Run exactly the same command again. The script is **idempotent**: `npm ci
--include=dev` reinstalls the lockfile's versions cleanly, the typecheck reruns,
and the database check reports the same result or moves from `PENDING` to passed
once the server has created the schema. Nothing accumulates and nothing is
written.

รันคำสั่งเดิมซ้ำได้เลย สคริปต์**รันซ้ำได้**: `npm ci --include=dev` ติดตั้งเวอร์ชันตาม
lockfile ใหม่สะอาด typecheck รันใหม่ และการตรวจฐานข้อมูลให้ผลเดิม หรือเปลี่ยนจาก `PENDING`
เป็นผ่านเมื่อเซิร์ฟเวอร์สร้างสคีมาแล้ว ไม่มีอะไรสะสมและไม่มีอะไรถูกเขียน

### 3.5 Platforms / แพลตฟอร์ม

- **Linux:** `sh scripts/house-swarm-7/setup.sh` runs under `/bin/sh` (POSIX sh).
  / **Linux** รันด้วย `sh` ตามมาตรฐาน POSIX sh
- **Windows:** run the same command in **Git-Bash**, or from cmd with
  `sh scripts/house-swarm-7/setup.sh`. Export variables in Git-Bash with
  `export`, or set them in cmd with `set` before calling the script. / **Windows**
  รันคำสั่งเดิมใน **Git-Bash** หรือจาก cmd ด้วย `sh scripts/house-swarm-7/setup.sh`
  ตั้งตัวแปรใน Git-Bash ด้วย `export` หรือตั้งใน cmd ด้วย `set` ก่อนเรียกสคริปต์

---

## 4. Exit codes and messages / รหัสออกและข้อความ

| Exit code / รหัสออก | Meaning / ความหมาย |
|---|---|
| `0` | Every step that applied passed. Also the exit for `--help`. / ทุกขั้นที่ทำผ่าน รวมทั้งกรณี `--help` |
| non-zero / ไม่เป็นศูนย์ | A refusal or a failure: a missing `DATABASE_URL` in database mode, `DEMO_AUTH=true`, Node.js older than 22, a failed `npm ci`, a failed typecheck, or an unreachable database. / การปฏิเสธหรือความล้มเหลว: ไม่มี `DATABASE_URL` ในโหมดฐานข้อมูล, `DEMO_AUTH=true`, Node.js เก่ากว่า 22, `npm ci` ล้มเหลว, typecheck ล้มเหลว หรือต่อฐานข้อมูลไม่ได้ |

Every message is prefixed so it can be grepped in a build log: `[setup]` for
normal progress, `[setup] WARN:` for something you should read, and
`[setup] FAIL:` for a refusal or failure. The database probe prints one
`CHECK <name> PASS|FAIL <detail>` line per check, like the project's other
harnesses.

ทุกข้อความมีคำนำหน้าให้ grep ในบันทึกบิลด์ได้: `[setup]` สำหรับความคืบหน้าปกติ,
`[setup] WARN:` สำหรับเรื่องที่ควรอ่าน และ `[setup] FAIL:` สำหรับการปฏิเสธหรือ
ความล้มเหลว ตัวตรวจฐานข้อมูลพิมพ์บรรทัด `CHECK <name> PASS|FAIL <detail>` หนึ่งบรรทัด
ต่อหนึ่งข้อเหมือน harness ตัวอื่นของโปรเจกต์

No message ever contains a credential: the connection string is reported as set
or not set, and its value is never printed.

ไม่มีข้อความใดมี credential: connection string จะถูกรายงานว่าตั้งหรือไม่ตั้ง และค่าของ
มันไม่ถูกพิมพ์ออกมาเลย

---

## 5. What to do next / ทำอะไรต่อ

The script stops after setup. To run the server, and to verify it, follow
`docs/product/WU5-DEPLOY.md` — section 3.4 to start it, section 6 for the
verification checklist, section 7 for rollback and section 8 for the security
rules you must not skip.

สคริปต์หยุดหลังตั้งค่าเสร็จ การรันเซิร์ฟเวอร์และการตรวจสอบให้ทำตาม
`docs/product/WU5-DEPLOY.md` — ข้อ 3.4 สำหรับการสตาร์ท ข้อ 6 สำหรับรายการ
ตรวจสอบ ข้อ 7 สำหรับการย้อนกลับ และข้อ 8 สำหรับกฎความปลอดภัยที่ห้ามข้าม

This script has **not** been validated by a different agent on a fresh folder,
and it is not an approval of anything. That separate validation is someone else's
step.

สคริปต์นี้**ยังไม่**ถูกตรวจสอบโดย agent อีกตัวบนโฟลเดอร์ใหม่ และไม่ใช่การอนุมัติ
สิ่งใด การตรวจแยกนั้นเป็นขั้นของคนอื่น
