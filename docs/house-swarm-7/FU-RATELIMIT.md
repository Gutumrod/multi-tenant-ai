# Rate limiting on `POST /payment/webhook` — H7-FU-RATELIMIT

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

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
      express.raw({ type: 'application/json' }), // 1. the raw body, first
      webhookRateLimitMiddleware,                 // 2. the limiter
      paymentWebhookHandler                       // 3. the handler
    );

**The order in that snippet is the corrected one** (lane P3b, 2026-09-29). An earlier
revision of this document showed the limiter **first**, ahead of `express.raw()`, and
argued that a flood therefore cost no HMAC work. That argument is obsolete: the limiter
needs the raw body precisely because it now verifies the signature itself, so it cannot
run before `express.raw()`. Section 3 states the order the code has today and what it
costs.

**ลำดับในตัวอย่างข้างบนคือลำดับที่แก้แล้ว** (เลน P3b, 2026-09-29) ฉบับก่อนของเอกสารนี้
แสดงตัวจำกัดไว้**ตัวแรก** หน้า `express.raw()` และให้เหตุผลว่าการยิงถล่มจึงไม่กินงาน HMAC
เหตุผลนั้นล้าสมัยแล้ว: ตัวจำกัดต้องใช้ raw body เพราะตอนนี้มันตรวจลายเซ็นเอง จึงอยู่ก่อน
`express.raw()` ไม่ได้ ข้อ 3 ระบุลำดับที่โค้ดมีอยู่จริงในวันนี้และราคาที่ต้องจ่าย

It is the **reuse** of the Module Hub `rate-limit` module, not new code written for
this work unit. The module provides the counting core, the memory store and the
refusal error; the Host (this repository) supplies only the three things the module's
declared boundary forbids the module from doing itself: resolving the identity key,
reading the environment, and mapping a refusal to an HTTP response.

มันคือ**การนำโมดูล `rate-limit` จาก Module Hub กลับมาใช้** ไม่ใช่โค้ดใหม่ที่เขียนขึ้นสำหรับ
งานนี้ โมดูลให้แกนการนับ หน่วยเก็บในหน่วยความจำ และ error ตอนปฏิเสธ ส่วนฝั่ง Host (ที่เก็บโค้ดนี้)
ให้เฉพาะสามอย่างที่ขอบเขตของโมดูลห้ามโมดูลทำเอง คือ การหาคีย์ระบุตัวตน การอ่าน environment
และการแปลงการปฏิเสธเป็น HTTP response

---

## 2. Where the module came from / โมดูลมาจากไหน

The module is vendored into this repository at `modules/rate-limit/`. Its provenance
is recorded in full in **`modules/rate-limit/PROVENANCE-RATELIMIT.md`**; the short form:

โมดูลนี้ถูกคัดลอกเข้ามาในที่เก็บโค้ดนี้ที่ `modules/rate-limit/` ที่มาแบบเต็มบันทึกไว้ใน
**`modules/rate-limit/PROVENANCE-RATELIMIT.md`** ฉบับย่อ:

| Field / ฟิลด์ | Value / ค่า |
|---|---|
| source repo / `repo` ต้นทาง | `modules-hub` |
| source commit / คอมมิตต้นทาง | `cd88c570ab57f6976d15f85d09973d0cfbf0cd63` |
| version / เวอร์ชัน | `0.1.0` (upstream) / `0.1.0` (MT01 copy, `modules/rate-limit/VERSION`) |
| provenance pointer / ที่ชี้ที่มา | `modules/rate-limit/PROVENANCE-RATELIMIT.md` |
| copied at / คัดลอกเมื่อ | 2026-09-28 (UTC) |

**`modules-hub` was never modified.** No file from `modules-hub` is imported across
repositories at runtime: the files under `modules/rate-limit/` are copies held inside
this repository, and the staged upstream reference was opened read-only and never
written to.

**`modules-hub` ไม่ถูกแก้ไขเลย** ไม่มีไฟล์ใดจาก `modules-hub` ถูก import ข้ามรีโปตอน
รันไทม์ ไฟล์ใต้ `modules/rate-limit/` เป็นสำเนาที่เก็บอยู่ภายในที่เก็บโค้ดนี้ และสำเนาอ้างอิง
ต้นทางที่ stage ไว้ถูกเปิดแบบอ่านเท่านั้น ไม่ถูกเขียนทับ

The module's own test files came across with it, so its behaviour is verifiable here
rather than only at the source repository. The one local change on top of the copy is
metadata in `modules/rate-limit/package.json` (`private`, `description`); no runtime
dependency was added and no module source file was edited. See the provenance file.

