# Rate limiting on `POST /payment/webhook` — H7-FU-RATELIMIT

# การจำกัดอัตราการเรียก `POST /payment/webhook` — H7-FU-RATELIMIT

Correlation id / รหัสงาน: `house-swarm-7-followup-ratelimit-20260928`
Base revision / รีวิชันฐาน: `601033249d2b1ab005d1ca83dfbe33f66af6e356`

This document describes the limiter that now guards `POST /payment/webhook`: what it
is, where it came from, how it is wired, what it costs, how to configure it, how to
run its tests, and what it does **not** do. A reader should be able to act on it
without opening the source.

เอกสารนี้อธิบายตัวจำกัดอัตราที่ตอนนี้ป้องกัน `POST /payment/webhook` ว่า มันคืออะไร มา
จากไหน ต่อสายอย่างไร มีราคาที่ต้องจ่ายอะไร ตั้งค่าอย่างไร รันเทสอย่างไร และมัน**ไม่**ทำอะไร
ผู้อ่านควรใช้งานได้โดยไม่ต้องเปิดซอร์สโค้ด

It states no price, no licence, no currency and no purchase link. Pricing and
licensing are the Owner's decision and are out of scope here.

เอกสารนี้ไม่ระบุราคา ไม่ระบุสัญญาอนุญาต ไม่ระบุสกุลเงิน และไม่มีลิงก์ซื้อ เรื่องราคาและ
สัญญาอนุญาตเป็นดุลพินิจของ Owner และอยู่นอกขอบเขตของเอกสารนี้

---

## 1. What was added, and why / สิ่งที่เพิ่มเข้ามา และเพราะเหตุใด

`POST /payment/webhook` had **no rate limiting at all**. A caller could open the
socket and post an unbounded stream of requests at the endpoint; every one of them
would run the full handler path. Nothing in front of the route counted requests.

`POST /payment/webhook` **ไม่มีการจำกัดอัตราเลย** ผู้เรียกสามารถยิงคำขอเข้าเส้นทางนี้
แบบไม่จำกัด และทุกคำขอจะวิ่งเข้า handler เต็มเส้นทาง ไม่มีอะไรข้างหน้าเส้นทางนับคำขอเลย

What was added is one middleware, mounted on that one route and on no other:

สิ่งที่เพิ่มเข้ามาคือ middleware หนึ่งตัว ติดตั้งบนเส้นทางนี้เส้นทางเดียว และไม่ติดตั้งบน
เส้นทางอื่นเลย

    // server/src/app.ts
    app.post(
      '/payment/webhook',
      webhookRateLimitMiddleware,          // 1. count first
      express.raw({ type: 'application/json' }), // 2. then the body
      paymentWebhookHandler                // 3. then the handler
    );

It is the **reuse** of the Module Hub `rate-limit` module, not new code written for
this work unit. The module provides the counting core, the memory store and the
refusal error; the Host (this repository) supplies only the three things the module's
declared boundary forbids the module from doing itself: resolving the identity key,
reading the environment, and mapping a refusal to an HTTP response.

มันคือ**การนำโมดูล `rate-limit` จาก Module Hub กลับมาใช้** ไม่ใช่โค้ดใหม่ที่เขียนขึ้นสำหรับ
งานนี้ โมดูลให้แกนการนับ หน่วยเก็บในหน่วยความจำ และ error ตอนปฏิเสธ ส่วนฝั่ง Host (เรดิสทอรีนี้)
ให้เฉพาะสามอย่างที่ขอบเขตของโมดูลห้ามโมดูลทำเอง คือ การหาคีย์ระบุตัวตน การอ่าน environment
และการแปลงการปฏิเสธเป็น HTTP response

---

## 2. Where the module came from / โมดูลมาจากไหน

The module is vendored into this repository at `modules/rate-limit/`. Its provenance
is recorded in full in **`modules/rate-limit/PROVENANCE-RATELIMIT.md`**; the short form:

โมดูลนี้ถูกคัดลอกเข้ามาในเรดิสทอรีนี้ที่ `modules/rate-limit/` ที่มาแบบเต็มบันทึกไว้ใน
**`modules/rate-limit/PROVENANCE-RATELIMIT.md`** ฉบับย่อ:

