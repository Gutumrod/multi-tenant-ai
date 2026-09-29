# Current Status — Multi-Tenant AI Starter Kit (MT01)

**Purpose:** current-state overlay only. The product contracts and the historical
evidence keep their own authority.

**จุดประสงค์:** เอกสารนี้บอกสถานะปัจจุบันเท่านั้น สัญญาผลิตภัณฑ์และหลักฐานเชิงประวัติ
ยังคงมีอำนาจของตัวเอง

**Prepared by:** HOUSE-SWARM-7 WU-6 · **Date:** 2026-09-28 · **Base:** `6010332`
(`codex/house-swarm-7-wu1-20260927`)

---

## 1. What has changed since the 2026-09-02 status

The previous status described a reference server with **in-memory/demo boundaries**.
That is no longer accurate for the areas listed below. The following are now
**implemented and measured on a real PostgreSQL 16.4 database**:

| Area | Before | Now | How it was proven |
|---|---|---|---|
| Persistence | in-memory repositories | **PostgreSQL repositories** with versioned SQL migrations, seeded plans, and a billing-event ledger | `server/scripts/proofs/wu2/db-proof.mjs` (write → read back → survives reconnect) · restart-persistence proof across two OS processes |
| Usage quota | counted in one place only, not enforced | **enforced before the provider is called**, with a single atomic SQL statement (no read-then-write) | unentitled account → **402 `QUOTA_NOT_ENTITLED`** · over-quota account → **429 `QUOTA_EXCEEDED`** with `provider_fetch_attempts=0` · a successful call consumes exactly one unit (counter 0 → 1 → 2), a failed provider call consumes none |
| Migrations | none | **two** files, applied at startup before the port opens, idempotent | `server/scripts/proofs/wu2/migrate-runner-proof.mts` → exit 0, `migration_runner_idempotent=true`; creates 6 tables |
| Sample user interface | none | **five pages in Thai and English** (index, signup, login, plans, app), 124 dictionary keys per language with identical key sets | `server/scripts/proofs/wu4/e2e-web.mjs` → 9/9 · `i18n-parity.mjs` → 8/8 · ten saved HTML pages |

**In-memory repositories are retained deliberately, for tests and for running
without a database** — they are no longer the only option. When `DATABASE_URL` is
set the server uses PostgreSQL and reports `persistent=true`; with no
`DATABASE_URL` it degrades to in-memory and reports `persistent=false`.
**ที่เก็บข้อมูลแบบ in-memory ยังคงอยู่โดยเจตนา เพื่อใช้ในเทสต์และเพื่อรันโดยไม่มีฐานข้อมูล**
— ไม่ใช่ทางเลือกเดียวอีกต่อไป

## 2. Still NOT implemented, and limits that are implemented but narrow — do not read anything above as saying otherwise

1. **No OpenTelemetry exporter.** Spans are held in process memory only; there is no OTLP endpoint and no collector export.
2. **No LINE webhook verifier.** The verifier returns `WEBHOOK_UNKNOWN_PROVIDER`.
3. **No GitHub webhook verifier.** Same behaviour.
4. **No real Supabase testing.** This kit has been tested with PostgreSQL 16 and has **not** been tested with Supabase; testing against a real Supabase project is scheduled before the kit goes on sale. The auth path exists in code but has never been exercised against a real Supabase project, and the persistence layer is not Supabase-backed (it uses `pg`).
5. **`POST /payment/webhook` IS rate limited, but the limiter is in-process only.** The route carries `webhookRateLimitMiddleware` (`server/src/app.ts`), mounted **after** `express.raw()` and **before** the handler. It verifies the delivery's signature itself, on the same raw body and the same secret the handler uses, and charges only the requests whose signature is **wrong** to a bucket keyed on the request's own source address (`req.socket.remoteAddress`); a **correctly-signed delivery is never charged to any bucket an attacker can fill, and is never refused because of a flood** — an attacker can only exhaust buckets their own requests are charged to. What the redesign costs, stated plainly: because verification now runs before the tight per-source limit, **a flood DOES cost HMAC work**, and that work is bounded instead by a **coarse, generous every-request backstop** charged with every request that reaches the route (`WEBHOOK_RATE_LIMIT_BACKSTOP_MAX`, default `1000` requests per window — about 16.7 requests/second). The limiter is the Module Hub `rate-limit` module, vendored at `modules/rate-limit/` and wired by `server/src/lib/rate-limit.ts`; a refusal is **HTTP 429** with code **`RATE_LIMITED`** and a `Retry-After` header. Limits: `WEBHOOK_RATE_LIMIT_MAX` (default `60` wrong-signature requests **per source**) per `WEBHOOK_RATE_LIMIT_WINDOW_MS` (default `60000` ms), plus the `1000`-request backstop above — see `docs/house-swarm-7/FU-RATELIMIT.md`. The copy provenance of that vendored module — source repo `modules-hub`, source commit `cd88c570ab57f6976d15f85d09973d0cfbf0cd63`, version `0.1.0` — is recorded in `modules/rate-limit/PROVENANCE-RATELIMIT.md`. **What it is not:** the counter lives in one process's memory, so it is **per-instance and resets on restart**, and several instances share no counter, so the effective ceiling multiplies by the instance count. Behind a reverse proxy or load balancer every request arrives from the same socket address, so all callers share one source bucket. And the backstop is a bound on the process's total work, not a quota for the caller. **The residual risk:** a flood large enough to exhaust the backstop — more than `1000` requests in one window, by default — **is** refused, and while it lasts a real delivery arriving in that window would be refused too. The redesign narrows that from "60 junk requests a minute are enough" to "the endpoint is saturated" and does not remove it. It is not a substitute for an edge/proxy rate limit in a multi-instance deployment.
6. **No deployment has ever been performed anywhere**, and there is no multi-instance or clustered proof. Everything measured so far ran on a developer machine against a local PostgreSQL.
7. **The UI evidence is HTTP-level and saved HTML — there are no screenshots**, and no headless browser was driven.
8. **`server/src/index.ts` deliberately does not export a module-scope `app`.** The base build created the app at module scope and bound the port at import time, which is the defect the entry-point guard now fixes; nothing in the repository imports the file, so no caller needs the export. Recorded in `server/src/index.ts` itself and in `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` §8 constraint 5.

