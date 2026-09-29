# DELIVERY MANIFEST / รายการที่ส่งมอบ

**What this file is.** The explicit, machine-checkable answer to one question: *which files
does a buyer of this product receive?* Every file in this repository is in exactly one group
below. The gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs` — run as
`npm run test:delivery` — parses the groups, compares them with the tree, and fails loudly if
a file is unclassified, if a delivered file carries an internal machine path, if a delivered
file points at a file that is not delivered, if a not-delivered file is unmarked or missing, or
if a declared path residual has gone stale.

**ไฟล์นี้คืออะไร** คำตอบที่ชัดเจนและตรวจได้ด้วยเครื่องสำหรับคำถามเดียว: *ผู้ซื้อผลิตภัณฑ์นี้ได้ไฟล์
อะไรบ้าง* ทุกไฟล์ในรีโปนี้อยู่ในกลุ่มใดกลุ่มหนึ่งข้างล่างเท่านั้น และ gate จะล้มเหลวทันทีถ้ามีไฟล์ที่ยัง
ไม่ถูกจัดประเภท ถ้าไฟล์ที่ส่งมอบมีพาธเครื่องภายใน ถ้าไฟล์ที่ส่งมอบอ้างถึงไฟล์ที่ไม่ถูกส่งมอบ ถ้าไฟล์ที่
ไม่ส่งมอบไม่มีเครื่องหมายหรือหายไป หรือถ้าข้อประกาศ "ส่วนที่เหลือ" ไม่จริงอีกต่อไป

**The vendor's working record is NOT delivered.** The rule: a working paper under
`docs/house-swarm-7/` whose name begins with `FU-` (the repair/review log) or `PRESALE-` (a lane
report for this cleanup job). That is the whole family. Every other file in the tree is
delivered, because the delivered code imports it, the deployment manual points at it, or it is
the source a buyer is buying. A new file that matches no group is a gate failure, not something
to guess about — **including a new working paper**, which is the drift gate `no-unclassified-file`
exists to catch.

**บันทึกการทำงานภายในของผู้ขายไม่ถูกส่งมอบ** กฎคือ ไฟล์ใต้ `docs/house-swarm-7/` ที่ชื่อขึ้นต้นด้วย
`FU-` (บันทึกการซ่อม/ตรวจทาน) หรือ `PRESALE-` (รายงานรายเลนของงานเก็บกวาดนี้) เป็นครอบครัวเดียวกัน
ทั้งหมด ไฟล์อื่นทั้งหมดถูกส่งมอบ ไฟล์ใหม่ที่ไม่อยู่ในกลุ่มใดเลยคือความล้มเหลวของ gate ไม่ใช่เรื่องให้เดา
**รวมถึงไฟล์ทำงานภายในใหม่** ซึ่งเป็น drift ที่ gate ต้องจับ

**Two working papers stay DELIVERED, and one does not.** `FU-RATELIMIT.md` and
`FU-REVIEW-FIX-2.md` are the vendor's technical detail for two shipped features, and delivered
files cite them BY PATH as their reference — the deployment manual's environment-variable table
and the rate-limit module's provenance record cite `FU-RATELIMIT.md`, and the delivered
`claims-check.mjs` rule text and its fixtures cite `FU-REVIEW-FIX-2.md`. Those citing files are
the delivered code and the manual, so the TARGET is delivered rather than the citation
destroyed: a delivered file pointing at a file the buyer does not have is a dangling reference,
and the work unit that raised this finding allowed exactly this resolution ("repoint it, or
reclassify the target"). Both are path-clean. `FU-REVIEW-FIX-3.md`, the file the finding's
review named, is **not** delivered — the one delivered file that cited it by path was repointed
(see below).

**ทำไมบางไฟล์ยังส่งมอบ** `FU-RATELIMIT.md` และ `FU-REVIEW-FIX-2.md` เป็นรายละเอียดเชิงเทคนิคของ
ฟีเจอร์ที่ผู้ซื้อได้รับ และไฟล์ที่ส่งมอบอ้างถึงมันด้วยพาธโดยตรง จึงเลือกทำให้ "เป้าหมาย" ส่งมอบ แทนที่จะ
ทำลายการอ้างอิง ส่วน `FU-REVIEW-FIX-3.md` ที่ผู้ตรวจระบุชื่อไว้ **ไม่** ถูกส่งมอบ และการอ้างอิงจากไฟล์ที่
ส่งมอบถูกแก้ให้ระบุชื่อโดยไม่มีพาธ

**Why a manifest and not a move out of the repository.** The papers are internal working
records and they are already IN git history and on the remote; the decision that removes them
from what a buyer receives cannot be a move inside one lane, because a move only changes a new
commit while every earlier revision still carries them, and the delivered documents cite them
as the evidence record for the current revision. A move would therefore (a) not achieve the
property it appears to achieve and (b) leave the record out of the revision it describes. The
Owner asked for the clearest method that works; declaring the delivered set and enforcing it is
a property a check can hold, and it is enforced rather than trusted.

**ทำไมเลือก manifest ไม่ใช่การย้ายไฟล์ออกจากรีโป** ไฟล์เหล่านี้เป็นบันทึกภายในและอยู่ใน git history
บน remote อยู่แล้ว การย้ายทำได้เพียงเปลี่ยน commit ใหม่ ขณะที่ revision เก่ายังมีไฟล์เหล่านี้ครบ และ
เอกสารที่ส่งมอบอ้างถึงมันเป็นหลักฐานของ revision ปัจจุบัน การย้ายจึงไม่ได้คุณสมบัติที่ดูเหมือนได้ และ
ทำให้หลักฐานหลุดจาก revision ที่มันบรรยาย การประกาศชุดที่ส่งมอบและบังคับด้วย gate จึงเป็นคุณสมบัติที่
ตรวจได้จริง

---

## Delivered

Every path below is what a buyer receives. One line per file, repository-relative. The
7 files under `modules/` listed in the next section are ALSO delivered — they are
broken out there because they are the one recorded exception to the machine-path rule.

```text
.gitignore
BRIEF.md
DELIVERY-MANIFEST.md
STAGE3_EVIDENCE_REPORT.md
docs/CURRENT_STATUS.md
docs/house-swarm-7/FU-RATELIMIT.md
docs/house-swarm-7/FU-REVIEW-FIX-2.md
docs/house-swarm-7/WU3-PAID-ROUTE-INVENTORY.md
docs/house-swarm-7/WU4-SAMPLE-UI.md
docs/house-swarm-7/WU5-DEPLOY.md
docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md
docs/house-swarm-7/WU6-SALES-EN.md
docs/house-swarm-7/WU6-SALES-TH.md
modules/ai-provider/DESIGN.md
modules/ai-provider/MODULE.md
modules/ai-provider/VERSION
modules/ai-provider/adapters/anthropic-adapter.ts
modules/ai-provider/adapters/gemini-adapter.ts
modules/ai-provider/adapters/openai-adapter.ts
modules/ai-provider/core/types.ts
modules/ai-provider/examples/integration.example.ts
modules/ai-provider/index.ts
modules/ai-provider/package-lock.json
modules/ai-provider/package.json
modules/ai-provider/tests/unit/multiprovider.test.ts
modules/ai-provider/tests/unit/openai-adapter.test.ts
modules/ai-provider/tsconfig.json
modules/auth-supabase/.agy-design-prompt.txt
modules/auth-supabase/DESIGN.md
modules/auth-supabase/MODULE.md
modules/auth-supabase/VERSION
modules/auth-supabase/adapters/index.ts
modules/auth-supabase/adapters/supabase-adapter.ts
modules/auth-supabase/core/client.ts
modules/auth-supabase/core/context.ts
modules/auth-supabase/core/error.ts
modules/auth-supabase/core/guards.ts
modules/auth-supabase/core/index.ts
modules/auth-supabase/core/rbac.ts
modules/auth-supabase/core/types.ts
modules/auth-supabase/examples/integration.example.ts
modules/auth-supabase/index.ts
modules/auth-supabase/package-lock.json
modules/auth-supabase/package.json
modules/auth-supabase/tests/unit/context.test.ts
modules/auth-supabase/tests/unit/error.test.ts
modules/auth-supabase/tests/unit/guards.test.ts
modules/auth-supabase/tests/unit/rbac.test.ts
modules/auth-supabase/tests/unit/security-user-metadata.test.ts
modules/auth-supabase/tests/unit/supabase-adapter.test.ts
modules/auth-supabase/tsconfig.json
modules/enterprise-features/DESIGN.md
modules/enterprise-features/MODULE.md
modules/enterprise-features/VERSION
modules/enterprise-features/core/circuit-breaker.ts
modules/enterprise-features/core/tracer.ts
modules/enterprise-features/core/types.ts
modules/enterprise-features/examples/integration.example.ts
modules/enterprise-features/index.ts
modules/enterprise-features/package-lock.json
modules/enterprise-features/package.json
modules/enterprise-features/tests/unit/circuit-breaker.test.ts
modules/enterprise-features/tests/unit/tracer.test.ts
modules/enterprise-features/tsconfig.json
modules/payment/.agy-prompt.md
modules/payment/DESIGN.md
modules/payment/MODULE.md
modules/payment/VERSION
modules/payment/adapters/index.ts
modules/payment/adapters/mock-adapter.ts
modules/payment/adapters/stripe-adapter.ts
modules/payment/core/amount.ts
modules/payment/core/error.ts
modules/payment/core/idempotency.ts
modules/payment/core/index.ts
modules/payment/core/service.ts
modules/payment/core/state.ts
modules/payment/core/types.ts
modules/payment/examples/integration.example.ts
modules/payment/index.ts
modules/payment/package-lock.json
modules/payment/package.json
modules/payment/tests/adapters/refund-checkout-session.test.ts
modules/payment/tests/adapters/stripe-adapter.test.ts
modules/payment/tests/unit/amount.test.ts
modules/payment/tests/unit/error.test.ts
modules/payment/tests/unit/idempotency.test.ts
modules/payment/tests/unit/service.test.ts
modules/payment/tests/unit/state.test.ts
modules/payment/tsconfig.json
modules/rate-limit/DESIGN.md
modules/rate-limit/MODULE.md
modules/rate-limit/PROVENANCE-RATELIMIT.md
modules/rate-limit/VERSION
modules/rate-limit/adapters/index.ts
modules/rate-limit/adapters/memory-store.ts
modules/rate-limit/core/config.ts
modules/rate-limit/core/error.ts
modules/rate-limit/core/index.ts
modules/rate-limit/core/limiter.ts
modules/rate-limit/core/types.ts
modules/rate-limit/examples/integration.example.ts
modules/rate-limit/index.ts
modules/rate-limit/package-lock.json
modules/rate-limit/package.json
modules/rate-limit/tests/config.test.ts
modules/rate-limit/tests/integration/rate-limit.test.ts
modules/rate-limit/tests/limiter.test.ts
modules/rate-limit/tests/memory-store.test.ts
modules/rate-limit/tests/unit/config.test.ts
modules/rate-limit/tests/unit/error.test.ts
modules/rate-limit/tests/unit/limiter.test.ts
modules/rate-limit/tests/unit/memory-store.test.ts
modules/rate-limit/tsconfig.json
modules/rate-limit/vitest.config.ts
modules/subscription/DESIGN.md
modules/subscription/MODULE.md
modules/subscription/PROVENANCE-WU2.md
modules/subscription/PROVENANCE-WU3.md
modules/subscription/VERSION
modules/subscription/adapters/index.ts
modules/subscription/adapters/mock-repository.ts
modules/subscription/core/engine.ts
modules/subscription/core/error.ts
modules/subscription/core/index.ts
modules/subscription/core/repository.ts
modules/subscription/core/service.ts
modules/subscription/core/types.ts
modules/subscription/examples/integration.example.ts
modules/subscription/index.ts
modules/subscription/package-lock.json
modules/subscription/package.json
modules/subscription/tests/unit/subscription.test.ts
modules/subscription/tsconfig.json
modules/tenant-context/DESIGN.md
modules/tenant-context/MODULE.md
modules/tenant-context/VERSION
modules/tenant-context/adapters/dynamic-resolver.ts
modules/tenant-context/adapters/header-resolver.ts
modules/tenant-context/adapters/index.ts
modules/tenant-context/agy-prompt.md
modules/tenant-context/core/context.ts
modules/tenant-context/core/error.ts
modules/tenant-context/core/index.ts
modules/tenant-context/core/scope.ts
modules/tenant-context/core/types.ts
modules/tenant-context/core/validation.ts
modules/tenant-context/examples/integration.example.ts
modules/tenant-context/index.ts
modules/tenant-context/package-lock.json
modules/tenant-context/package.json
modules/tenant-context/tests/unit/context.test.ts
modules/tenant-context/tests/unit/enterprise-auth-tenant.test.ts
modules/tenant-context/tests/unit/security.test.ts
modules/tenant-context/tests/unit/validation.test.ts
modules/tenant-context/tsconfig.json
modules/webhook-receiver/DESIGN.md
modules/webhook-receiver/MODULE.md
modules/webhook-receiver/TEST-REPORT.md
modules/webhook-receiver/VERSION
modules/webhook-receiver/core/errors.ts
modules/webhook-receiver/core/idempotency.ts
modules/webhook-receiver/core/index.ts
modules/webhook-receiver/core/payload.ts
modules/webhook-receiver/core/timestamp.ts
modules/webhook-receiver/core/types.ts
modules/webhook-receiver/core/verifier.ts
modules/webhook-receiver/core/verify.ts
modules/webhook-receiver/integration.example.ts
modules/webhook-receiver/package-lock.json
modules/webhook-receiver/package.json
modules/webhook-receiver/providers/generic-hmac/hmac.ts
modules/webhook-receiver/providers/generic-hmac/index.ts
modules/webhook-receiver/providers/github/index.ts
modules/webhook-receiver/providers/line/index.ts
modules/webhook-receiver/providers/stripe/index.ts
modules/webhook-receiver/tests/webhook.test.ts
modules/webhook-receiver/tsconfig.json
scripts/house-swarm-7/db-check.mjs
scripts/house-swarm-7/setup.md
scripts/house-swarm-7/setup.sh
server/.env.example
server/README.md
server/ROUND1_HANDOFF.md
server/ROUND2_HANDOFF.md
server/ROUND3_HANDOFF.md
server/ROUND4_HANDOFF.md
server/migrations/0001_persistence.sql
server/migrations/0002_usage.sql
server/package-lock.json
server/package.json
server/scripts/proofs/fu/check-env-count.py
server/scripts/proofs/fu/claims-check-numeric-fixtures.mjs
server/scripts/proofs/fu/index-import-safety.mjs
server/scripts/proofs/fu/manual-claims-proof.mjs
server/scripts/proofs/fu/ratelimit-flood-proof.mjs
server/scripts/proofs/fu/ratelimit-proof.mjs
server/scripts/proofs/fu/setup-dbcheck-proof.mjs
server/scripts/proofs/fu/setup-node-env-proof.mjs
server/scripts/proofs/fu/supabase-claims-fixtures.mjs
server/scripts/proofs/wu2/db-proof.mjs
server/scripts/proofs/wu2/migrate-runner-proof.mts
server/scripts/proofs/wu3/quota-proof.mjs
server/scripts/proofs/wu4/e2e-web.mjs
server/scripts/proofs/wu4/i18n-parity.mjs
server/scripts/proofs/wu4/wu4-e2e/app-en.html
server/scripts/proofs/wu4/wu4-e2e/app-th.html
server/scripts/proofs/wu4/wu4-e2e/index-en.html
server/scripts/proofs/wu4/wu4-e2e/index-th.html
server/scripts/proofs/wu4/wu4-e2e/login-en.html
server/scripts/proofs/wu4/wu4-e2e/login-th.html
server/scripts/proofs/wu4/wu4-e2e/plans-en.html
server/scripts/proofs/wu4/wu4-e2e/plans-th.html
server/scripts/proofs/wu4/wu4-e2e/signup-en.html
server/scripts/proofs/wu4/wu4-e2e/signup-th.html
server/scripts/proofs/wu5/delivery-manifest-check.mjs
server/scripts/proofs/wu5/deploy-preflight.mjs
server/scripts/proofs/wu6/claims-check.mjs
server/src/app.ts
server/src/index.ts
server/src/lib/ai.ts
server/src/lib/payments.ts
server/src/lib/persistence/migrate.ts
server/src/lib/persistence/pg-repositories.ts
server/src/lib/persistence/pg.ts
server/src/lib/quota.ts
server/src/lib/rate-limit.ts
server/src/lib/subscriptions.ts
server/src/lib/supabase.ts
server/src/lib/web-pages.ts
server/src/middleware/auth.ts
server/src/middleware/demo-auth.ts
server/src/middleware/tenant.ts
server/src/routes/ai-demo.ts
server/src/routes/payment-demo.ts
server/src/routes/subscription-demo.ts
server/tests/demo-auth-gate.test.ts
server/tests/postgres-persistence.test.ts
server/tests/quota-enforcement.test.ts
server/tests/server.test.ts
server/tests/webhook-rate-limit.test.ts
server/tests/webhook.test.ts
server/tsconfig.json
web/app.html
web/assets/app.css
web/assets/app.js
web/assets/i18n.d.ts
web/assets/i18n.js
web/index.html
web/login.html
web/plans.html
web/signup.html
```

## Delivered with a recorded path residual

These 7 files ARE delivered — the seven vendored module trees are imported by the
running code, so they travel with it. Each carries an **upstream author's own** machine path
inside upstream-authored text (the DESIGN.md "Deliverable exists at …" acceptance line, and the
agent prompts that point at it). They are not the vendor's paths, they are not something a buyer
executes, and editing an upstream-authored copy would falsify the provenance record that asserts
the copy — so they are RECORDED rather than rewritten. The gate asserts each one still exists and
is still dirty; a machine path in any other delivered file fails the gate. Full write-up, by file
and line: `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` §9a.

```text
modules/auth-supabase/.agy-design-prompt.txt
modules/auth-supabase/DESIGN.md
modules/payment/.agy-prompt.md
modules/payment/DESIGN.md
modules/rate-limit/DESIGN.md
modules/tenant-context/agy-prompt.md
modules/webhook-receiver/DESIGN.md
```

## Not delivered

The vendor's internal working record. These files stay in the repository **on purpose** —
delivered documents cite them as evidence — but they are **not part of what a buyer receives**.
Each carries `> INTERNAL — NOT DELIVERED.` in its first lines, so a reader who finds one by accident is not
misled. Their machine paths are expected and allowed; the gate reads this classification instead
of sweeping the whole tree, which is what keeps the record intact.

```text
docs/house-swarm-7/FU-REVIEW-FIX-1.md
docs/house-swarm-7/FU-REVIEW-FIX-3.md
docs/house-swarm-7/FU-REVIEW-FIX-4.md
docs/house-swarm-7/FU-REVIEW-FIX-5.md
docs/house-swarm-7/PRESALE-CLEANUP-P1.md
docs/house-swarm-7/PRESALE-CLEANUP-P2.md
docs/house-swarm-7/PRESALE-CLEANUP-P3A.md
docs/house-swarm-7/PRESALE-CLEANUP-P3B.md
docs/house-swarm-7/PRESALE-CLEANUP-P4.md
```

---

## Where a citation crossed the line, and what was done

A DELIVERED file must not write the path of a NOT-DELIVERED file; the gate checks this as
`no-dangling-citation`. Every reference that crossed the line was resolved by **naming the
record without its path**, so the citation stays traceable and the reader still learns that the
detail is vendor-internal:

| delivered file | reference | what changed |
|---|---|---|
| `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` | row C46 | the path form of the per-lane report for the sales-number gate replaced with its name, marked vendor-internal (the row's `RPT(6)` location is inside the vendor evidence tree) |
| `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` | §8 constraint 5 | the path form of the review-repair log entry for the `index.ts` export change replaced with its name, marked vendor-internal |

References from a **not-delivered** file to another working paper are untouched. This manifest
itself names the not-delivered paths, because it has to declare them; the gate exempts it from
that one check by construction and from no other.

## How a maintainer runs the gate

    cd server && npm run test:delivery

Exit 0 means the tree and this manifest agree. A non-zero exit names the failing `CHECK` line
and the file. To prove the gate can still fail — it runs the real harness against temp copies
of the repository and mutates only the copies, never the tree:

    cd server && node scripts/proofs/wu5/delivery-manifest-check.mjs --self-test

## What this manifest does NOT claim

* It does not claim every downloaded file is free of a `D:\`-rooted path: the 7
  vendored upstream documents above carry their author's own, and that residual is recorded and
  asserted rather than hidden. Making the product run without `modules/` is a product decision,
  not a packaging one.
* It does not remove the working papers from git history, and cannot: they are on the branch and
  on the remote in every earlier revision.
* It does not decide what is delivered — it declares and enforces it. Changing the set means
  editing these groups; the gate then either agrees with the tree or fails.