| Field / ฟิลด์ | Value / ค่า |
|---|---|
| source repo / เรดิสทอรีต้นทาง | `modules-hub` |
| source commit / คอมมิตต้นทาง | `cd88c570ab57f6976d15f85d09973d0cfbf0cd63` |
| version / เวอร์ชัน | `0.1.0` (upstream) / `0.1.0` (MT01 copy, `modules/rate-limit/VERSION`) |
| provenance pointer / ที่ชี้ที่มา | `modules/rate-limit/PROVENANCE-RATELIMIT.md` |
| copied at / คัดลอกเมื่อ | 2026-09-28 (UTC) |

**`modules-hub` was never modified.** No file from `modules-hub` is imported across
repositories at runtime: the files under `modules/rate-limit/` are copies held inside
this repository, and the staged upstream reference was opened read-only and never
written to.

**`modules-hub` ไม่ถูกแก้ไขเลย** ไม่มีไฟล์ใดจาก `modules-hub` ถูก import ข้ามเรดิสทอรีตอน
รันไทม์ ไฟล์ใต้ `modules/rate-limit/` เป็นสำเนาที่เก็บอยู่ภายในเรดิสทอรีนี้ และสำเนาอ้างอิง
ต้นทางที่ stage ไว้ถูกเปิดแบบอ่านเท่านั้น ไม่ถูกเขียนทับ

The module's own test files came across with it, so its behaviour is verifiable here
rather than only at the source repository. The one local change on top of the copy is
metadata in `modules/rate-limit/package.json` (`private`, `description`); no runtime
dependency was added and no module source file was edited. See the provenance file.

ไฟล์เทสของโมดูลเองติดมาด้วย พฤติกรรมของมันจึงตรวจสอบได้ในเรดิสทอรีนี้ ไม่ใช่แค่ที่ต้นทาง
การแก้ไขฝั่ง MT01 เพียงอย่างเดียวคือ metadata ใน `modules/rate-limit/package.json`
(`private`, `description`) ไม่มีการเพิ่ม dependency ตอนรันไทม์ และไม่มีการแก้ไฟล์ซอร์สของ
โมดูล ดูรายละเอียดในไฟล์ที่มา

---

## 3. The wiring / การต่อสาย

**Route:** `POST /payment/webhook` only. The limiter is deliberately **not** mounted on
any other route. The paid routes are quota-gated elsewhere and keep their existing
behaviour.

**เส้นทาง:** `POST /payment/webhook` เท่านั้น ตัวจำกัดถูกจงใจ**ไม่**ติดตั้งบนเส้นทางอื่น
เส้นทางแบบเสียเงินถูกกำกับด้วยโควตาแยกต่างหาก และพฤติกรรมเดิมไม่เปลี่ยน

**Mount order and why it matters.** In `server/src/app.ts` the middleware chain for
this route is, in order:

**ลำดับการติดตั้ง และทำไมมันสำคัญ** ใน `server/src/app.ts` ลูกโซ่ middleware ของเส้นทางนี้
เรียงตามลำดับ:

1. `webhookRateLimitMiddleware` — the limiter, **first**;
2. `express.raw({ type: 'application/json' })` — the raw-body parser;
3. `paymentWebhookHandler` — signature verification, provider call, database work.

Why the limiter runs **before** signature verification: so that a flood is refused
**without spending CPU on HMAC work**. Signature verification is the expensive part of
this route — it computes an HMAC over the raw body before it can decide anything. If
the limiter sat behind it, an attacker's flood would still buy a full HMAC computation
per request, which is the cost the limiter exists to remove. With the limiter first,
every request over the limit is refused after a Map lookup and no HMAC is computed for
it at all.

