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

**The buyer-facing product is delivered; the vendor's working record is NOT.** The buyer
receives the running product, its buyer-facing documents, and the source it is built from. The
vendor's working record is **everything under `docs/house-swarm-7/`** — the whole folder: the
`FU-` repair/review logs, the `PRESALE-` lane reports for this cleanup job, and the feature
records that used to be delivered (`FU-RATELIMIT.md`, `FU-REVIEW-FIX-2.md`). That family is
closed by the folder, not by a name prefix, and the gate enforces it as a folder: a file added
under `docs/house-swarm-7/` is not delivered whatever it is called, and a delivered file may not
point at one by path. A buyer-facing document lives under `docs/product/`; the vendor keeps
`docs/house-swarm-7/` as its own record of how the product was built and reviewed.

**สิ่งที่ผู้ซื้อได้รับคือตัวผลิตภัณฑ์และเอกสารฝั่งผู้ซื้อ — บันทึกการทำงานภายในไม่ถูกส่งมอบ** บันทึก
ภายในคือ **ทุกไฟล์ใต้ `docs/house-swarm-7/`** ทั้งโฟลเดอร์: บันทึกซ่อม/ตรวจทาน `FU-` รายงานรายเลน
`PRESALE-` และบันทึกฟีเจอร์ที่เคยถูกส่งมอบ (`FU-RATELIMIT.md`, `FU-REVIEW-FIX-2.md`) ครอบครัวนี้ปิด
ด้วย "โฟลเดอร์" ไม่ใช่ด้วยคำนำหน้าชื่อ และ gate บังคับตามโฟลเดอร์จริง ๆ: ไฟล์ที่เพิ่มเข้าใต้
`docs/house-swarm-7/` ไม่ถูกส่งมอบไม่ว่าชื่อจะเป็นอะไร และไฟล์ที่ส่งมอบอ้างถึงมันด้วยพาธไม่ได้
เอกสารฝั่งผู้ซื้ออยู่ใน `docs/product/` ส่วน `docs/house-swarm-7/` เป็นบันทึกของผู้ขายเองว่า
ผลิตภัณฑ์ถูกสร้างและตรวจอย่างไร

**What changed here, and why (review finding LOW-3).** The previous revision classified the
vendor's record by name prefix (`FU-`/`PRESALE-`) and delivered two of those papers by
declaring them exceptions, because delivered files cited them. The independent review of the
merged revision recorded what that costs: the delivered set still carried the vendor's
house-swarm-7 feature logs (`FU-RATELIMIT.md`, `FU-REVIEW-FIX-2.md`), and the delivered module
documents carried an upstream author's machine path that the manifest exempted as a "recorded
path residual" — a declaration the gate could not tell from an exemption. Both are corrected
here rather than re-declared: the vendor's record is excluded as a folder (so a new file cannot
join the delivered set by accident), the buyer-facing documents were moved to `docs/product/`,
and the seven module files' machine paths were replaced with a repository-relative reference
that keeps the provenance identity without the vendor's machine. There is now no declared path
residual at all.

**เปลี่ยนอะไรและเพราะอะไร (ข้อ LOW-3)** revision ก่อนจัดประเภทบันทึกภายในด้วยคำนำหน้าชื่อ
(`FU-`/`PRESALE-`) และส่งมอบสองไฟล์เป็นข้อยกเว้นเพราะไฟล์ที่ส่งมอบอ้างถึง รีวิวอิสระของ revision ที่
merge ไปแล้วบันทึกต้นทุนของวิธีนั้น: ชุดส่งมอบยังพาบันทึกฟีเจอร์ของบ้าน (`FU-RATELIMIT.md`,
`FU-REVIEW-FIX-2.md`) ไปด้วย และเอกสารโมดูลที่ส่งมอบมีพาธเครื่องของผู้เขียนต้นทางซึ่ง manifest
ยกเว้นเป็น "path residual" — คำประกาศที่ gate แยกไม่ออกจากข้อยกเว้น รอบนี้แก้ที่ต้นเหตุแทนการประกาศซ้ำ:
ตัดบันทึกภายในออกเป็นรายโฟลเดอร์ (ไฟล์ใหม่จะหลุดเข้าชุดส่งมอบโดยบังเอิญไม่ได้) ย้ายเอกสารฝั่งผู้ซื้อไป
`docs/product/` และแทนพาธเครื่องใน 7 ไฟล์โมดูลด้วยการอ้างอิงแบบ repo-relative ที่รักษา provenance
ไว้โดยไม่มีข้อมูลเครื่องของผู้ขาย **ตอนนี้ไม่มี path residual ที่ต้องประกาศเลย**

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
`modules/` trees are delivered too, and every one of them is path-clean: the vendored
module documents that used to carry an upstream author's machine path now cite their
source repository-relative, so there is no exception to the machine-path rule.

