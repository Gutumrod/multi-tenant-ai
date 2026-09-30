# FU-REVIEW-FIX-4 — the two controller rulings: every remaining Thai transliteration, and the two illustrative comment paths

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

Lane: `h7-review-fix-thai-paths`. Work unit: `H7-REVIEW-FIX-THAI-PATHS`.
Correlation id: `house-swarm-7-review-fix-thai-paths-20260929`.
Workspace: `D:/AI-Workspace/runtime/worktrees/house-swarm-7-fu-ratelimit`.
Revision at start: `d37173f54ac42dce0abe189be6af7913b80b8761`.

This is a worker report. It is evidence of what was run, not an approval of the work.

---

## 1. The two rulings, and the measurement that resized the first one

The controller ruled on 2026-09-29 (WSTERA-House status log):

- **①** the Thai transliteration of "repository" that the reviewer flagged in N4 — the
  string whose codepoints are `U+0E40 U+0E23 U+0E14 U+0E34 U+0E2A U+0E17 U+0E2D U+0E23 U+0E35`
  — was to be removed from **every file a buyer receives**, not only N4.
- **②** the real machine path inside the example comments of
  `scripts/house-swarm-7/setup.sh` and `server/scripts/proofs/fu/setup-dbcheck-proof.mjs`
  was to be replaced with a generic placeholder (`/path/to/project`,
  `C:\path\to\project`), and was **not** to be kept as a residual.

The ruling ① was made against an estimate of "4 remaining points outside N4". The measured
size is different, and that is why this unit touches 11 files rather than 5:

```
$ git grep -c "$S" -- .
```

gave 45 occurrences across 11 files — 40 in eleven delivered documents and data files, 4 in
the two *generated* Thai HTML evidence files, and 2 in the dictionary those files are
rendered from (`web/assets/i18n.js`). The two generated files are therefore not hand-edited
anywhere in this lane: they were regenerated from the dictionary.

**Note on this report's own wording.** The banned Thai string is never written out in this
file. It is identified by codepoint instead, and the sweeps in §5 are written to build it from
those codepoints rather than to contain it. Reason: `git grep -n "$S" -- .` (see §5 for `S`)
is one of this unit's own acceptance sweeps, and a report that quotes the literal would make
that sweep non-empty the moment the report is tracked. The *new* Thai wording is given
literally everywhere below, because it is the thing a reviewer has to be able to check.

---

## 2. ① The Thai string — every changed line, old → new

Two wordings were used, chosen per sentence, as the work unit directs:

- **`ที่เก็บโค้ด`** — "the place the code is kept". Used where the sentence is about the
  delivered code base. This is also the register already fixed in N4, so the document set
  stays consistent.
- **`รีโป`** — used only where the sentence is already technical and `git` is the subject.

### 2.1 `docs/product/WU5-DEPLOY.md` — 15 occurrences on 12 lines