เหตุใดตัวจำกัดจึงทำงาน**ก่อน**การตรวจลายเซ็น เพื่อให้การยิงถล่มถูกปฏิเสธ**โดยไม่ต้องเสีย
CPU ไปกับการคำนวณ HMAC** การตรวจลายเซ็นคือส่วนที่แพงที่สุดของเส้นทางนี้ เพราะต้องคำนวณ
HMAC บน raw body ก่อนจะตัดสินอะไรได้ ถ้าตัวจำกัดอยู่ข้างหลัง การยิงถล่มก็ยังซื้อการคำนวณ
HMAC เต็มรูปแบบต่อหนึ่งคำขอ ซึ่งเป็นต้นทุนที่ตัวจำกัดมีอยู่เพื่อกำจัด เมื่อตัวจำกัดอยู่หน้า
ทุกคำขอที่เกินขีดจะถูกปฏิเสธหลังการค้นหาใน Map ครั้งเดียว และไม่มีการคำนวณ HMAC ให้มันเลย

The middleware also sits ahead of `express.raw()` in the chain, and it **does not read
or alter the request body**. It never touches `req.body`, it consumes no stream and it
buffers nothing. `express.raw()` below it is still the first thing that touches the
body, so the **raw buffer that signature verification needs is unchanged**. This is a
hard requirement of the route: HMAC verification fails if the raw bytes are consumed or
re-serialised before it runs. The limiter only counts — it does no signature, provider
or database work.

middleware ตัวนี้ยังอยู่หน้า `express.raw()` ในลูกโซ่ และมัน**ไม่อ่านและไม่แก้ body ของ
คำขอ** มันไม่แตะ `req.body` ไม่บริโภค stream และไม่ buffer อะไร `express.raw()` ที่อยู่
ถัดลงไปยังคงเป็นสิ่งแรกที่แตะ body ดังนั้น **raw buffer ที่การตรวจลายเซ็นต้องการจึงไม่
เปลี่ยน** นี่เป็นข้อบังคับของเส้นทางนี้: การตรวจ HMAC จะล้มเหลวถ้า raw bytes ถูกบริโภคหรือ
ถูกจัดเรียงใหม่ก่อนมันทำงาน ตัวจำกัดแค่นับ ไม่ทำงานกับลายเซ็น ผู้ให้บริการ หรือฐานข้อมูลเลย

Note the ordering constraint that already existed on this route: the webhook mount must
come **before** the global `express.json()`, or the JSON parser would consume the body
and `rawBody` would be empty. The limiter was inserted at the front of that existing
chain and does not change that constraint.

ข้อจำกัดด้านลำดับที่มีอยู่เดิมของเส้นทางนี้: การติดตั้ง webhook ต้องอยู่**ก่อน**
`express.json()` ระดับ global ไม่เช่นนั้นตัว parse JSON จะบริโภค body และ `rawBody` จะว่าง
ตัวจำกัดถูกแทรกไว้ที่หัวของลูกโซ่เดิมนั้น และไม่เปลี่ยนข้อจำกัดนี้

---

## 4. The key, and its honest cost / คีย์ และราคาที่ต้องจ่ายอย่างตรงไปตรงมา

**The key is a single constant for the route:**

**คีย์คือค่าคงที่ค่าเดียวสำหรับเส้นทางนี้:**

    WEBHOOK_RATE_LIMIT_KEY = 'route:POST /payment/webhook'

Why a constant: this endpoint is called by **Stripe, not by a logged-in user**, so there
is **no tenant id and no session to key on**. The thing being protected here is the
**endpoint**, not the caller, and a constant cannot be varied per request by an attacker.

ทำไมต้องเป็นค่าคงที่: ปลายทางนี้ถูกเรียกโดย **Stripe ไม่ใช่ผู้ใช้ที่ล็อกอิน** จึง**ไม่มี
tenant id และไม่มี session** ให้ใช้เป็นคีย์ สิ่งที่ถูกป้องกันตรงนี้คือ**ปลายทาง** ไม่ใช่
ผู้เรียก และค่าคงที่นั้นผู้โจมตีแปรเปลี่ยนต่อคำขอไม่ได้

Two alternatives were considered and **rejected**:

มีสองทางเลือกที่ถูกพิจารณาแล้ว**ปฏิเสธ**:

- **The caller's IP address — rejected.** This server sets no `trust proxy`, so `req.ip`
  is the socket address and `X-Forwarded-For` is caller-controlled: an attacker varies
  one header and the limiter is defeated. It also fails in the other direction, because
  Stripe delivers from many addresses, so an IP-keyed limiter would spread an
  attacker's flood across many buckets and throttle none of it.
- **An API key or a signature component from the request — rejected.** Stripe does not
  send an API key on deliveries, and deriving the key from the signature would mean
  doing the HMAC work the limiter exists to avoid.

- **IP ของผู้เรียก — ปฏิเสธ** เซิร์ฟเวอร์นี้ไม่ได้ตั้ง `trust proxy` ดังนั้น `req.ip`
  คือที่อยู่ของ socket และ `X-Forwarded-For` ถูกควบคุมโดยผู้เรียก: ผู้โจมตีแค่เปลี่ยน
  header หนึ่งค่า ตัวจำกัดก็พ่ายแพ้ และมันยังล้มเหลวในทางกลับกันด้วย เพราะ Stripe ส่งมาจาก
  หลายที่อยู่ ตัวจำกัดที่ใช้ IP จึงกระจายการยิงถล่มของผู้โจมตีไปหลาย bucket และไม่จำกัด
  อะไรได้เลย
- **API key หรือส่วนประกอบของลายเซ็นจากคำขอ — ปฏิเสธ** Stripe ไม่ส่ง API key มากับ
  การส่ง webhook และการดึงคีย์จากลายเซ็นจะหมายถึงการคำนวณ HMAC ซึ่งเป็นงานที่ตัวจำกัดมีอยู่
 เพื่อหลีกเลี่ยง

**The consequence, stated plainly: legitimate and abusive traffic share one bucket.** A
burst of genuine Stripe deliveries is throttled together with an attacker's flood, and
this limiter cannot tell them apart. Stripe treats a 429 as a delivery failure and
retries with backoff, and the handler's idempotency ledger still makes a retried event
apply at most once — so the failure mode is **delayed delivery, not lost events**. But
the delay is real: this is a **process-protection limit, not a per-caller quota**.

**ผลที่ตามมา พูดตรง ๆ: ทราฟฟิกที่ถูกต้องกับทราฟฟิกที่ abusive ใช้ bucket เดียวกัน** การส่ง
ของ Stripe ที่ถูกต้องเป็นกลุ่มก้อนจะถูกจำกัดไปพร้อมกับการยิงถล่มของผู้โจมตี และตัวจำกัดนี้
แยกสองอย่างนั้นไม่ออก Stripe ถือว่า 429 คือการส่งล้มเหลวและจะลองใหม่แบบถอยหลัง และบัญชี
idempotency ของ handler ยังทำให้เหตุการณ์ที่ลองใหม่มีผลครั้งเดียว — ดังนั้นโหมดล้มเหลวคือ
**การส่งล่าช้า ไม่ใช่เหตุการณ์ที่หายไป** แต่ความล่าช้านั้นเป็นของจริง: นี่คือ**การจำกัดเพื่อ
ป้องกันโปรเซส ไม่ใช่โควตาต่อผู้เรียก**

---

## 5. Configuration / การตั้งค่า

Two environment variables. Their names and unit comments are documented in
`server/.env.example`.

มีตัวแปรสภาพแวดล้อมสองตัว ชื่อและคอมเมนต์หน่วยของมันบันทึกไว้ใน `server/.env.example`

| Variable / ตัวแปร | Unit / หน่วย | Default when unset or empty / ค่าเริ่มต้นเมื่อไม่ตั้งหรือว่าง |
|---|---|---|
| `WEBHOOK_RATE_LIMIT_MAX` | requests (a count, **not** seconds) / จำนวนคำขอ (นับเป็นจำนวน **ไม่ใช่**วินาที) | `60` |
| `WEBHOOK_RATE_LIMIT_WINDOW_MS` | **milliseconds** (ms), not seconds / **มิลลิวินาที** ไม่ใช่วินาที | `60000` (i.e. 60 requests per 60 seconds / คือ 60 คำขอต่อ 60 วินาที) |

