# 06 — Multi-Tenant AI SaaS Starter Kit

**สถานะ:** ⚠️ พร้อมใช้งาน module ครบแล้ว — ยังต้องประเมิน commercial readiness ก่อนตั้งราคา/สัญญาลูกค้า (ดูด้านล่าง)

## Modules ที่ก็อปมา
- `tenant-context` — multi-tenant + quota (365 บรรทัด)
- `ai-provider` — OpenAI/Anthropic/Gemini interface (573 บรรทัด)
- `subscription` — entitlement engine (485 บรรทัด)
- `payment` — billing (968 บรรทัด)
- `auth-supabase` — RBAC/RLS (587 บรรทัด)
- `enterprise-features` — CircuitBreaker + Tracer contracts, framework-agnostic, no OpenTelemetry adapter yet (ก็อปมาแล้ว 2026-08-16)
- `webhook-receiver` — provider-agnostic crypto webhook verification (Web Crypto only); ships `GenericHmacVerifier` + `StripeWebhookVerifier`; line/github เป็น contract placeholder (return WEBHOOK_UNKNOWN_PROVIDER)

## ⚠️ รู้ไว้ก่อนเขียนบรีฟ — สำคัญ
- **`enterprise-features` (CircuitBreaker + Tracer) เสร็จสมบูรณ์แล้ว 2026-08-14 (v0.3.0)** และก็อปเข้ามาใน product นี้แล้ว 2026-08-16 — ไม่ได้ว่างเปล่าอีกต่อไป (มี `core/circuit-breaker.ts` state machine + `core/tracer.ts` `MemoryTracer`/`NoopTracer` + unit tests 16 ตัว)
- **ข้อควรระวัง:** `MODULE.md` ระบุว่า module นี้ **ไม่มี OpenTelemetry adapter** — `MemoryTracer`/`NoopTracer` เป็น implementation เดียวที่ shipped ดังนั้นถ้าจะอ้าง "distributed tracing" ในสัญญา/การตลาด ยังต้องเขียน OTel adapter ฝั่ง host ก่อนถึงจะจริง ไม่ใช่แค่มี module อยู่

## Reference Server (ตัวอย่างการต่อสาย)
- มี standalone reference server ตัวอย่างอยู่ที่ `server/` (ดูรายละเอียดใน [`server/README.md`](server/README.md)) แสดงการร้อยต่อทั้ง 7 modules (รวม webhook-receiver) เข้าด้วยกันเป็น Express app พร้อม middleware และ demo routes ครบทุกโมดูล
- **สถานะ:** เป็นเพียงโค้ดตัวอย่าง/reference เพื่อพิสูจน์ว่าโมดูลประกอบกันได้จริง (In-memory mock repos, ตัวอย่าง route integration) **ไม่ใช่ production app** — ผู้ซื้อ Starter Kit ยังต้องนำไปต่อยอดส่วน production concerns เอง (ฐานข้อมูลจริง, ระบบ Auth UI, Deployment, Monitoring, OTel Exporter ฯลฯ)

## TODO — ไล่เขียนด้วยกัน
- [ ] ลูกค้าเป้าหมาย (dev ที่จะสร้าง AI SaaS ของตัวเอง, ขายเป็น boilerplate)
- [ ] MVP scope (tracing เป็น optional-include — ต้องเขียน OTel adapter ฝั่ง host ถ้าจะรวม)
- [ ] โมเดลราคา
- [ ] Timeline
- [ ] ความเสี่ยง
