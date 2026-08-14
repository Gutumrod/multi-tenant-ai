# 06 — Multi-Tenant AI SaaS Starter Kit

**สถานะ:** ⚠️ พร้อมแต่ตัดฟีเจอร์ออก 1 อย่าง — ดูด้านล่างก่อนตั้งราคา/สัญญาลูกค้า

## Modules ที่ก็อปมา
- `tenant-context` — multi-tenant + quota (365 บรรทัด)
- `ai-provider` — OpenAI/Anthropic/Gemini interface (573 บรรทัด)
- `subscription` — entitlement engine (485 บรรทัด)
- `payment` — billing (968 บรรทัด)
- `auth-supabase` — RBAC/RLS (587 บรรทัด)

## ⚠️ รู้ไว้ก่อนเขียนบรีฟ — สำคัญ
- **`enterprise-features` (CircuitBreaker + UniversalTracer/OpenTelemetry) ไม่ได้ก็อปมา เพราะ module ว่างเปล่า** — เช็คแล้วโฟลเดอร์นี้ใน modules-hub มีแค่ `package-lock.json` 6 บรรทัด ไม่มีซอร์สโค้ดจริงเลย (commit ที่บอกว่า "เพิ่มแล้ว" ไม่ได้ commit โค้ดจริงมาด้วย)
- แปลว่า blueprint เดิมที่พูดถึง "distributed tracing" ในไอเดียนี้ **ทำไม่ได้จนกว่าจะเขียน enterprise-features ขึ้นมาใหม่** — ถ้าจะขายเป็น "starter kit" ตอนนี้ ตัด tracing claim ออกจากบรีฟ หรือ scope แยกเป็นงานเขียนใหม่ต่างหาก

## TODO — ไล่เขียนด้วยกัน
- [ ] ลูกค้าเป้าหมาย (dev ที่จะสร้าง AI SaaS ของตัวเอง, ขายเป็น boilerplate)
- [ ] MVP scope (ไม่มี tracing ในเวอร์ชันแรก)
- [ ] โมเดลราคา
- [ ] Timeline
- [ ] ความเสี่ยง