Set them **in the process environment**, not in a file — this project has no dotenv and
`server/.env.example` is documentation only (see `docs/house-swarm-7/WU5-DEPLOY.md`
§3.3). For example, and the value exists only in that process:

ตั้งค่า**ใน process environment** ไม่ใช่ในไฟล์ — โปรเจกต์นี้ไม่มี dotenv และ
`server/.env.example` เป็นเอกสารเท่านั้น (ดู `docs/house-swarm-7/WU5-DEPLOY.md` ข้อ 3.3)
ตัวอย่าง ค่าจะอยู่แค่ในโปรเซสนั้น:

    export WEBHOOK_RATE_LIMIT_MAX=60
    export WEBHOOK_RATE_LIMIT_WINDOW_MS=60000

### The two failure modes — do not confuse them / โหมดล้มเหลวสองแบบ — อย่าสับสน

These are **different** situations with **different** outcomes.

สองสถานการณ์นี้**ต่างกัน** และผลลัพธ์**ต่างกัน**

1. **A bad value is CLAMPED to the default and warned about — it never disables the
   limiter.** A present but invalid value (zero, negative, non-numeric, fractional) is
   rejected by the module's config rules, so the Host resolves it here: the value is
   replaced by this file's safe default (`60` / `60000`), the rejection is reported in
   `resolveWebhookRateLimit().rejected`, and **one warning line is logged**. An **absent
   or empty** variable is *not* a misconfiguration — it selects the documented default
   silently. The rule that matters: **a bad value can never silently disable the
   limiter** — a rejected value is always replaced with a positive limit and a positive
   window, so the limiter is always armed.
2. **A limiter failure FAILS CLOSED — the request is refused with HTTP 503.** If the
   limiter itself fails for any other reason (for example the store throws and cannot
   count), the middleware does **not** pass the request through unlimited. It answers
   **HTTP 503** with code **`RATE_LIMIT_UNAVAILABLE`** and the message "Rate limiter is
   unavailable on this server instance, so the request was refused rather than served
   unlimited", and logs an error line. A limiter that cannot count must not become a
   limiter that allows everything silently.

1. **ค่าที่ผิดจะถูก CLAMP เป็นค่าเริ่มต้นและมีคำเตือน — มันปิด limiter ไม่ได้เลย** ค่าที่มีอยู่
   แต่ไม่ถูกต้อง (ศูนย์ ติดลบ ไม่ใช่ตัวเลข เป็นเศษส่วน) จะถูกปฏิเสธตามกฎคอนฟิกของโมดูล ฝั่ง
   Host จึงแก้ตรงนี้: ค่าถูกแทนที่ด้วยค่าเริ่มต้นปลอดภัยของไฟล์นี้ (`60` / `60000`) การปฏิเสธ
   ถูกบันทึกใน `resolveWebhookRateLimit().rejected` และ**พิมพ์คำเตือนหนึ่งบรรทัด** ตัวแปรที่
   **ไม่ตั้งหรือว่าง** *ไม่ใช่* การตั้งค่าผิด — มันเลือกค่าเริ่มต้นที่บันทึกไว้แบบเงียบ ๆ
   กฎที่สำคัญ: **ค่าที่ผิดปิด limiter แบบเงียบ ๆ ไม่ได้เด็ดขาด** — ค่าที่ถูกปฏิเสธจะถูกแทนด้วย
   limit ที่เป็นบวกและหน้าต่างที่เป็นบวกเสมอ limiter จึงพร้อมทำงานเสมอ
2. **ตัว limiter เองล้มเหลวจะ FAIL CLOSED — คำขอถูกปฏิเสธด้วย HTTP 503** ถ้าตัว limiter
   เองล้มเหลวด้วยเหตุอื่น (เช่น store โยน error และนับไม่ได้) middleware จะ**ไม่**ปล่อยคำขอ
   ผ่านแบบไม่จำกัด มันจะตอบ **HTTP 503** พร้อมรหัส **`RATE_LIMIT_UNAVAILABLE`** และข้อความ
   "Rate limiter is unavailable on this server instance, so the request was refused rather
   than served unlimited" และพิมพ์บรรทัด error limiter ที่นับไม่ได้ต้องไม่กลายเป็น limiter
   ที่ปล่อยทุกอย่างแบบเงียบ ๆ

