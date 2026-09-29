# FU-REVIEW-FIX-5 — the two credential-shaped placeholders, made obviously fake

**Work unit:** H7-FAKE-VALUES · **Correlation id:** `house-swarm-7-fake-values-20260929`
**Date:** 2026-09-29 · **Branch:** `codex/house-swarm-7-followup-ratelimit-20260928`
**Base revision:** `e8aa9b319fca58d168d52f17ca867953b7ecee0a`

## 1. The ruling this lane executes

The controller ruled (2026-09-29): **"แก้ค่า ไม่เพิ่มข้อยกเว้นใน gate"** — change the values,
and do **not** add an exception or a narrowed rule to `deploy-preflight.mjs`.

The gate's own comment states the rule and its intent (verbatim, from
`server/scripts/proofs/wu5/deploy-preflight.mjs`):

> a credential-shaped value is a Stripe or webhook prefix followed by at least 20
> alphanumeric characters; bare placeholder prefixes are documentation and must NOT be
> flagged

The two values carried 25 and 20 trailing alphanumerics after `sk_test_`, so by the rule the
gate enforces, a **test fixture was indistinguishable from a real key**. The fix is to make the
fixture obviously a fixture — **not** to loosen the rule.

## 2. The two literals, old → new

| file | line | variable | new value (written literally, on disk) |
|---|---|---|---|
| `server/scripts/proofs/fu/ratelimit-proof.mjs` | 53 | `PLACEHOLDER_KEY` | `sk_test_fake_placeholder` |
| `server/tests/webhook-rate-limit.test.ts` | 36 | `STRIPE_SECRET_PLACEHOLDER` | `sk_test_fake_placeholder` |

The variable names were kept. Both are read **only for truthiness** — `server/src/lib/payments.ts`
does `if (!secretKey) return null;` (line 15) — so a shorter value cannot change behaviour, and
that is exactly what the two harnesses below demonstrate by passing.

### The old values, quoted without making this report a sweep hit