**Correction, kept visible.** This document previously listed item 5 as "No rate limiting on `POST /payment/webhook`". That assertion was true when it was written and is **no longer true**: rate limiting was added to that route in the follow-up work unit H7-FU-RATELIMIT. Item 5 was **corrected again** in the MT01 pre-sale cleanup (lane P3b, review finding LOW-2): the earlier corrected text said the limiter was mounted **ahead of** `express.raw()` and refused a request **before** signature verification, so that a flood cost no HMAC work, and that ordering was itself replaced — the limiter now sits **after** `express.raw()` and verifies the signature before counting, so a flood **does** cost HMAC work and is bounded by the coarse backstop. Both the assertion and the ordering it described are corrected rather than deleted, so that no older copy of this file can mislead a reader.

## 3. Commercial terms — Owner decision, still open

**No price, licence or purchase link is set by this document.** Draft legal
documents exist on the `wip/windows-sync-20260925` branch (`LICENSE.md`,
`COMMERCIAL_LICENSE.md`, `EULA.md`, `THIRD_PARTY_LICENSES.md`, `PROVENANCE.md`)
and carry a **target** figure for Owner review. That figure is **not approved**
and must not be published or quoted as a price.

**ยังไม่มีการกำหนดราคา/สัญญาอนุญาตในเอกสารนี้** เอกสารกฎหมายฉบับร่างอยู่บน branch
`wip/windows-sync-20260925` และมีตัวเลข *เป้าหมาย* สำหรับ Owner พิจารณา
**ยังไม่อนุมัติ** ห้ามนำไปประกาศหรืออ้างเป็นราคา

## 4. Remaining gates before any sale listing

- Owner review and legal sign-off on the DRAFT legal documents, and an explicit price/licence decision
- A second, independent pass over the deployment manual after the F1–F7 findings were closed — the manual has been corrected but **not yet re-tested end to end by a fresh agent since the corrections**
- Fulfillment platform selection and integration
- A clean-install proof on a buyer-style environment with none of the internal dependencies
- A final immutable release artifact with regenerated PROVENANCE checksums
- Verification against a real Supabase project, if the buyer's auth path is to be claimed

## 5. Evidence basis

- `601033249d2b1ab005d1ca83dfbe33f66af6e356` (WU-1) plus the HOUSE-SWARM-7 layers WU-2 … WU-6
- Reports: `WSTERA-House/reports/REPORT-HOUSE-SWARM-7-WU{2,3,4,5,6}-2026-09-28.md`
- Gate logs: `WSTERA-House/reports/evidence/house-swarm-7-wu{4,5,6}-commander-gates.log`
- Sales documents and the claim-by-claim evidence map: `docs/house-swarm-7/WU6-SALES-EN.md`, `WU6-SALES-TH.md`, `WU6-CLAIMS-EVIDENCE.md`

## 6. Change rule

Update this file when the branch, gate or runtime reality changes. Do not rewrite
historical evidence to make an old result look current.
