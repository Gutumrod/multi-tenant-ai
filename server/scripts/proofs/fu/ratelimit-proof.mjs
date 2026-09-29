#!/usr/bin/env node
/**
 * SUPERSEDED — this harness asserted the limiter ordering that lane MT01-PRESALE-P3A
 * deliberately replaced, so it is retired here rather than kept green by deleting the
 * assertions that gave it its value.
 *
 * WHAT IT USED TO PROVE, and why that is no longer true. It drove the real app over real
 * HTTP and proved, by construction, that the limiter ran **ahead of** signature
 * verification: requests of identical shape answered 401 while the bucket had room and
 * 429 once it did not, and not one post-limit request carried the signature-path code.
 * That property was the design of lane H7-FU-RATELIMIT. Lane P3A reversed it on purpose
 * (review finding LOW-2): the limiter now sits **after** `express.raw()` and verifies the
 * delivery's signature itself, so that only requests whose signature is WRONG are charged
 * to a per-source bucket and a correctly-signed delivery can never be refused because of
 * an outsider's flood. A flood therefore DOES cost HMAC work, bounded by a coarse
 * every-request backstop. Kept unchanged, this harness reported
 * `SUMMARY checks=5 passed=2 failed=3`, and the failure was the correct behaviour of the
 * new design rather than a regression.
 *
 * WHY A STUB RATHER THAN DELETION. Two reasons, both about a reader or a script that
 * arrives here without the history:
 *
 *   * a deleted file gives `Cannot find module` (node exit 1, or 127 from a shell) with no
 *     explanation, which reads as a broken tree; this stub exits 0 and says what happened;
 *   * four documents cite this path by name — `docs/house-swarm-7/FU-RATELIMIT.md`,
 *     `WU6-CLAIMS-EVIDENCE.md` (row C60), `FU-REVIEW-FIX-5.md` — so the path must keep
 *     resolving to something that explains itself.
 *
 * THE CURRENT PROOF is `server/scripts/proofs/fu/ratelimit-flood-proof.mjs` (7 checks). It
 * covers the same route over the same real HTTP path and reports the observation this
 * harness could no longer make: a forged-signature flood is refused
 * (`forged_requests_sent=6 accepted=3 refused=3`) and the correctly-signed delivery that
 * follows is answered 200 by the handler, not refused by the limiter.
 *
 * Nothing is started, no port is bound, no database is opened, no host is contacted and no
 * credential is read: this file only prints a summary line and exits.
 */

const REPLACEMENT = 'server/scripts/proofs/fu/ratelimit-flood-proof.mjs';

console.log(
  'SUPERSEDED: ratelimit-proof.mjs asserted the limiter ran BEFORE signature verification, ' +
    'so that a flood cost no HMAC work. Lane MT01-PRESALE-P3A replaced that ordering (review ' +
    'finding LOW-2): the limiter now runs AFTER express.raw() and verifies the signature ' +
    'itself, charging only wrong-signature requests to a per-source bucket, so a ' +
    'correctly-signed delivery is never refused because of a flood. Run the current proof ' +
    `instead: node ${REPLACEMENT}`
);
console.log(`SUMMARY superseded=true replacement=${REPLACEMENT} checks=0 passed=0 failed=0`);
process.exit(0);