This report lives in `docs/`, which the same repo-wide gate scans, so the old literals are
recorded here **by codepoint** rather than printed contiguously (the same practice this lane
inherits from `FU-REVIEW-FIX-1.md`, whose commit is `e8aa9b3`: "quote the flagged word by
codepoint so the report is not itself a sweep hit").

`server/scripts/proofs/fu/ratelimit-proof.mjs:53` — old payload after the `sk_test_` prefix,
**25** characters:

```
U+0068 U+0037 U+0066 U+0075 U+006C U+0069 U+006D U+0069 U+0074 U+0070 U+0072 U+006F U+006F U+0066
U+0070 U+006C U+0061 U+0063 U+0065 U+0068 U+006F U+006C U+0064 U+0065 U+0072
```

preview with codepoints separated so no 20-char run exists: `h·7·f·u·l·i·m·i·t·p·r·o·o·f·p·l·a·c·e·h·o·l·d·e·r`

`server/tests/webhook-rate-limit.test.ts:36` — old payload after the `sk_test_` prefix,
**20** characters:

```
U+0068 U+0037 U+0066 U+0075 U+006C U+0069 U+006D U+0069 U+0074 U+0070 U+006C U+0061 U+0063 U+0065
U+0068 U+006F U+006C U+0064 U+0065 U+0072
```

preview with codepoints separated: `h·7·f·u·l·i·m·i·t·p·l·a·c·e·h·o·l·d·e·r`

Measured mechanically (`node` scratch script reading `git show HEAD:<file>`):

```
server/scripts/proofs/fu/ratelimit-proof.mjs:53
OLD payload-length=25 payload-sha256_16=8d81d6c8b3b3984c matches-gate-regex=true
NEW payload-length=16 payload-sha256_16=8054b95114efed6f matches-gate-regex=false
server/tests/webhook-rate-limit.test.ts:36
OLD payload-length=20 payload-sha256_16=72e2b6aa2b896f12 matches-gate-regex=true
NEW payload-length=16 payload-sha256_16=8054b95114efed6f matches-gate-regex=false
```

The new value's payload (`fake_placeholder`, 16 chars) is **below** the 20-character threshold
and, reading it, is self-evidently a placeholder — no runtime concatenation, no escape, no
scan-evasion. It is written as a plain single-quoted literal at both sites, so a text scan finds
it and a human sees it.

### Comments

Neither site had a comment claiming the value was a real or "test" key, so no comment needed
changing. `server/scripts/proofs/fu/ratelimit-proof.mjs` already describes its own values in its
header (lines 37–38) as "non-secret placeholders, defined in this file, and are never printed" —
still true. The only edits in this lane are the two literal lines.

## 3. `deploy-preflight.mjs` was not modified (evidence)

```
$ git status --porcelain -- server/scripts/proofs/wu5/deploy-preflight.mjs
                                  <- prints nothing
$ git hash-object server/scripts/proofs/wu5/deploy-preflight.mjs
2f072fe59d42f6a7a445221fe13fe06b7922d6a5
$ git rev-parse HEAD:server/scripts/proofs/wu5/deploy-preflight.mjs
2f072fe59d42f6a7a445221fe13fe06b7922d6a5
```

The worktree blob hash equals the `HEAD` blob hash, so the gate is **byte-identical**. The rule
(`CREDENTIAL_PATTERN` at line 55) and its comment (lines 49–54) are untouched; no exception and
no narrowed rule was added.

## 4. Gate output — before and after

### Before (base revision, the two long placeholders in place) — exit code 1

```
CHECK env-example-covers-manual-variables PASS server/.env.example lists all 13 variables the code reads (ANTHROPIC_API_KEY, DATABASE_URL, DEMO_AUTH, GEMINI_API_KEY, NODE_ENV, OPENAI_API_KEY, PORT, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_ANON_KEY, SUPABASE_URL, WEBHOOK_RATE_LIMIT_MAX, WEBHOOK_RATE_LIMIT_WINDOW_MS)
CHECK no-real-credential-in-repo FAIL 2 credential-shaped value(s) found: server/scripts/proofs/fu/ratelimit-proof.mjs:53 sk_test_***REDACTED***; server/tests/webhook-rate-limit.test.ts:36 sk_test_***REDACTED***
CHECK demo-auth-not-default-enabled PASS DEMO_AUTH is empty in .env.example, nothing in the repo sets it to true, and the manual states the production prohibition with the refusal code
CHECK migration-set-listed PASS the manual names all 2 migration files (0001_persistence.sql, 0002_usage.sql) and states when they run and that they are idempotent
CHECK web-assets-present PASS all 8 sample UI files are present, non-empty, and reference no external URL
CHECK routes-documented PASS all 20 registered routes are named in the manual
CHECK manual-has-no-invented-output PASS rule: fenced blocks marked as expected output must contain no hostname, IPv4 address, URL or credential-shaped value, and the artifacts the manual points at must exist; checked 4 expected-output block(s) and both setup artifacts; allowed placeholders are DB_HOST/HOST/localhost/0.0.0.0/127.0.0.1
deploy-preflight: 1 of 7 checks FAILED
```

### After (this lane's change) — exit code 0

```
CHECK env-example-covers-manual-variables PASS server/.env.example lists all 13 variables the code reads (ANTHROPIC_API_KEY, DATABASE_URL, DEMO_AUTH, GEMINI_API_KEY, NODE_ENV, OPENAI_API_KEY, PORT, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_ANON_KEY, SUPABASE_URL, WEBHOOK_RATE_LIMIT_MAX, WEBHOOK_RATE_LIMIT_WINDOW_MS)
CHECK no-real-credential-in-repo PASS no credential-shaped value found (rule: sk_live_/sk_test_/whsec_ followed by >=20 alphanumerics; bare placeholder prefixes are documentation and are allowed)
CHECK demo-auth-not-default-enabled PASS DEMO_AUTH is empty in .env.example, nothing in the repo sets it to true, and the manual states the production prohibition with the refusal code
CHECK migration-set-listed PASS the manual names all 2 migration files (0001_persistence.sql, 0002_usage.sql) and states when they run and that they are idempotent
CHECK web-assets-present PASS all 8 sample UI files are present, non-empty, and reference no external URL
CHECK routes-documented PASS all 20 registered routes are named in the manual
CHECK manual-has-no-invented-output PASS rule: fenced blocks marked as expected output must contain no hostname, IPv4 address, URL or credential-shaped value, and the artifacts the manual points at must exist; checked 4 expected-output block(s) and both setup artifacts; allowed placeholders are DB_HOST/HOST/localhost/0.0.0.0/127.0.0.1
deploy-preflight: all 7 checks PASSED
```

All seven checks pass; the previously failing check `no-real-credential-in-repo` now reports
PASS with no credential-shaped value in the repository.

## 5. Every command, with its exit code

All run from `D:/AI-Workspace/runtime/worktrees/house-swarm-7-fu-ratelimit`.

| # | command | exit |
|---|---|---|
| 1 | `cd server && node scripts/proofs/wu5/deploy-preflight.mjs` (before the change — 1 of 7 FAILED) | 1 |
| 2 | `cd server && node scripts/proofs/wu5/deploy-preflight.mjs` (after the change — all 7 PASSED) | 0 |
| 3 | `cd server && node scripts/proofs/fu/ratelimit-proof.mjs` | 0 |
| 4 | `cd server && npx vitest run tests/webhook-rate-limit.test.ts` | 0 |
| 5 | `cd server && npm run test:quota` | 0 |
| 6 | `cd server && npm run typecheck` | 0 |
| 7 | `git status --porcelain -- server/scripts/proofs/wu5/deploy-preflight.mjs` | 0 (prints nothing) |
| 8 | `git hash-object server/scripts/proofs/wu5/deploy-preflight.mjs` vs `git rev-parse HEAD:...` | 0 (identical) |
| 9 | `node <temp scratch>/h7-sweep.mjs <repo>` — the gate's own `CREDENTIAL_PATTERN` re-applied over the tree | 0 (0 hits of 250 files) |
| 10 | `cd modules/rate-limit && npx vitest run` — the rate-limit module suite | 0 (36/36) |

Observed results of the harness commands:

- **#3 `ratelimit-proof.mjs`** — `SUMMARY checks=5 passed=5 failed=0`. The harness boots the real
  `src/app.ts` on an ephemeral 127.0.0.1 port and observes 429/`RATE_LIMITED` past the limit with
  `Retry-After` present and no post-limit request reaching the signature path.
- **#4 `webhook-rate-limit.test.ts`** — `Test Files 1 passed (1)`, `Tests 7 passed (7)`.
- **#5 `npm run test:quota`** — `"test:quota": "vitest run tests/quota-enforcement.test.ts"`;
  result `Tests 12 passed (12)`. (The packet's parenthetical mentions "36 in the module" — that
  count belongs to the rate-limit Module Hub suite, run separately as #10: 36/36.)
- **#6 `npm run typecheck`** — `tsc --noEmit`, no diagnostics.

### Repo-wide sweep with the gate's own regex (#9)

Equivalent of the packet's `node -e "<gate's own regex over the repo>"` (`node -e` is refused in
this session's single-query mode, so the identical pattern and the identical
`node_modules`/`.git`-skipping walk were placed in a scratch script **outside** the repo —
`$LOCALAPPDATA/Temp/h7-sweep.mjs` — and run against the repo root):

```
repo=D:/AI-Workspace/runtime/worktrees/house-swarm-7-fu-ratelimit
files-scanned=250
credential-shaped-hits=0
EXIT=0
```

`files-scanned=250` equals the tracked-file count (`git ls-files` = 250), so the sweep covered
the whole artifact including `docs/`.

## 6. Diff of this lane

```
 server/scripts/proofs/fu/ratelimit-proof.mjs | 2 +-
 server/tests/webhook-rate-limit.test.ts      | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)
```

Two lines, both of them a credential-placed literal shortened to the placeholder the controller
named. No executable logic changed, no test expectation changed, no other credential-shaped
value touched. Nothing outside `docs/` and `server/` was written.

## 7. Housekeeping

- No commit, no push, no merge, no deploy, no host contact, no credential read, no new
  dependency, no price/licence/currency/purchase text added.
- Nothing was started that needed stopping: no `node.exe` process is running and no listener on
  port 3003 (`netstat -ano | grep LISTENING | grep :3003` → nothing; `tasklist` → no node.exe).
- `06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` was **not** touched (R-3); this lane reports in
  the room.

## 8. Thai summary — สรุปภาษาไทย

**คำวินิจฉัย:** ผู้คุมสั่ง "แก้ค่า ไม่เพิ่มข้อยกเว้นใน gate" — งานนี้แก้ค่าตามที่สั่ง และ
**ไม่ได้แตะไฟล์ gate แม้แต่ไบต์เดียว**

- **ค่าที่แก้** ตัวแปร `PLACEHOLDER_KEY` (`server/scripts/proofs/fu/ratelimit-proof.mjs` บรรทัด 53)
  และ `STRIPE_SECRET_PLACEHOLDER` (`server/tests/webhook-rate-limit.test.ts` บรรทัด 36)
  เปลี่ยนจากข้อความยาว 25 และ 20 ตัวอักษรหลัง `sk_test_` มาเป็น `sk_test_fake_placeholder`
  ซึ่งสั้นและเห็นชัดว่าเป็นของปลอม (ยาว 16 ตัวอักษร และมีขีดล่างคั่น จึงไม่เข้าเงื่อนไข gate)
- **ไม่มีการต่อสตริงตอนรัน ไม่มีการซ่อนจากการสแกน** เขียนเป็น literal ตรง ๆ ทั้งสองที่
- **ชื่อตัวแปรคงเดิม** ทั้งคู่ถูกอ่านแค่เพื่อเช็คว่ามีค่าหรือไม่ (`if (!secretKey) return null;`
  ใน `server/src/lib/payments.ts`) การเปลี่ยนความยาวจึงไม่กระทบพฤติกรรม ซึ่งพิสูจน์ได้จาก
  harness ทั้งสองที่ยังผ่าน
- **gate ไฟล์เดิมทุกไบต์** พิสูจน์ด้วย `git status --porcelain` (ไม่พิมพ์อะไรเลย) และ
  `git hash-object` ของไฟล์เท่ากับ `HEAD:...` คือ `2f072fe5…`
- **ผลตรวจ** deploy-preflight เดิม FAIL 1/7 (เจอค่าต้องสงสัย 2 จุด) ตอนนี้ **PASS ทั้ง 7 ข้อ**;
  ratelimit-proof 5/5; webhook vitest 7/7; `npm run test:quota` 12/12; โมดูล rate-limit 36/36;
  typecheck ผ่าน; สแกนทั้งเรพอด้วย regex ของ gate เอง = 0 จุด จาก 250 ไฟล์
- **ไม่มี commit / push / deploy / แตะ host / อ่าน credential / เพิ่ม dependency**
  ไม่มีพอร์ต 3003 ค้าง และไม่มีโปรเซส node ค้าง