ไฟล์เทสของโมดูลเองติดมาด้วย พฤติกรรมของมันจึงตรวจสอบได้ในที่เก็บโค้ดนี้ ไม่ใช่แค่ที่ต้นทาง
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

1. `express.raw({ type: 'application/json' })` — the raw-body parser, **first**;
2. `webhookRateLimitMiddleware` — the limiter;
3. `paymentWebhookHandler` — signature verification, provider call, database work.

**The limiter runs AFTER `express.raw()` and BEFORE the handler, and it verifies the
signature itself.** This is the corrected order (lane P3b, 2026-09-29; the code change is
lane P3A, review finding LOW-2). The two facts that force it:

- it needs the **raw body**, because the counting rule depends on whether the delivery's
  signature is genuine, and that can only be decided by computing the HMAC over the raw
  bytes — so the limiter now sits **after** `express.raw()` (lane P3A reversed the previous
  order, which had it ahead of `express.raw()`);
- it deliberately **repeats the same verification the handler performs**, against the
  same secret (`STRIPE_WEBHOOK_SECRET`) on the same raw body, so that a correctly-signed
  delivery is never charged to a bucket an attacker can fill, and the limiter's verdict
  and the handler's answer cannot disagree.

**What that cost — stated plainly, because the previous revision of this section claimed
the opposite.** The old order refused a flood **before** any HMAC work, so a flood was
free. The corrected order **does** spend HMAC work on whatever reaches the middleware:
step 1 below is a coarse every-request bucket, step 2 is the verification, and only step 3
is the tight per-source limit. The trade is deliberate — **bounded real work in exchange
for never refusing a real payment delivery** — and the bound comes from the backstop
(a generous fixed-window bucket charged with every request), not from the absence of work.
A flood is therefore **not free**: it is refused per source, and bounded across the route.

**ตัวจำกัดทำงาน "หลัง" `express.raw()` และ "ก่อน" handler และมันตรวจลายเซ็นเอง** นี่คือลำดับ
ที่แก้แล้ว (เลน P3b, 2026-09-29; โค้ดแก้ในเลน P3A ตามข้อสังเกต LOW-2) มีสองข้อบังคับที่ทำให้
ต้องเป็นลำดับนี้:

- มันต้องใช้ **raw body** เพราะกฎการนับขึ้นกับว่าลายเซ็นของการส่งนั้นของจริงหรือไม่ ซึ่งตัดสิน
  ได้ด้วยการคำนวณ HMAC บน raw bytes เท่านั้น จึงอยู่ก่อน `express.raw()` ไม่ได้
- มัน**ตรวจซ้ำการตรวจเดียวกับที่ handler ทำ** ด้วย secret เดียวกัน (`STRIPE_WEBHOOK_SECRET`)
  บน raw body เดียวกัน โดยเจตนา เพื่อให้การส่งที่ลายเซ็นถูกต้องไม่ถูกนับเข้า bucket ที่ผู้โจมตี
  เติมได้ และคำตัดสินของตัวจำกัดกับคำตอบของ handler ขัดกันไม่ได้

**ราคาที่ต้องจ่าย — ระบุตรง ๆ เพราะฉบับก่อนของข้อนี้เขียนไว้ตรงกันข้าม** ลำดับเดิมปฏิเสธการ
ยิงถล่ม**ก่อน**งาน HMAC ใด ๆ การยิงถล่มจึงฟรี ลำดับที่แก้แล้ว**กิน**งาน HMAC กับทุกคำขอที่มาถึง
middleware: ขั้นที่ 1 ข้างล่างเป็น bucket แบบหยาบที่นับทุกคำขอ ขั้นที่ 2 คือการตรวจลายเซ็น และ
ขั้นที่ 3 เท่านั้นคือขีดจำกัดต่อแหล่งที่เข้มงวด เป็นการแลกที่ตั้งใจ — **งานจริงที่มีขอบเขต แลกกับ
การไม่ปฏิเสธการส่งเงินจริง** — และขอบเขตนั้นมาจาก backstop (bucket แบบหน้าต่างคงที่ที่ใจกว้าง
และนับทุกคำขอ) ไม่ใช่จากการไม่มีงาน การยิงถล่มจึง**ไม่ฟรี**: มันถูกปฏิเสธต่อแหล่ง และถูกจำกัด
ขอบเขตทั้งเส้นทาง

The three steps, in the order the middleware runs them:

สามขั้น เรียงตามลำดับที่ middleware ทำงาน:

1. **BACKSTOP** — one coarse, generous fixed-window bucket under the constant route key
   `route:POST /payment/webhook`, charged with **every** request. This is what keeps total
   work bounded, because step 2 costs an HMAC.
2. **VERIFY** — the same real Stripe signature verification the handler would perform,
   against the same secret, on the same raw body. The verdict is one of
   `valid` / `invalid` / `unavailable` (no secret configured).
3. **PER-SOURCE** — charged **only** with the requests whose signature was `invalid`,
   under a key derived from the request's source address.

1. **BACKSTOP** — bucket แบบหน้าต่างคงที่ตัวเดียวที่หยาบและใจกว้าง ภายใต้คีย์คงที่ของเส้นทาง
   `route:POST /payment/webhook` นับ**ทุก**คำขอ นี่คือสิ่งที่ทำให้งานทั้งหมดมีขอบเขต เพราะ
   ขั้นที่ 2 กิน HMAC
2. **VERIFY** — การตรวจลายเซ็น Stripe ตัวจริงแบบเดียวกับที่ handler ทำ ด้วย secret เดียวกัน
   บน raw body เดียวกัน ผลเป็น `valid` / `invalid` / `unavailable` (ไม่ได้ตั้ง secret)
3. **PER-SOURCE** — นับ**เฉพาะ**คำขอที่ลายเซ็นเป็น `invalid` ภายใต้คีย์ที่มาจากที่อยู่ต้นทางของ
   คำขอ

A request whose signature is **valid** is therefore charged to the backstop and to no other
bucket, so **an attacker's flood can never exhaust the bucket a real delivery is charged
to**. This holds by construction: an attacker can only fill buckets that attacker's own
requests are charged to. The Owner's acceptance test states exactly this property —

คำขอที่ลายเซ็น **ถูกต้อง** จึงถูกนับเข้า backstop และไม่ถูกนับเข้า bucket อื่นเลย **การยิงถล่ม
ของผู้โจมตีจึงทำให้ bucket ที่การส่งจริงถูกนับหมดไม่ได้** ข้อนี้เป็นจริงโดยโครงสร้าง: ผู้โจมตี
เติมได้เฉพาะ bucket ที่คำขอของผู้โจมตีเองถูกนับเข้าเท่านั้น การทดสอบยอมรับของ Owner ระบุ
คุณสมบัตินี้ไว้ตรง ๆ —

> ยิง flood ลายเซ็นผิด แล้ว webhook ลายเซ็นถูกยังผ่าน

**Note the ordering constraint that already existed on this route and still does:** the
webhook mount must come **before** the global `express.json()`, or the JSON parser would
consume the body and `rawBody` would be empty. The limiter sits inside that mount and does
not change the constraint.

**ข้อจำกัดด้านลำดับที่มีอยู่เดิมและยังมีอยู่:** การติดตั้ง webhook ต้องอยู่**ก่อน**
`express.json()` ระดับ global ไม่เช่นนั้นตัว parse JSON จะบริโภค body และ `rawBody` จะว่าง
ตัวจำกัดอยู่ภายใน mount นั้น และไม่เปลี่ยนข้อจำกัดนี้

---

## 4. The keys, and their honest cost / คีย์ และราคาที่ต้องจ่ายอย่างตรงไปตรงมา

**There are two keys now, and the constant one is no longer the limit a caller meets.**
An earlier revision of this section concluded that a single constant per route was the
right — and only feasible — choice, because a forged signature cannot be told from a real
one without doing the HMAC. That conclusion is obsolete (lane P3b, 2026-09-29): the
limiter now **does** the HMAC, so it can tell them apart, and it uses two keys:

| Key / คีย์ | Shape / รูปแบบ | Charged with / นับจาก |
|---|---|---|
| backstop / แบ็กสต็อป | `route:POST /payment/webhook` (constant / ค่าคงที่) | **every** request that reaches the route / **ทุก**คำขอที่มาถึงเส้นทาง |
| per-source / ต่อแหล่ง | `source:<address>` / `source:<ที่อยู่>` | only requests whose signature is **wrong** / เฉพาะคำขอที่ลายเซ็น**ผิด** |