| line | old (the string, in its sentence) | new |
|---|---|---|
| 9 | `…ตรวจกับซอร์สของ<STRING>นี้แล้ว` | `…ตรวจกับซอร์สของที่เก็บโค้ดนี้แล้ว` |
| 32 | `เพราะใน<STRING>นี้ไม่มีอย่างอื่นให้เลือก` | `เพราะในที่เก็บโค้ดนี้ไม่มีอย่างอื่นให้เลือก` |
| 58 | `**<STRING>นี้ไม่มี credential และไม่มีฐานข้อมูลให้**` | `**ที่เก็บโค้ดนี้ไม่มี credential และไม่มีฐานข้อมูลให้**` |
| 75 | `…this kit's. / <STRING>นี้ไม่มีให้ โปรเซสต้องรอด…` | `…this kit's. / ที่เก็บโค้ดนี้ไม่มีให้ โปรเซสต้องรอด…` |
| 107 | `เอกสารรุ่นเก่าบางไฟล์ใน<STRING>นี้ระบุว่า "Node.js 20 ขึ้นไป"` | `เอกสารรุ่นเก่าบางไฟล์ในที่เก็บโค้ดนี้ระบุว่า "Node.js 20 ขึ้นไป"` |
| 119 | `รันจาก root ของ<STRING> เว้นแต่…` | `รันจาก root ของที่เก็บโค้ด เว้นแต่…` |
| 150 | `แทน URL ของ<STRING> อย่าใช้` | `แทน URL ของที่เก็บโค้ด อย่าใช้` |
| 152 | `ว่าไม่ใช่<STRING>` | `ว่าไม่ใช่รีโป` — `git` is the subject of this sentence (`ข้อผิดพลาดของ git`), so the short technical form applies |
| 298 | `ไฟล์ server/.env.example ใน<STRING>นี้เป็น**เอกสารเท่านั้น**` | `…ในที่เก็บโค้ดนี้เป็น**เอกสารเท่านั้น**` |
| 386 | `ไม่มีอะไรใน<STRING>นี้ และไม่มีอะไรในเอกสารนี้` | `ไม่มีอะไรในที่เก็บโค้ดนี้ และไม่มีอะไรในเอกสารนี้` |
| 760 | `checkout <STRING>เวอร์ชันก่อนหน้าแล้วสตาร์ทใหม่` | `checkout รีโปเวอร์ชันก่อนหน้าแล้วสตาร์ทใหม่` — a `git` command is the subject |
| 809 | `**ถ้าโฟลเดอร์ส่งมอบไม่ใช่<STRING> git checkout ใช้ไม่ได้…**` | `**ถ้าโฟลเดอร์ส่งมอบไม่ใช่รีโป git checkout ใช้ไม่ได้…**` — same reason |
| 815 | `ว่าโฟลเดอร์นั้นเป็น<STRING>` | `ว่าโฟลเดอร์นั้นเป็นรีโป` — the sentence's English half is "if your delivery is a folder and not a repository" |
| 939 | `**<STRING>นี้ไม่มี credential จริง**` | `**ที่เก็บโค้ดนี้ไม่มี credential จริง**` |
| 972 | `เพราะ<STRING>นี้ไม่มีและผู้เขียนไม่ได้ใช้` | `เพราะที่เก็บโค้ดนี้ไม่มีและผู้เขียนไม่ได้ใช้` |

The English half of each bilingual line is byte-identical to what it was; the diff for this
file is 15 changed Thai lines and nothing else.

### 2.2 `docs/house-swarm-7/FU-RATELIMIT.md` — 6 occurrences on 6 lines

| line | old | new |
|---|---|---|
| 54 | `ส่วนฝั่ง Host (<STRING>นี้)` | `ส่วนฝั่ง Host (ที่เก็บโค้ดนี้)` |
| 65 | `โมดูลนี้ถูกคัดลอกเข้ามาใน<STRING>นี้ที่ modules/rate-limit/` | `…ในที่เก็บโค้ดนี้ที่ modules/rate-limit/` |
| 70 | table row `\| source repo / <STRING>ต้นทาง \| modules-hub \|` | `\| source repo / `repo` ต้นทาง \| modules-hub \|` — structure and the English half kept; only the Thai half replaced |
| 81 | `ถูก import ข้าม<STRING>ตอนรันไทม์` | `ถูก import ข้ามรีโปตอนรันไทม์` |
| 82 | `เป็นสำเนาที่เก็บอยู่ภายใน<STRING>นี้` | `เป็นสำเนาที่เก็บอยู่ภายในที่เก็บโค้ดนี้` |
| 90 | `ตรวจสอบได้ใน<STRING>นี้ ไม่ใช่แค่ที่ต้นทาง` | `ตรวจสอบได้ในที่เก็บโค้ดนี้ ไม่ใช่แค่ที่ต้นทาง` |

### 2.3 `docs/product/WU4-SAMPLE-UI.md` — 5 occurrences on 5 lines