```text
.gitignore
BRIEF.md
DELIVERY-MANIFEST.md
STAGE3_EVIDENCE_REPORT.md
docs/CURRENT_STATUS.md
docs/product/WU3-PAID-ROUTE-INVENTORY.md
docs/product/WU4-SAMPLE-UI.md
docs/product/WU5-DEPLOY.md
docs/product/WU6-CLAIMS-EVIDENCE.md
docs/product/WU6-SALES-EN.md
docs/product/WU6-SALES-TH.md
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
server/scripts/proofs/security/buyer-package-secret-scan.mjs
server/scripts/proofs/security/dependency-audit.mjs
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
server/src/middleware/tenant-authorization.ts
server/src/routes/ai-demo.ts
server/src/routes/payment-demo.ts
server/src/routes/subscription-demo.ts
server/tests/auth-input-boundary.test.ts
server/tests/demo-auth-gate.test.ts
server/tests/phase-b-db-security.test.ts
server/tests/phase-b-high-security.test.ts
server/tests/phase-b-migration-concurrency.test.ts
server/tests/phase-b-quota-race.test.ts
server/tests/phase-b-surface-security.test.ts
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

## Not delivered

The vendor's internal working record. These files stay in the repository **on purpose** —
delivered documents cite them as evidence — but they are **not part of what a buyer receives**.
Each carries `> INTERNAL — NOT DELIVERED.` in its first lines, so a reader who finds one by accident is not
misled. Their machine paths are expected and allowed; the gate reads this classification instead
of sweeping the whole tree, which is what keeps the record intact.

```text
docs/house-swarm-7/FU-RATELIMIT.md
docs/house-swarm-7/FU-REVIEW-FIX-1.md
docs/house-swarm-7/FU-REVIEW-FIX-2.md
docs/house-swarm-7/FU-REVIEW-FIX-3.md
docs/house-swarm-7/FU-REVIEW-FIX-4.md
docs/house-swarm-7/FU-REVIEW-FIX-5.md
docs/house-swarm-7/PRESALE-CLEANUP-P1.md
docs/house-swarm-7/PRESALE-CLEANUP-P2.md
docs/house-swarm-7/PRESALE-CLEANUP-P3A.md
docs/house-swarm-7/PRESALE-CLEANUP-P3B.md
docs/house-swarm-7/PRESALE-CLEANUP-P4.md
docs/house-swarm-7/PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md
docs/house-swarm-7/PRESALE-PHASE-A-SECURITY-2026-10-02.md
docs/house-swarm-7/DISPATCH-MT01-PHASE-B-R1-CLAUDE-2026-10-03.md
docs/house-swarm-7/DISPATCH-MT01-PHASE-B-R1-OPENCODE-2026-10-03.md
docs/house-swarm-7/DISPATCH-MT01-PHASE-B-R1-SOL-EMERGENCY-2026-10-03.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-EXECUTOR-FALLBACK-2026-10-03.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-HIGH-RED-2026-10-03.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-R1-GREEN-2026-10-03.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-R2-SURFACE-GREEN-2026-10-03.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-R3-FULL-MATRIX-GREEN-2026-10-04.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-R4-QUOTA-RACE-CLOSURE-2026-10-04.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-R5-MIGRATION-CONCURRENCY-2026-10-04.md
docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-OPENCODE-BLOCKED-2026-10-03.md
docs/house-swarm-7/PRESALE-PHASE-B-REMEDIATION-PLAN-2026-10-03.md
docs/house-swarm-7/TASK-MT01-PHASE-B-SEC-REMEDIATION-001.md
```

---

## Where a citation crossed the line, and what was done

A DELIVERED file must not write the path of a NOT-DELIVERED file; the gate checks this as
`no-dangling-citation`. Every reference that crossed the line was resolved by **naming the
record without its path**, so the citation stays traceable and the reader still learns that the
detail is vendor-internal:

| delivered file | reference | what changed |
|---|---|---|
| `docs/product/WU6-CLAIMS-EVIDENCE.md` | row C46 | the path form of the per-lane report for the sales-number gate replaced with its name, marked vendor-internal (the row's `RPT(6)` location is inside the vendor evidence tree) |
| `docs/product/WU6-CLAIMS-EVIDENCE.md` | §8 constraint 5 | the path form of the review-repair log entry for the `index.ts` export change replaced with its name, marked vendor-internal |

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

* It does not claim git history was rewritten: the vendor's working record was on the branch and
  on the remote in every earlier revision, and it still is. What it claims is about the SET a
  buyer receives, which the gate checks against the tree.
* It does not claim the vendored module documents were never machine-specific. They were, and the
  seven that were are listed in `docs/product/WU6-CLAIMS-EVIDENCE.md` §9a: the vendor's absolute
  path was replaced with a repository-relative reference to the same source identity, so the
  provenance still names the module and the upstream commit without naming the vendor's disk.
* It does not decide what is delivered — it declares and enforces it. Changing the set means
  editing these groups; the gate then either agrees with the tree or fails.
