# Stage 3 — multi_tenant_ai: webhook middleware order + handleBillingEvent wiring
## Evidence Report (Hermes) — 2026-08-19

**Status:** แก้เสร็จแล้ว (dev test PASS) — ยังไม่ commit (รอ confirm ตามกฎบรีฟ)

---

## 1. สิ่งที่แก้

Repo: `saas-product-hub/products/multi-tenant-ai`

| ไฟล์ | การแก้ |
|------|--------|
| `server/src/app.ts` | ย้าย `/payment/webhook` route (กับ `express.raw()`) ขึ้นไป mount **ก่อน** global `express.json()` — แก้บั๊ก A (body ถูก json() กินก่อน → rawBody ว่าง → signature verify พัง) |
| `server/src/routes/payment-demo.ts` | ① เพิ่ม `idempotencyStore` (in-memory Set ตาม interface) ส่งเข้า `createWebhookReceiver` — แก้ replay กันไม่ได้ ② หลัง verify ผ่าน → `mapStripeEventToBilling()` → `subscriptionCore.handleBillingEvent()` — แก้บั๊ก B (verified event ไม่เคย apply) |
| `server/tests/webhook.test.ts` (ใหม่) | เทส 4 เคส |

ไม่แก้: subscription module core (idempotency `eventId`/`lastProcessedEventId` มีอยู่แล้ว ตรงข้อ 4)

## 2. Stripe event → SubscriptionBillingEvent mapping

`mapStripeEventToBilling()` (payment-demo.ts):
- **accountId** ดึงจาก: `data.object.metadata.account_id` → `metadata.tenantId` → `client_reference_id` → `metadata.shop_id` (Stripe webhook ไม่มี tenant context → ต้องมาจาก metadata ที่ตั้งตอน checkout)
- **eventType mapping:**
  | Stripe type | SubscriptionBillingEvent |
  |---|---|
  | `customer.subscription.created` / `checkout.session.completed` | `subscription.started` |
  | `invoice.paid` | `subscription.renewed` |
  | `invoice.payment_failed` | `subscription.payment_failed` |
  | `customer.subscription.deleted` | `subscription.cancelled` |
  | `customer.subscription.updated` | `subscription.renewed` |
  | อื่น ๆ / ไม่มี accountId | null (ไม่ apply) |
- **currentPeriodEnd** = `data.object.current_period_end` (unix → Date)

## 3. หลักฐานเทสจริง

คำสั่งรัน (ใน `.../multi-tenant-ai/server`):
```
npx tsc --noEmit          # typecheck ผ่าน (ไม่มี error)
npx vitest run            # full suite 13/13 passed
```

ผล webhook tests (`tests/webhook.test.ts`):
| เคส | ผล |
|-----|-----|
| ไม่มี signature header | ✅ 401 reject |
| signature ผิด | ✅ 401 reject |
| signature ถูก → `customer.subscription.deleted` | ✅ 200 + subscription state เปลี่ยน `active` → `cancelled` (พิสูจน์ handleBillingEvent ถูกเรียก) |
| replay event เดิม (idempotency) | ✅ **200** `{received:true, duplicate:true}` + state ไม่เปลี่ยนซ้ำ (ยัง `active`) |

### อัปเดต 2026-08-19 (รอบ 2 — replay fix ตามบรีฟ Stage 3 สถานะล่าสุด)
- **payment-demo.ts** — แยก `WEBHOOK_REPLAY_DETECTED` ออกจาก `!result.valid` → replay ตอบ 200 `{received:true, duplicate:true}` (Stripe ต้องการ 2xx สำหรับ duplicate ไม่ใช่ 401 ที่จะทำให้ retry ไม่หยุด) ยังไม่ apply ซ้ำ
- **webhook.test.ts** — assertion replay 401→200 + เพิ่มเช็ค state ยัง `active` (ไม่ re-apply ซ้ำ)
- รันซ้ำ: typecheck ผ่าน, full suite **13/13 passed**

## 4. Git status (ยังไม่ commit)
```
 M server/src/app.ts
 M server/src/routes/payment-demo.ts
?? server/tests/webhook.test.ts
```

## 5. ยังไม่ commit — รอ confirm ตามกฎบรีฟข้อ 234