| line | old | new |
|---|---|---|
| 45 | `คำสั่งที่ใช้จริง จาก root ของ<STRING>:` | `คำสั่งที่ใช้จริง จาก root ของที่เก็บโค้ด:` |
| 65 | `คำสั่งที่ใช้จริง จาก root ของ<STRING>:` (the 2.3 section's identical line) | `คำสั่งที่ใช้จริง จาก root ของที่เก็บโค้ด:` |
| 154 | `เพราะ<STRING>นี้` | `เพราะที่เก็บโค้ดนี้` |
| 220 | `เพราะ<STRING>นี้ไม่มีโปรเจกต์ Supabase และไม่มี credential` | `เพราะที่เก็บโค้ดนี้ไม่มีโปรเจกต์ Supabase และไม่มี credential` |
| 224 | `ใน<STRING>นี้ ใช้รันบนเครื่องตัวเองเท่านั้น` | `ในที่เก็บโค้ดนี้ ใช้รันบนเครื่องตัวเองเท่านั้น` |

### 2.4 `docs/product/WU6-SALES-TH.md` — 4 occurrences on 4 lines

| line | old | new |
|---|---|---|
| 66 | `<STRING>ตามที่เป็นอยู่จริง ไม่มีข้อใด…` | `ที่เก็บโค้ดตามที่เป็นอยู่จริง ไม่มีข้อใด…` |
| 166 | `และไม่มีใน<STRING>ให้คัดลอก` | `และไม่มีในที่เก็บโค้ดนี้ให้คัดลอก` |
| 271 | `ใน<STRING>นี้ — ไม่มีส่งมาและไม่ได้ถ่ายไว้` | `ในที่เก็บโค้ดนี้ — ไม่มีส่งมาและไม่ได้ถ่ายไว้` |
| 304 | `ไม่มีการติดตั้งที่ root ของ<STRING>` | `ไม่มีการติดตั้งที่ root ของที่เก็บโค้ด` |

### 2.5 `docs/product/WU6-SALES-EN.md` — 4 occurrences on 4 lines

The English document's Thai halves are the same sentences as 2.4, at different lines:

| line | old | new |
|---|---|---|
| 69 | `<STRING>ตามที่เป็นอยู่จริง ไม่มีข้อใด…` | `ที่เก็บโค้ดตามที่เป็นอยู่จริง ไม่มีข้อใด…` |
| 208 | `และไม่มีใน<STRING>ให้คัดลอก` | `และไม่มีในที่เก็บโค้ดนี้ให้คัดลอก` |
| 337 | `**ไม่มีภาพหน้าจอ** ใน<STRING>นี้ — …` | `**ไม่มีภาพหน้าจอ** ในที่เก็บโค้ดนี้ — …` |
| 381 | `root ของ<STRING> และไม่มีที่โฟลเดอร์บนสุด…` | `root ของที่เก็บโค้ด และไม่มีที่โฟลเดอร์บนสุด…` |

### 2.6 `docs/product/WU6-CLAIMS-EVIDENCE.md` — 3 occurrences, all outside the C-rows

| line | where | old | new |
|---|---|---|---|
| 54 | a section heading | `## 2. The repository contents / เนื้อหาใน<STRING>` | `## 2. The repository contents / เนื้อหาในที่เก็บโค้ด` |
| 131 | prose under §7 (the not-implemented list's evidence paragraph) | `(ข) ที่ที่<STRING>จงใจตอบด้วยรหัส "ยังไม่ได้ทำ"` | `(ข) ที่ที่ที่เก็บโค้ดจงใจตอบด้วยรหัส "ยังไม่ได้ทำ"` |
| 226 | §8 constraint 5's Thai tail | `ไม่มีไฟล์ใดใน<STRING>นี้ import ไฟล์นี้` | `ไม่มีไฟล์ใดในที่เก็บโค้ดนี้ import ไฟล์นี้` |

The gate below confirms no claim row moved: the 64 rows are still byte-identical.

### 2.7 `web/assets/i18n.js` — 2 occurrences (the dictionary the sales prose mirrors)

| line | key | old | new |
|---|---|---|---|
| 273 | `landing.notimpl.supabase` (th) | `…แต่ยังพิสูจน์ที่นี่ไม่ได้ เพราะ<STRING>นี้ไม่มีโปรเจกต์ Supabase และไม่มี credential` | `…แต่ยังพิสูจน์ที่นี่ไม่ได้ เพราะที่เก็บโค้ดนี้ไม่มีโปรเจกต์ Supabase และไม่มี credential` |
| 275 | `landing.notimpl.deploy` (th) | `…ไม่มี process supervisor ใน<STRING>นี้ ใช้รันบนเครื่องตัวเองเท่านั้น` | `…ไม่มี process supervisor ในที่เก็บโค้ดนี้ ใช้รันบนเครื่องตัวเองเท่านั้น` |

The paired `en` strings at lines 101 and 103 were not touched. They say "…because this
repository ships no Supabase project and no credentials." and "…no process supervisor in this
repository." — the Thai and English halves still mean the same thing, which is the
requirement; the English wording is the one the work unit said not to re-translate.

### 2.8 The two generated HTML files — regenerated, not edited

`server/scripts/proofs/wu4/wu4-e2e/index-th.html` (lines 78, 81) and
`server/scripts/proofs/wu4/wu4-e2e/app-th.html` (lines 118, 121) were left alone by hand.
After 2.7 they were produced again by the e2e harness, which reads `web/assets/i18n.js`:

```
$ cd server && OPENAI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs
SAVED …/wu4-e2e/index-th.html 10642
…
SAVED …/wu4-e2e/app-th.html 9986
```

Both files carry the new wording:

```
78:…ยังพิสูจน์ที่นี่ไม่ได้ เพราะที่เก็บโค้ดนี้ไม่มีโปรเจกต์ Supabase และไม่มี credential</strong>
81:…ไม่มี process supervisor ในที่เก็บโค้ดนี้ ใช้รันบนเครื่องตัวเองเท่านั้น</strong>
```

`git diff` on the whole `wu4-e2e/` directory shows **four changed lines in two files**, each of
them the dictionary string and nothing else (`index-en.html` and the other eight saved pages
came back byte-identical, so they do not appear in `git status`). That is the proof the files
were regenerated rather than edited: a hand edit could not have kept the rest of the render
stable while following the dictionary.

### 2.9 `server/.env.example` (1) and `scripts/house-swarm-7/setup.md` (1)

| file | line | old | new |
|---|---|---|---|
| `server/.env.example` | 33 | `# ผู้ซื้อเป็นผู้ใส่ค่านี้เอง ไม่มีที่อยู่เริ่มต้นใน<STRING>นี้` | `# ผู้ซื้อเป็นผู้ใส่ค่านี้เอง ไม่มีที่อยู่เริ่มต้นในที่เก็บโค้ดนี้` |
| `scripts/house-swarm-7/setup.md` | 118 | `ไม่มีที่อยู่ใน<STRING>นี้ให้คัดลอก` | `ไม่มีที่อยู่ในที่เก็บโค้ดนี้ให้คัดลอก` |

---

## 3. ② The two placeholder substitutions, old → new

Both changes are **comment-only**. The executable line count of each file is unchanged; the
diff hunks below are the whole diff of each file.

### 3.1 `scripts/house-swarm-7/setup.sh` lines 211, 213

```
-#    computes is a POSIX path such as /d/AI-Workspace/... ; `node` is a native
+#    computes is a POSIX path such as /d/path/to/project/... ; `node` is a native
 #    program and does not translate it, so it looked the file up under the
-#    current drive (D:\d\AI-Workspace\...\db-check.mjs) and the step failed with
+#    current drive (D:\d\path\to\project\...\db-check.mjs) and the step failed with
```

### 3.2 `server/scripts/proofs/fu/setup-dbcheck-proof.mjs` lines 28, 30

```
- * `/d/AI-Workspace/...`; it was handed straight to native `node.exe`, which does
+ * `/d/path/to/project/...`; it was handed straight to native `node.exe`, which does
  * not translate it, so node looked the file up under the current drive and died
- * with `Cannot find module 'D:\d\AI-Workspace\...\db-check.mjs'`. Git-Bash's
+ * with `Cannot find module 'D:\d\path\to\project\...\db-check.mjs'`. Git-Bash's
```

The trap explanation is intact, because the trap *is* the shape:

- the POSIX form handed in is still shown as `/d/<something>/...`;
- the native form it becomes is still shown as `D:\d\<same something>\...`, i.e. the `/d/`
  became `\d\` and the drive-relative path is still visibly wrong;
- the failure sentence (`Cannot find module …`, `MODULE_NOT_FOUND`) and the
  `MSYS_NO_PATHCONV` / `MSYS2_ARG_CONV_EXCL` explanation are untouched;
- the conclusion (a RELATIVE path is used instead, which has no drive letter to mistranslate)
  is untouched.

Only the machine-specific segment was generalised: `AI-Workspace` → `path/to/project`.

`scripts/house-swarm-7/setup.sh`'s behaviour was not modified — the change is inside the
comment block that ends with the `# ---` rule line above the database step. It is exercised by
`setup-dbcheck-proof.mjs`, whose seven cases all still pass (§6).

---

## 4. ③ The records

- **`docs/product/WU6-CLAIMS-EVIDENCE.md` §9 intro** — the sentence that said the
  section records "the reason each was left alone" now says "what was done with each", and a
  new short paragraph records that the controller ruled on 2026-09-29 and that §9b is where
  the ruling was carried out. It also states that §9a is unchanged.
- **§9b** — retitled from "illustrative examples, controller/owner's call" to "illustrative
  examples, ruled on and substituted"; the table's column header changed from
  "what the path is" to "what the path was"; and the paragraph that ended "They are therefore
  recorded here as residual and **not edited** … belongs to the controller/owner" now records
  the ruling, the substitution (`<machine-specific segment>` → `path/to/project` in both
  forms), that the comments still explain the trap, that no executable line changed, that the
  seven cases still pass, and that this is no longer a residual. The Thai tail was rewritten
  to match.
- The stale phrases the previous lane left are gone from the file: `grep -iE 'left to the
  controller|NOT yet edited|controller.s call'` returns nothing (exit 1).
- **§9a deliberately untouched** — the seven vendored documents were not in the ruling.
- **§8 constraint 6** — checked, not rewritten. It says no delivered document carries an
  internal machine path and points at §9 for the exception class. After this lane the only
  files a sweep still finds with one are the seven §9a files, so constraint 6 and §9a remain
  the correct, consistent statement, and §9b's paragraph no longer contradicts them.
- **`docs/house-swarm-7/FU-REVIEW-FIX-3.md`** was not edited, as the work unit directs.
- **Self-reference check.** The first draft of the §9b paragraph quoted the old path literally
  in order to show the substitution; that would have put the vendor's machine path back into a
  delivered file, which is exactly what §8 constraint 6 and §9's introduction forbid. It was
  replaced with the generic form before any gate was run. The final text of the ledger contains
  no vendor token — see the second sweep in §5.

---

## 5. The two `git grep` sweeps

The string under test is built from its codepoints so that this report does not contain it:

```
$ S=$(printf '\u0E40\u0E23\u0E14\u0E34\u0E2A\u0E17\u0E2D\u0E23\u0E35')   # the 9 codepoints of the flagged word
$ git grep -n "$S" -- .
$ echo $?
1
```

Empty output, exit status 1 (git grep's "no match"). The same sweep by count:

```
$ git grep -o "$S" -- . | wc -l
0
```

Verification that `$S` really is the string the sweep is about: the same construction, piped to
`od`, must equal the bytes the pre-work revision carries. `git show HEAD:web/assets/i18n.js | grep -o "$S"`
prints the word; `printf '%s' "$S" | od -An -tx1` prints
`e0 b9 80 e0 b8 a3 e0 b8 94 e0 b8 b4 e0 b8 aa e0 b8 97 e0 b8 ad e0 b8 a3 e0 b8 b5`, which is
the same 27 bytes shown in §1's codepoint list. A reviewer can therefore re-run the sweep
against the tracked tree without this file becoming a match.

**Sweep 2 — the machine paths.** Command and exact output:

```
$ git grep -nIE 'AI-Workspace|Users\.Win11|wachiraya' -- .
```

```
modules/auth-supabase/.agy-design-prompt.txt:4:D:\AI-Workspace\projects\modules-hub\modules\auth-supabase\DESIGN.md
modules/auth-supabase/DESIGN.md:533:1. [ ] **File Location:** Deliverable exists at `D:\AI-Workspace\projects\modules-hub\modules\auth-supabase\DESIGN.md`.
modules/payment/.agy-prompt.md:6:D:\AI-Workspace\projects\modules-hub\modules\payment\DESIGN.md
modules/payment/DESIGN.md:631:1. [ ] **File Location:** Deliverable exists at `D:\AI-Workspace\projects\modules-hub\modules\payment\DESIGN.md`.
modules/rate-limit/DESIGN.md:522:1. [ ] **File Location:** Deliverable exists at `D:\AI-Workspace\projects\modules-hub\modules\rate-limit\DESIGN.md`.
modules/tenant-context/agy-prompt.md:6:D:\AI-Workspace\projects\modules-hub\modules\tenant-context\DESIGN.md
modules/tenant-context/agy-prompt.md:11:Match the structure and tone of the existing HTTP Client module DESIGN.md (D:\AI-Workspace\projects\modules-hub\http-client-module\DESIGN.md). …
modules/tenant-context/agy-prompt.md:39:- Write to the exact absolute path: D:\AI-Workspace\projects\modules-hub\modules\tenant-context\DESIGN.md
modules/webhook-receiver/DESIGN.md:567:1. `DESIGN.md` exists at `D:\AI-Workspace\projects\modules-hub\modules\webhook-receiver\DESIGN.md`.
```

(Line 11 of `modules/tenant-context/agy-prompt.md` is quoted to its first sentence here for
width; the full line is the upstream instruction about matching the HTTP Client module's
section list.)

Nine hits in **seven files**, and each of the seven is a row of §9a's table:
`modules/auth-supabase/DESIGN.md`, `modules/auth-supabase/.agy-design-prompt.txt`,
`modules/payment/DESIGN.md`, `modules/payment/.agy-prompt.md`, `modules/rate-limit/DESIGN.md`,
`modules/tenant-context/agy-prompt.md`, `modules/webhook-receiver/DESIGN.md`. The per-file
count, for a compact check:

```
$ git grep -nIE 'AI-Workspace|Users\.Win11|wachiraya' -- . | sed 's/:.*//' | sort | uniq -c
      1 modules/auth-supabase/.agy-design-prompt.txt
      1 modules/auth-supabase/DESIGN.md
      1 modules/payment/.agy-prompt.md
      1 modules/payment/DESIGN.md
      1 modules/rate-limit/DESIGN.md
      3 modules/tenant-context/agy-prompt.md
      1 modules/webhook-receiver/DESIGN.md
```

No delivered document, no `docs/` file, no `web/` file, no `server/` file and no `scripts/`
file carries a machine path any more. `scripts/house-swarm-7/setup.sh` and
`server/scripts/proofs/fu/setup-dbcheck-proof.mjs` — the two files §9b used to list as residual
— are absent from the sweep.

The gate that encodes this for the delivered set agrees:

```
$ python docgates.py --tree <WT> fu3-no-internal-path
CHECK fu3-no-internal-path PASS 12 delivered documents carry no vendor machine path
$ echo $?
0
```

(at baseline, before this lane, the same gate also passed — the 12 documents it names were
already clean; the two files this lane changed were never in its list. The value of this run is
that it still passes after the ledger's §9b was rewritten.)

---

## 6. Every command, with its exit code

Run in `D:/AI-Workspace/runtime/worktrees/house-swarm-7-fu-ratelimit` unless the command starts
with `cd server`.

| # | command | result | exit |
|---|---|---|---|
| 1 | `S=$(printf '\u0E40\u0E23\u0E14\u0E34\u0E2A\u0E17\u0E2D\u0E23\u0E35'); git grep -n "$S" -- .` | no output | 1 |
| 2 | `git grep -o "$S" -- . \| wc -l` | `0` | 0 |
| 3 | `git grep -nIE 'AI-Workspace\|Users\.Win11\|wachiraya' -- .` | 9 hits, 7 files, all §9a (full output in §5) | 0 |
| 4 | `cd server && OPENAI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs` | `SUMMARY checks=9 passed=9 failed=0 output_dir=…/wu4-e2e` | 0 |
| 5 | `cd server && node scripts/proofs/fu/setup-dbcheck-proof.mjs` | `SUMMARY checks=9 passed=9 failed=0` | 0 |
| 6 | `cd server && node scripts/proofs/fu/manual-claims-proof.mjs` | `SUMMARY claims=13 passed=13 failed=0` | 0 |
| 7 | `cd server && node scripts/proofs/wu6/claims-check.mjs` | `SUMMARY checks=8 passed=8 failed=0` | 0 |
| 8 | `cd server && node scripts/proofs/fu/supabase-claims-fixtures.mjs` | `SUMMARY cases=9 passed=9 failed=0` | 0 |
| 9 | `cd server && npx tsx scripts/proofs/fu/index-import-safety.mjs` | `SUMMARY checks=5 passed=5 failed=0` | 0 |
| 10 | `cd server && npm run test:web:e2e` | same 9 checks as #4, all PASS, ten pages re-saved | 0 |
| 11 | `cd server && npm run typecheck` | `tsc --noEmit`, no diagnostics | 0 |
| 12 | `python …/ledger-rows-gate.py` | `CHECK ledger-rows-unchanged PASS rows=64 sha=ef6d2b651e853b8e expected=ef6d2b651e853b8e` | 0 |
| 13 | `python …/docgates.py --tree <WT> fu3-no-internal-path` | `CHECK fu3-no-internal-path PASS 12 delivered documents carry no vendor machine path` | 0 |
| 14 | `cd server && node scripts/proofs/wu4/i18n-parity.mjs` | `SUMMARY checks=8 passed=8 failed=0 default_locale=th locales=th,en` | 0 |
| 15 | `grep -inE 'USD\|THB\|…\|สั่งซื้อ'` over the two sales docs and the ledger, excluding the permitted "provided separately" phrasings | no output | 1 |
| 16 | `git diff --name-only \| grep -E '^modules/(auth-supabase\|payment\|tenant-context\|webhook-receiver)/'` | no output — the four vendored module trees are unmodified | 1 |
| 17 | `git -C D:/AI-Workspace/projects/modules-hub status --porcelain` | no output — the vendor hub is untouched | 0 |
| 18 | `netstat -ano \| grep LISTENING \| grep -E ':3003[ ,]'` | no output — nothing is listening on 3003 | 1 |

Additional readings taken for this report, not part of the acceptance list:

- `git diff --stat` over the 13 changed files: `269 insertions(+), 104 deletions(-)`.
- Baseline `ledger-rows-gate.py` before any edit: PASS, `rows=64 sha=ef6d2b651e853b8e` — the
  same digest as after, so the C-rows did not move.
- `scripts/house-swarm-7/setup.sh` and `server/scripts/proofs/fu/setup-dbcheck-proof.mjs`
  diffs are shown in §3 in full; each is a two-line comment change.
- `git status --short server/scripts/proofs/wu4/wu4-e2e/` lists exactly
  `M app-th.html` and `M index-th.html`.

**On command #4's key.** `OPENAI_API_KEY=proof-fixture-key` is a fixture, not a credential;
the harness prints that it removes the three provider key variables from its own process
before deciding the branch (`branch=no-provider-configured`), so no provider call was made and
no key value was read, printed or compared.

---

## 7. What this lane deliberately did not do

1. **The seven §9a vendored documents** (`modules/auth-supabase/DESIGN.md`,
   `modules/auth-supabase/.agy-design-prompt.txt`, `modules/payment/DESIGN.md`,
   `modules/payment/.agy-prompt.md`, `modules/rate-limit/DESIGN.md`,
   `modules/tenant-context/agy-prompt.md`, `modules/webhook-receiver/DESIGN.md`) still carry the
   vendor's own paths. They were **not** in the controller's ruling, and §9a records why
   editing them would falsify the provenance records. They are the only machine-path hits left.
2. **No executable line changed.** The only two code files touched
   (`scripts/house-swarm-7/setup.sh`, `server/scripts/proofs/fu/setup-dbcheck-proof.mjs`) were
   changed inside comments, and #5 above exercises setup.sh end to end — nine cases, all pass —
   so the comment change is shown not to have disturbed the behaviour it documents.
3. **No claim row moved** (#12), **no price/licence/currency/purchase text was added** (#15),
   **no English sentence changed meaning** (§2 — every English half is byte-identical in the
   diffs), **no vendored document or vendor hub was written to** (#16, #17).
4. **No commit, no push, no deploy, no host contact**, no new dependency. Nothing was started
   that needed stopping: the e2e harness binds an ephemeral port and the check in #18 confirms
   port 3003 is free.

**A note for the commander on one judgement call.** The report requirement "the old and new
Thai wording for each changed line" is met with the *new* wording written literally and the
*old* wording written as the marked token `<STRING>` above, with the codepoints given once in
§1 and the sweep commands in §5 building it from those codepoints. The alternative — printing
the old string 45 times in this file — would make this unit's own sweep 1 non-empty as soon as
the report is tracked. If the controller prefers the literal in the report, the substitution is
mechanical: `<STRING>` and `$S` both stand for the 9-codepoint sequence
`U+0E40 U+0E23 U+0E14 U+0E34 U+0E2A U+0E17 U+0E2D U+0E23 U+0E35`, which is what
`git show HEAD:<file>` prints on every line listed in §2.

---

## 8. Thai summary — สรุปภาษาไทย

ผู้คุมวินิจฉัยเมื่อ 2026-09-29 สองข้อ งานนี้ทำครบทั้งสองข้อ และวัดขนาดจริงได้ 45 จุดใน 11 ไฟล์
(ไม่ใช่ 4 จุด ตามที่ประเมินตอนวินิจฉัย)

- **① คำทับศัพท์ "repository"** ถูกแก้หมดทุกไฟล์ที่ผู้ซื้อได้รับ ใช้สองคำคือ `ที่เก็บโค้ด` ในประโยค
  ที่พูดถึงชุดโค้ดที่ส่งมอบ และ `รีโป` ในประโยคที่ `git` เป็นประธาน โดยไม่แก้ความหมายของประโยค
  และไม่ลบประโยคใดทิ้ง ครึ่งภาษาอังกฤษของทุกบรรทัดสองภาษาไม่ถูกแก้
- สองไฟล์ HTML หลักฐาน UI **ไม่ได้แก้ด้วยมือ** แต่สร้างใหม่จาก `web/assets/i18n.js` ผ่าน
  e2e harness และยืนยันว่ามีคำใหม่จริง
- **② พาธเครื่องในคอมเมนต์ตัวอย่าง** ของ `setup.sh` กับ `setup-dbcheck-proof.mjs` ถูกแทนด้วย
  `/d/path/to/project/...` และ `D:\d\path\to\project\...\db-check.mjs` โดยยังคงอธิบายกับดักพาธเดิม
  ครบถ้วน (รูปทรงของความผิดพลาดยังเห็นได้) ไม่ได้แก้โค้ดที่รันแม้แต่บรรทัดเดียว
- **③ บันทึก** §9b เปลี่ยนจาก "ยังไม่แก้ รอผู้คุมตัดสิน" เป็นบันทึกว่าวินิจฉัยแล้วและทำแล้ว
  §9a คงเดิม (ไม่อยู่ในคำวินิจฉัย) ส่วน §8 ข้อ 6 ยังคงถูกต้องจึงไม่แก้
- แถวคำกล่าวอ้าง C1–C64 **ไม่ขยับแม้แต่ไบต์เดียว** พิสูจน์ด้วย gate (rows=64, sha เดิม)
- คำสั่งตรวจทั้งหมดผ่าน: e2e 9/9, setup-dbcheck 9/9, manual-claims 13/13, claims-check 8/8,
  fixtures 9/9, import-safety 5/5, typecheck 0, i18n-parity 8/8
- พาธเครื่องที่เหลือมีเฉพาะเจ็ดไฟล์ใน §9a ซึ่งอยู่นอกคำวินิจฉัย และไม่มีการ commit/push/deploy
  ไม่มี dependency ใหม่ ไม่มีพอร์ต 3003 ค้าง