---

## 6. What a refusal looks like / การปฏิเสธมีหน้าตาอย่างไร

A request over the limit is refused with:

คำขอที่เกินขีดจะถูกปฏิเสธด้วย:

- **HTTP 429**
- body code **`RATE_LIMITED`**
- header **`Retry-After`**, in **seconds**, derived from the module's `retryAfterMs`:

      Retry-After = max(1, ceil(retryAfterMs / 1000))

  The `max(1, …)` is deliberate: a refusal whose wait resolved to less than one second
  would otherwise advertise `Retry-After: 0`, which invites an immediate retry loop.

- **HTTP 429**
- รหัสใน body **`RATE_LIMITED`**
- header **`Retry-After`** หน่วยเป็น**วินาที** ดึงมาจาก `retryAfterMs` ของโมดูล

  `max(1, …)` เป็นเจตนา: การปฏิเสธที่เวลารอเหลือน้อยกว่าหนึ่งวินาที จะไม่งั้นประกาศ
  `Retry-After: 0` ซึ่งเชิญให้เกิดการลองใหม่ทันทีเป็นวงจร

The JSON body carries the refusal contract: `error`, `code`, `limit`, `windowMs`,
`remaining` (0), `resetAt`, `retryAfterMs`, and the module's own `details` object passed
through unchanged.

body แบบ JSON มีสัญญาการปฏิเสธ: `error`, `code`, `limit`, `windowMs`, `remaining` (0),
`resetAt`, `retryAfterMs` และออบเจ็กต์ `details` ของโมดูลที่ส่งผ่านไปตามเดิม

Separately, a **limiter failure** answers HTTP 503 with code `RATE_LIMIT_UNAVAILABLE`
(see §5, item 2) — that is a different answer with a different code, not a refusal.

แยกกันออกไป **การที่ limiter ล้มเหลว** จะตอบ HTTP 503 พร้อมรหัส `RATE_LIMIT_UNAVAILABLE`
(ดูข้อ 5 ข้อ 2) — นั่นเป็นคำตอบคนละแบบและคนละรหัส ไม่ใช่การปฏิเสธ

---

## 7. Tests and proof / เทสและการพิสูจน์

### How to run them / วิธีรัน

    cd server
    npx vitest run tests/webhook-rate-limit.test.ts

There are **seven** tests in `server/tests/webhook-rate-limit.test.ts`. They boot the
**real** Express app over real HTTP on an ephemeral port: the limiter, the middleware
chain, `express.raw()` and the webhook handler are the production ones, mounted in the
production order.

มี **เจ็ด** เทสใน `server/tests/webhook-rate-limit.test.ts` เทสเหล่านี้บูตแอป Express
**ตัวจริง** ผ่าน HTTP จริงบนพอร์ตชั่วคราว: ตัวจำกัด ลูกโซ่ middleware, `express.raw()` และ
webhook handler เป็นตัวเดียวกับโปรดักชัน ติดตั้งตามลำดับของโปรดักชัน

What they assert / สิ่งที่เทสยืนยัน:

| Test / เทส | Asserts / ยืนยัน |
|---|---|
| `webhook-allows-up-to-the-limit` | requests 1..limit are accepted (no 429, no `Retry-After`) |
| `webhook-refuses-over-the-limit-with-429-rate-limited` | the request after the limit is 429 with code `RATE_LIMITED`, `limit`, `windowMs`, `remaining: 0`, `retryAfterMs > 0` |
| `webhook-refusal-carries-retry-after-header` | the 429 carries a numeric `Retry-After >= 1`, and it equals `max(1, ceil(retryAfterMs/1000))` |
| `webhook-refusal-happens-before-signature-verification` | order, proven not asserted: an unsigned request **within** the limit answers 401 (so the signature path is live in this very scenario), a signed one answers 200, and an unsigned one **over** the limit answers 429 |
| `webhook-limit-window-resets` | with an injected clock (no sleeps), the counter resets at the next window and the quota is available again |
| `webhook-bad-limit-config-never-silently-disables-limiting` | bad values are clamped to the defaults, reported in `rejected`, warned about, and the route **still** refuses over the limit |
| `webhook-not-configured-still-answers-503-as-before` | with no Stripe configuration the handler's own 503 answers are unchanged by the limiter in front of it |