**คีย์มีสองตัวแล้ว และตัวที่เป็นค่าคงที่ก็ไม่ใช่ขีดจำกัดที่ผู้เรียกเจออีกต่อไป** ฉบับก่อนของ
ข้อนี้สรุปว่าคีย์คงที่ค่าเดียวต่อเส้นทางคือทางเลือกที่ถูกและเป็นไปได้ทางเดียว เพราะแยกแยะ
ลายเซ็นปลอมจากของจริงไม่ได้ถ้าไม่คำนวณ HMAC ข้อสรุปนั้นล้าสมัยแล้ว (เลน P3b, 2026-09-29):
ตัวจำกัด**คำนวณ** HMAC แล้ว จึงแยกได้ และมันใช้สองคีย์:

The per-source key is `req.socket.remoteAddress` — **the address the TCP connection really
came from**, which is a socket fact, not a parsed header. No header changes it:
`X-Forwarded-For` is ignored deliberately, because this server sets no `trust proxy`, so a
header would be an attacker-controlled input and keying on one would let a single attacker
mint unlimited buckets. One source's wrong-signature flood fills that source's bucket and
no other's, so a second source — including Stripe — starts from its own full allowance.
`WEBHOOK_RATE_LIMIT_SOURCE_KEY_PREFIX` and the `source:` shape are exported from the
wiring file so a test can assert them.

คีย์ต่อแหล่งคือ `req.socket.remoteAddress` — **ที่อยู่ที่การเชื่อมต่อ TCP มาจากจริง** เป็น
ข้อเท็จจริงของ socket ไม่ใช่ header ที่ถูก parse ไม่มี header ใดเปลี่ยนมันได้: `X-Forwarded-For`
ถูกละเว้นโดยเจตนา เพราะเซิร์ฟเวอร์นี้ไม่ได้ตั้ง `trust proxy` header จึงเป็น input ที่ผู้เรียก
ควบคุมได้ และการคีย์ด้วย header จะทำให้ผู้โจมตีคนเดียวสร้าง bucket ได้ไม่จำกัด การยิงถล่ม
ลายเซ็นผิดของแหล่งหนึ่งจะเติม bucket ของแหล่งนั้นและไม่เติมของแหล่งอื่น แหล่งที่สอง — รวมถึง
Stripe — จึงเริ่มจากโควตาของตัวเองเต็มจำนวน

**The consequence, stated plainly.** A request whose signature is genuine is charged to the
backstop and to nothing else, so **a real Stripe delivery cannot be refused because of an
attacker's flood until the backstop itself is exhausted** (see §4.1 below, which states that
residual honestly). The refusal an abusive caller meets is its **own** source bucket. Two
honest shortfalls remain, and neither is hidden:

**ผลที่ตามมา พูดตรง ๆ** คำขอที่ลายเซ็นของจริงจะถูกนับเข้า backstop และไม่ถูกนับเข้าอย่างอื่น
**การส่งของ Stripe ของจริงจึงถูกปฏิเสธเพราะการยิงถล่มของผู้โจมตีไม่ได้ จนกว่า backstop เอง
จะหมด** (ดูข้อ 4.1 ข้างล่าง ซึ่งระบุส่วนที่เหลืออยู่นี้ตรงไปตรงมา) การปฏิเสธที่ผู้เรียกที่ abusive
เจอคือ bucket ของแหล่ง**ตัวเอง** ยังมีข้อบกพร่องที่ตรงไปตรงมาเหลืออยู่สองข้อ และไม่ได้ซ่อนไว้:

- **Behind a reverse proxy or load balancer every request arrives from the SAME address**
  (the proxy's), so all callers share one source bucket and the per-source rule degrades to
  one bucket for everybody. It keeps the property that matters — a **correctly-signed**
  delivery is still never counted into a per-source bucket — but an operator fronted by a
  proxy should keep the limit generous or do this at the proxy.
- **A fixed window permits a burst across a window boundary**: a caller can spend the full
  quota at the end of one window and the full quota again at the start of the next.

- **หลัง reverse proxy หรือโหลดบาลานเซอร์ ทุกคำขอมาจากที่อยู่**เดียวกัน** (ของ proxy) ผู้เรียก
  ทุกคนจึงแชร์ bucket ต่อแหล่งตัวเดียว และกฎต่อแหล่งลดลงเหลือ bucket เดียวสำหรับทุกคน มันยังคง
  คุณสมบัติที่สำคัญไว้ คือการส่งที่ลายเซ็น**ถูกต้อง**ยังไม่ถูกนับเข้า bucket ต่อแหล่งเลย แต่มือ
  ที่ตั้ง reverse proxy ไว้ข้างหน้าควรตั้งขีดให้ใจกว้าง หรือทำที่ proxy
- **หน้าต่างแบบคงที่ยอมให้ยิงถล่มคร่อมขอบหน้าต่าง**: ผู้เรียกใช้โควตาหมดที่ปลายหน้าต่างหนึ่ง และ
  ใช้หมดอีกครั้งที่ต้นหน้าต่างถัดไป

The earlier revision of this section argued that "legitimate and abusive traffic share one
bucket" and that "the failure mode is delayed delivery, not lost events", and that argument
is corrected here in two places. The corrected position: **legitimate traffic does not share
the abusive caller's bucket** — that is the whole point of the redesign — and "the failure
mode is delayed delivery, not lost events" is true only while the flood is **short**. A flood
that outlives Stripe's retry schedule (roughly three days) or closes the endpoint through
accumulated failure **can lose payment events**, which is exactly why the residual below is
stated as a residual and why an edge/proxy limit remains the real answer.

ฉบับก่อนของข้อนี้อ้างว่า "ทราฟฟิกที่ถูกต้องกับทราฟฟิกที่ abusive ใช้ bucket เดียวกัน" และ
"โหมดล้มเหลวคือการส่งล่าช้า ไม่ใช่เหตุการณ์ที่หายไป" ข้ออ้างนั้นถูกแก้ในสองจุดนี้ จุดยืนที่แก้แล้ว:
**ทราฟฟิกที่ถูกต้องไม่ได้ใช้ bucket เดียวกับผู้เรียกที่ abusive** — นั่นคือจุดทั้งหมดของการ
ออกแบบใหม่ — และ "โหมดล้มเหลวคือการส่งล่าช้า ไม่ใช่เหตุการณ์ที่หายไป" จริงเฉพาะเมื่อการยิงถล่ม
**สั้น** การยิงถล่มที่ยาวกว่าตาราง retry ของ Stripe (ราวสามวัน) หรือทำให้ปลายทางปิดจาก
ความล้มเหลวสะสม **ทำให้เหตุการณ์จ่ายเงินหายได้** ซึ่งเป็นเหตุผลตรง ๆ ที่ข้อ 4.1 ระบุส่วนที่
เหลืออยู่ตรงไปตรงมา และที่ว่าการจำกัดที่ edge/proxy ยังเป็นคำตอบจริง

If a caller wants to reach the per-source limit, it must first send a **wrong signature** —
and producing one costs exactly the HMAC this design chooses to spend. That work is what the
backstop bounds.

ถ้าผู้เรียกต้องการไปถึงขีดจำกัดต่อแหล่ง มันต้องส่ง**ลายเซ็นผิด**ก่อน — และการสร้างลายเซ็นผิด
ต้องเสีย HMAC ตัวเดียวกับที่การออกแบบนี้เลือกจะจ่าย งานนั้นคือสิ่งที่ backstop จำกัดขอบเขตไว้

### 4.1 The backstop, and the residual it cannot cover / แบ็กสต็อป และส่วนที่เหลือที่มันครอบไม่ได้

The backstop is deliberately **materially larger** than the per-source limit: its default is
`WEBHOOK_RATE_LIMIT_BACKSTOP_MAX` = `1000` requests per window, i.e. ≈16.7 requests/second
over the default 60 s window — far above any plausible legitimate delivery rate for one
endpoint, and cheap to serve (1000 HMACs per minute is negligible work for one process). It
must be larger, or it would simply become the old route-wide limit again and refuse a
legitimate Stripe burst at the same point.

แบ็กสต็อปถูกตั้งให้**ใหญ่กว่า**ขีดจำกัดต่อแหล่งอย่างมีนัยสำคัญโดยเจตนา: ค่าเริ่มต้นคือ
`WEBHOOK_RATE_LIMIT_BACKSTOP_MAX` = `1000` คำขอต่อหน้าต่าง คือราว 16.7 คำขอต่อวินาที บนหน้าต่าง
60 วินาที — สูงกว่าอัตราการส่งที่ถูกต้องของปลายทางหนึ่ง ๆ อย่างมาก และเสิร์ฟได้ถูก (1000 HMAC
ต่อนาทีเป็นงานที่น้อยมากสำหรับหนึ่งโปรเซส) มันต้องใหญ่กว่า ไม่งั้นก็กลับไปเป็นขีดจำกัดทั้งเส้นทาง
แบบเดิม และปฏิเสธการส่งของ Stripe ที่ถูกต้อง ณ จุดเดียวกัน

**THE RESIDUAL, STATED PLAINLY: a flood large enough to exhaust the backstop — more than
`1000` requests in one window, by default — IS refused, and while it lasts, a real delivery
arriving in that window would be refused too.** The redesign narrows the exposure from
"60 junk requests a minute are enough to stop a real delivery" to "the endpoint is
saturated", and it does not remove it. It cannot: a per-process counter cannot tell a
saturated endpoint from a legitimate burst without knowing who is calling, and the caller is
only known after the verification the backstop exists to bound. Two further limits are
inherent and are stated with it:

- the counter is **THIS PROCESS's memory only** (`webhookRateLimitStore`), so N instances
  multiply every limit by N;
- the whole mechanism is **a backstop for the process, not a quota for the caller**.

**ส่วนที่เหลืออยู่ ระบุตรง ๆ: การยิงถล่มที่ใหญ่พอจะทำให้ backstop หมด — เกิน `1000` คำขอในหนึ่ง
หน้าต่างตามค่าเริ่มต้น — จะ**ถูกปฏิเสธ** และระหว่างที่มันเกิด การส่งจริงที่เข้ามาในช่วงหน้าต่างนั้น
ก็จะถูกปฏิเสธด้วย** การออกแบบใหม่ลดความเสี่ยงจาก "60 คำขอขยะต่อนาทีก็พอจะหยุดการส่งจริง" เหลือ
"ปลายทางอิ่มตัว" และมันไม่ได้กำจัดความเสี่ยงนั้น กำจัดไม่ได้: ตัวนับต่อโปรเซสแยกปลายทางที่อิ่มตัว
ออกจาก burst ที่ถูกต้องไม่ได้ ถ้าไม่รู้ว่าใครเรียก และรู้ว่าใครเรียกได้หลังการตรวจที่ backstop มีอยู่
เพื่อจำกัดขอบเขต อีกสองข้อจำกัดเป็นเรื่องโดยธรรมชาติและระบุไว้พร้อมกัน:

- ตัวนับเป็น**หน่วยความจำของโปรเซสนี้เท่านั้น** (`webhookRateLimitStore`) N อินสแตนซ์จึงคูณทุก
  ขีดจำกัดด้วย N
- กลไกทั้งหมดเป็น**แบ็กสต็อปของโปรเซส ไม่ใช่โควตาของผู้เรียก**

**An edge/reverse-proxy/WAF limit is still the real answer** for a deployment that must
survive a determined flood. This document does not pretend otherwise.

**การจำกัดที่ edge/reverse-proxy/WAF ยังเป็นคำตอบจริง** สำหรับการ deploy ที่ต้องทนการยิงถล่ม
อย่างมุ่งมั่น เอกสารนี้ไม่แสร้งว่าเป็นอย่างอื่น

---

## 5. Configuration / การตั้งค่า

**Three** environment variables. Their names and unit comments are documented in
`server/.env.example` for the first two; see the note on the third below.

**สาม**ตัวแปรสภาพแวดล้อม ชื่อและคอมเมนต์หน่วยของสองตัวแรกบันทึกไว้ใน `server/.env.example`
ตัวที่สามมีหมายเหตุอยู่ข้างล่าง

| Variable / ตัวแปร | Unit / หน่วย | Default when unset or empty / ค่าเริ่มต้นเมื่อไม่ตั้งหรือว่าง |
|---|---|---|
| `WEBHOOK_RATE_LIMIT_MAX` | requests (a count, **not** seconds) / จำนวนคำขอ (นับเป็นจำนวน **ไม่ใช่**วินาที) | `60` — **per source**, and only for requests whose signature is WRONG / **ต่อแหล่ง** และนับเฉพาะคำขอที่ลายเซ็น**ผิด** |
| `WEBHOOK_RATE_LIMIT_WINDOW_MS` | **milliseconds** (ms), not seconds / **มิลลิวินาที** ไม่ใช่วินาที | `60000` (i.e. 60 wrong-signature requests per source per 60 seconds / คือ 60 คำขอลายเซ็นผิดต่อแหล่งต่อ 60 วินาที) |
| `WEBHOOK_RATE_LIMIT_BACKSTOP_MAX` | requests per window across the ROUTE / จำนวนคำขอต่อหน้าต่างทั้งเส้นทาง | `1000` — charged with **every** request, whatever its signature / นับ**ทุก**คำขอ ไม่ว่าลายเซ็นจะเป็นอะไร |

The backstop variable is currently read by the code but **is not yet listed in
`server/.env.example`**; the harness that compares that file against the code
(`deploy-preflight`) reports it. Documenting it there is deployment-lane work and is
recorded, not hidden, in the wiring file `server/src/lib/rate-limit.ts`.

ตัวแปร backstop ปัจจุบันโค้ดอ่านมันแล้ว แต่**ยังไม่ถูกระบุใน `server/.env.example`** ฮาร์เนสที่
เทียบไฟล์นั้นกับโค้ด (`deploy-preflight`) รายงานเรื่องนี้ การเพิ่มมันที่นั่นเป็นงานของเลน deploy
และถูกบันทึกไว้ ไม่ได้ซ่อน ไว้ในไฟล์ต่อสาย `server/src/lib/rate-limit.ts`

Set them **in the process environment**, not in a file — this project has no dotenv and
`server/.env.example` is documentation only (see `docs/product/WU5-DEPLOY.md`
§3.3). For example, and the value exists only in that process:

ตั้งค่า**ใน process environment** ไม่ใช่ในไฟล์ — โปรเจกต์นี้ไม่มี dotenv และ
`server/.env.example` เป็นเอกสารเท่านั้น (ดู `docs/product/WU5-DEPLOY.md` ข้อ 3.3)
ตัวอย่าง ค่าจะอยู่แค่ในโปรเซสนั้น:

    export WEBHOOK_RATE_LIMIT_MAX=60
    export WEBHOOK_RATE_LIMIT_WINDOW_MS=60000
    export WEBHOOK_RATE_LIMIT_BACKSTOP_MAX=1000

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

A refusal is what a request over a limit gets — **the per-source limit for a wrong
signature, or the backstop for any request once the route is saturated**. Either way:

การปฏิเสธคือสิ่งที่คำขอที่เกินขีดจะได้ — **ขีดจำกัดต่อแหล่งสำหรับลายเซ็นผิด หรือ backstop สำหรับ
คำขอใด ๆ เมื่อเส้นทางอิ่มตัว** ไม่แบบไหนก็ตาม:

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

There are **ten** tests in `server/tests/webhook-rate-limit.test.ts` (seven from lane
H7-FU-RATELIMIT, three added by the MT01 pre-sale cleanup lane P3A). They boot the
**real** Express app over real HTTP on an ephemeral port: the limiter, the middleware
chain, `express.raw()` and the webhook handler are the production ones, mounted in the
production order.

มี **สิบ** เทสใน `server/tests/webhook-rate-limit.test.ts` (เจ็ดจากเลน H7-FU-RATELIMIT และ
สามที่เพิ่มโดยเลน P3A ของงาน MT01 pre-sale cleanup) เทสเหล่านี้บูตแอป Express
**ตัวจริง** ผ่าน HTTP จริงบนพอร์ตชั่วคราว: ตัวจำกัด ลูกโซ่ middleware, `express.raw()` และ
webhook handler เป็นตัวเดียวกับโปรดักชัน ติดตั้งตามลำดับของโปรดักชัน

What they assert / สิ่งที่เทสยืนยัน:

| Test / เทส | Asserts / ยืนยัน |
|---|---|
| `webhook-allows-up-to-the-limit` | requests 1..limit are accepted (no 429, no `Retry-After`) |
| `webhook-refuses-over-the-limit-with-429-rate-limited` | the request after the limit is 429 with code `RATE_LIMITED`, `limit`, `windowMs`, `remaining: 0`, `retryAfterMs > 0` |
| `webhook-refusal-carries-retry-after-header` | the 429 carries a numeric `Retry-After >= 1`, and it equals `max(1, ceil(retryAfterMs/1000))` |
| `webhook-refusal-is-per-source-and-only-for-wrong-signatures` | the refusal is charged to the **source's** bucket, and only requests whose signature is wrong are charged to it. **Renamed and re-scoped by lane P3A:** it was `webhook-refusal-happens-before-signature-verification`, which proved the limiter ran *ahead of* signature verification — the property lane P3A deliberately reversed |
| `webhook-limit-window-resets` | with an injected clock (no sleeps), the counter resets at the next window and the quota is available again |
| `webhook-bad-limit-config-never-silently-disables-limiting` | bad values are clamped to the defaults, reported in `rejected`, warned about, and the route **still** refuses over the limit |
| `webhook-not-configured-still-answers-503-as-before` | with no Stripe configuration the handler's own 503 answers are unchanged by the limiter in front of it |
| `webhook-forged-flood-does-not-refuse-a-signed-delivery` | **new in P3A** — a flood of forged signatures does not cause a correctly-signed delivery to be refused |
| `webhook-per-source-allowance-is-independent` | **new in P3A** — one source's flood does not consume another source's allowance |
| `webhook-backstop-bounds-total-work-even-for-valid-signatures` | **new in P3A** — the coarse every-request backstop bounds total work even when every request is correctly signed (with a clock-alignment helper so a window rollover mid-burst cannot be mistaken for the bound) |

There are also two standalone HTTP proof harnesses that drive the real app over real HTTP
and print one line per observation. The first asserts the ordering lane P3A **replaced**, so
lane P3B retired it in favour of the second:

ยังมีฮาร์เนสพิสูจน์แบบ HTTP สองตัวที่รันแอปจริงผ่าน HTTP จริง และพิมพ์หนึ่งบรรทัดต่อหนึ่ง
ข้อสังเกต ตัวแรกยืนยันลำดับที่เลน P3A **แทนที่ไปแล้ว** เลน P3B จึงเลิกใช้และชี้ไปที่ตัวที่สอง:

    cd server
    node scripts/proofs/fu/ratelimit-proof.mjs   # superseded — prints a SUPERSEDED summary
    node scripts/proofs/fu/ratelimit-flood-proof.mjs   # the current proof

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

These mutation numbers were measured by lane H7-FU-RATELIMIT against the **previous**
ordering. Lane P3A replaced that ordering, so the counts below are the earlier lane's
measurement of a design that no longer exists and must not be read as a current figure.
The current proof is `ratelimit-flood-proof.mjs` (7 checks), whose central observation is
direct rather than statistical: a flood of forged signatures is refused
(`forged_requests_sent=6 accepted=3 refused=3`), and the **correctly-signed** delivery that
follows is answered **200** by the handler — not refused by the limiter.

ตัวเลข mutation เหล่านี้วัดโดยเลน H7-FU-RATELIMIT กับลำดับ**ก่อนหน้า** เลน P3A แทนที่ลำดับนั้น
ไปแล้ว ตัวเลขข้างล่างจึงเป็นผลวัดของเลนก่อนบนดีไซน์ที่ไม่มีอยู่แล้ว และไม่ควรอ่านเป็นตัวเลข
ปัจจุบัน หลักฐานปัจจุบันคือ `ratelimit-flood-proof.mjs` (7 ข้อ) ซึ่งข้อสังเกตหลักเป็นการวัดตรง
ไม่ใช่สถิติ: การยิงถล่มด้วยลายเซ็นปลอมถูกปฏิเสธ (`forged_requests_sent=6 accepted=3 refused=3`)
และคำขอที่ลายเซ็น**ถูกต้อง**ที่ตามมาถูกตอบ **200** โดย handler ไม่ใช่ถูกตัวจำกัดปฏิเสธ

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
- **One key covers the endpoint, not the caller — this is the BACKSTOP's key, not the only
  key.** The `route:POST /payment/webhook` constant is charged with **every** request that
  reaches the middleware, so it is the coarse every-request bound rather than a per-caller
  quota: a sufficiently large flood can still saturate it. Below it, counting is **per
  source**, and only requests whose signature is wrong are charged to a source's bucket, so
  a correctly-signed delivery is not refused because of a forged flood. What this is **not**:
  a real per-caller quota. A source is a socket address, which is a coarse identity, and one
  attacker spread over many addresses still reaches the backstop (see §4.1).
  **คีย์เดียวครอบคลุมปลายทาง ไม่ใช่ผู้เรียก — นี่คือคีย์ของแบ็กสต็อป ไม่ใช่คีย์เดียวที่มี**
  ค่าคงที่ `route:POST /payment/webhook` ถูกคิดกับ**ทุก**คำขอที่มาถึง middleware จึงเป็นเพดาน
  หยาบระดับทุกคำขอ ไม่ใช่โควตาต่อผู้เรียก: การยิงถล่มใหญ่พอจึงยังอัดมันจนเต็มได้ ใต้ลงมามีการนับ
  **แยกตาม source** และคิดเฉพาะคำขอที่ลายเซ็น**ผิด** เข้า bucket ของ source นั้น คำขอที่ลายเซ็น
  ถูกต้องจึงไม่ถูกปฏิเสธเพราะการยิงถล่มด้วยลายเซ็นปลอม สิ่งที่มัน**ไม่**ใช่: โควตาต่อผู้เรียกจริง
  ๆ source คือที่อยู่ซ็อกเก็ตซึ่งเป็นตัวตนแบบหยาบ และผู้โจมตีที่กระจายหลายที่อยู่ยังไปถึง
  แบ็กสต็อปได้ (ดูข้อ 4.1)
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