There is also a standalone HTTP proof harness that drives the real app over real HTTP
and prints one line per observation:

ยังมีฮาร์เนสพิสูจน์แบบ HTTP ที่รันแอปจริงผ่าน HTTP จริง และพิมพ์หนึ่งบรรทัดต่อหนึ่ง
ข้อสังเกต:

    cd server
    node scripts/proofs/fu/ratelimit-proof.mjs

### How strong the assertions are — measured, not assumed / ความแข็งของข้อยืนยัน — วัดจริง ไม่ใช่คาดเดา

The previous lane measured this by mutation, and the numbers below are its measurements,
not a stronger claim:

เลนก่อนหน้าวัดเรื่องนี้ด้วยการทำ mutation และตัวเลขข้างล่างนี้คือผลที่วัดได้ ไม่ใช่ข้ออ้างที่แรงกว่า:

- **Removing the limiter entirely fails 4 of the 7 tests.**
- **A mutation that makes the middleware never refuse fails 5 of the 7 tests.**

- **การถอด limiter ออกทั้งหมดทำให้ 4 จาก 7 เทสล้มเหลว**
- **การ mutate ให้ middleware ไม่ปฏิเสธเลย ทำให้ 5 จาก 7 เทสล้มเหลว**

**The weakest two assertions** are `webhook-allows-up-to-the-limit` and
`webhook-not-configured-still-answers-503-as-before`, because both ultimately assert the
**absence of a 429** — they assert that something did *not* happen, which is weaker
evidence than asserting that something did. They are kept because they pin the
regression directions that matter (the limiter must not refuse legitimate traffic, and
it must not change the handler's existing answers), but they should not be read as
strong proof that the limiter is enforcing anything.

**ข้อยืนยันที่อ่อนที่สุดสองข้อ** คือ `webhook-allows-up-to-the-limit` และ
`webhook-not-configured-still-answers-503-as-before` เพราะทั้งคู่สุดท้ายแล้วยืนยัน
**การไม่มี 429** — ยืนยันว่าบางอย่าง*ไม่*เกิดขึ้น ซึ่งเป็นหลักฐานที่อ่อนกว่าการยืนยันว่า
บางอย่างเกิดขึ้นจริง ทั้งสองยังถูกเก็บไว้เพราะมันตรึงทิศทาง regression ที่สำคัญ (limiter
ต้องไม่ปฏิเสธทราฟฟิกที่ถูกต้อง และต้องไม่เปลี่ยนคำตอบเดิมของ handler) แต่ไม่ควรอ่านมันเป็น
หลักฐานแข็งว่า limiter กำลังบังคับอะไรอยู่จริง

The strongest evidence for the ordering claim is not a single test but the combination:
`webhook-refusal-happens-before-signature-verification` shows a 401 and a 429 on
requests of identical shape, differing only in the bucket's state — and the standalone
harness re-proves it by checking that **not one** post-limit request carries the
signature-path code.

หลักฐานที่แข็งที่สุดสำหรับข้ออ้างเรื่องลำดับไม่ใช่เทสเดียว แต่เป็นการรวมกัน:
`webhook-refusal-happens-before-signature-verification` แสดง 401 และ 429 บนคำขอรูปร่าง
เหมือนกัน ต่างกันแค่สถานะของ bucket — และฮาร์เนสแบบสแตนด์อโลนพิสูจน์ซ้ำด้วยการตรวจว่า
**ไม่มีเลย** คำขอหลังเกินขีดที่พารหัสของเส้นทางลายเซ็น

---

## Limitations

These are stated plainly because a reader must be able to act on them.

ข้อจำกัดเหล่านี้ระบุไว้ตรง ๆ เพราะผู้อ่านต้องใช้งานได้จริง

- **In-process only.** The limiter is backed by the module's **in-memory adapter: a `Map`
  in one process**. A **multi-instance deployment shares no counter**, so the effective
  ceiling **multiplies by the instance count** — run three instances behind a load
  balancer and the ceiling is up to three times the configured limit. It is not a
  distributed rate limiter. A shared store would be required for that, and it is not
  present here.
  **อยู่ในโปรเซสเดียวเท่านั้น** ตัวจำกัดใช้**อะแดปเตอร์ในหน่วยความจำของโมดูล: `Map` ใน
  โปรเซสเดียว** การ deploy **หลายอินสแตนซ์ไม่แชร์ตัวนับกัน** เพดานจริงจึง**คูณด้วยจำนวน
  อินสแตนซ์** — รันสามอินสแตนซ์หลังโหลดบาลานเซอร์ เพดานก็สูงถึงสามเท่าของค่าที่ตั้ง มันไม่ใช่
  distributed rate limiter การจะทำแบบนั้นต้องมี shared store ซึ่งไม่มีอยู่ที่นี่
- **One key covers the endpoint, not the caller.** Because the key is the route constant,
  every caller shares one bucket: legitimate and abusive traffic are throttled together
  and cannot be told apart. A burst of genuine Stripe deliveries can be refused alongside
  an attack (see §4).
  **คีย์เดียวครอบคลุมปลายทาง ไม่ใช่ผู้เรียก** เพราะคีย์คือค่าคงที่ของเส้นทาง ผู้เรียกทุกคนจึง
  ใช้ bucket เดียวกัน: ทราฟฟิกที่ถูกต้องกับที่ abusive ถูกจำกัดรวมกันและแยกไม่ออก การส่งของ
  Stripe ที่ถูกต้องเป็นกลุ่มก้อนอาจถูกปฏิเสธไปพร้อมกับการโจมตี (ดูข้อ 4)
- **A fixed window permits a burst across a window boundary.** A caller can spend the full
  quota at the end of one window and the full quota again at the start of the next, so up
  to roughly twice the limit can pass in a short span around a window boundary. The
  window is fixed, not sliding.
  **หน้าต่างแบบคงที่ยอมให้ยิงถล่มคร่อมขอบหน้าต่าง** ผู้เรียกสามารถใช้โควตาหมดที่ปลายหน้าต่าง
  หนึ่ง และใช้โควตาหมดอีกครั้งที่ต้นหน้าต่างถัดไป คำขอราวสองเท่าของเพดานจึงผ่านได้ใน
  ช่วงสั้น ๆ คร่อมขอบหน้าต่าง หน้าต่างเป็นแบบคงที่ ไม่ใช่แบบเลื่อน
- **Not a substitute for TLS or a supervisor.** This limiter bounds how many requests
  reach the route; it does not encrypt traffic, terminate TLS, restart a crashed process,
  supply secrets, verify signatures or authenticate anyone. It is one layer, in front of
  the others, and it replaces none of them.
  **ไม่ใช่สิ่งทดแทน TLS หรือ supervisor** ตัวจำกัดนี้จำกัดจำนวนคำขอที่มาถึงเส้นทาง มันไม่
  เข้ารหัสทราฟฟิก ไม่ทำ TLS termination ไม่รีสตาร์ทโปรเซสที่ล่ม ไม่ให้ secret ไม่ตรวจลายเซ็น
  และไม่ยืนยันตัวตนใคร มันเป็นชั้นหนึ่งที่อยู่ข้างหน้าชั้นอื่น และไม่แทนที่ชั้นใดเลย
- **Not a per-caller quota.** A single caller can consume the whole bucket; one abusive
  caller can therefore delay every legitimate delivery for the rest of the window.
  **ไม่ใช่โควตาต่อผู้เรียก** ผู้เรียกคนเดียวสามารถใช้ bucket หมดได้ ผู้เรียกที่ abusive คนเดียว
  จึงทำให้การส่งที่ถูกต้องทั้งหมดล่าช้าไปตลอดช่วงที่เหลือของหน้าต่าง
