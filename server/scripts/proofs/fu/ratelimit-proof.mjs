#!/usr/bin/env node
/**
 * H7-FU-RATELIMIT proof harness (standalone Node ESM).
 *
 * Drives the REAL express app (`server/src/app.ts`) over REAL HTTP against a
 * REAL port (an ephemeral one, bound to 127.0.0.1), and prints one line per
 * observation. Nothing here is mocked except the clock-free environment: the
 * limiter, the middleware chain, `express.raw()` and the webhook handler are the
 * production ones, mounted in the production order.
 *
 * What it shows, in order:
 *
 *   1. requests 1..limit are ACCEPTED — that is, the limiter let them through.
 *      The status they then get from the handler is reported as-is: this harness
 *      is about the limiter, not about the signature. Every one of those
 *      requests is sent WITHOUT a signature, so the handler answers
 *      401 WEBHOOK_MISSING_SIGNATURE, which is itself the evidence that the
 *      request reached the signature-verification path.
 *   2. the next request is REFUSED with 429 and the code `RATE_LIMITED`.
 *   3. the refusal carries a `Retry-After` header, and the value is numeric.
 *      The actual header value is printed verbatim, together with the module's
 *      `retryAfterMs` so the two can be compared by eye.
 *   4. NO request after the limit reached the signature path. This is proven,
 *      not asserted: the requests that are refused are byte-for-byte the same
 *      shape as the requests that were accepted (same headers, same unsigned
 *      body), so the only thing that differs is the bucket's state. If
 *      verification ran first, those requests would answer 401 exactly like the
 *      accepted ones did. They answer 429 instead, and the harness checks that
 *      NOT ONE of the post-limit requests carries the signature-path code.
 *      A signed request is interleaved inside the limit as a control, so
 *      "signature verification works here" is also observed rather than assumed.
 *
 * Safety: it binds to 127.0.0.1 and speaks to nothing else; it makes no network
 * request to any other host; it reads no credential (the Stripe values it sets
 * for itself are non-secret placeholders, defined in this file, and are never
 * printed). It exits non-zero if any check fails.
 *
 * Usage:  cd server && node scripts/proofs/fu/ratelimit-proof.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { tsImport } from 'tsx/esm/api';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');

/** The limit this run uses. Small, so the output stays readable. */
const LIMIT = 5;
const WINDOW_MS = 60_000;

const SECRET = 'whsec_h7fulimit_proof_placeholder_secret';
const PLACEHOLDER_KEY = 'sk_test_fake_placeholder';

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function observation(line) {
  console.log(`OBSERVATION ${line}`);
}

/** The exact `stripe-signature` header the real verifier accepts. */
function stripeSignature(body, timestamp) {
  const sig = crypto.createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

let eventSeq = 0;

function makeEvent() {
  eventSeq += 1;
  return JSON.stringify({
    id: `evt_h7fulimitproof_${Date.now()}_${eventSeq}`,
    type: 'invoice.paid',
    data: {
      object: {
        id: `pi_h7fulimitproof_${eventSeq}`,
        amount: 500,
        currency: 'usd',
        status: 'succeeded',
      },
    },
  });
}

/** True when the response body is the signature path's 401, not the limiter's 429. */
function signaturePathCode(body) {
  if (body && typeof body === 'object') {
    if (body.code === 'WEBHOOK_MISSING_SIGNATURE') return 'WEBHOOK_MISSING_SIGNATURE';
    if (body.code === 'RATE_LIMITED') return 'RATE_LIMITED';
    return String(body.code ?? body.error ?? '(no code)');
  }
  return '(non-json body)';
}

async function main() {
  // The environment the real app reads. Set BEFORE the app module is imported,
  // because server/src/lib/rate-limit.ts resolves its settings at import time.
  process.env.WEBHOOK_RATE_LIMIT_MAX = String(LIMIT);
  process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS = String(WINDOW_MS);
  process.env.STRIPE_SECRET_KEY = PLACEHOLDER_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  // Hermetic: no database, so the in-memory repositories are used and nothing is
  // persisted. This harness reads and writes no database at all.
  delete process.env.DATABASE_URL;
  delete process.env.DEMO_AUTH;

  const { createApp } = await tsImport(
    pathToFileURL(join(SERVER_DIR, 'src/app.ts')).href,
    import.meta.url
  );

  const app = createApp();
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  observation(
    `express app from src/app.ts listening on an ephemeral port bound to 127.0.0.1 (port ${server.address().port})`
  );
  observation(`limit=${LIMIT} windowMs=${WINDOW_MS} key="route:POST /payment/webhook"`);

  /** One real HTTP POST. `signed` selects whether a valid signature is attached. */
  async function postWebhook(signed) {
    const body = makeEvent();
    const headers = { 'content-type': 'application/json' };
    if (signed) headers['stripe-signature'] = stripeSignature(body, Math.floor(Date.now() / 1000));
    const response = await fetch(`${baseUrl}/payment/webhook`, { method: 'POST', headers, body });
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* report the raw text rather than hide a non-JSON body */
    }
    return {
      status: response.status,
      retryAfter: response.headers.get('retry-after'),
      code: signaturePathCode(parsed),
      body: parsed,
    };
  }

  try {
    // --- 1. requests 1..limit are accepted (not rate limited) ---------------
    // The FIRST request inside the limit carries a VALID signature so the
    // signature path is observed working on this route (200). The rest of the
    // window is spent with unsigned requests, which the handler answers from
    // the signature path (401 WEBHOOK_MISSING_SIGNATURE) — that 401 is what
    // proves an accepted request really reached verification.
    const accepted = [];
    for (let i = 1; i <= LIMIT; i += 1) {
      const signed = i === 1;
      const observed = await postWebhook(signed);
      accepted.push(observed);
      observation(
        `request ${i}/${LIMIT} (${signed ? 'valid signature' : 'no signature'}, inside the limit) -> HTTP ${observed.status} code=${observed.code} retry_after=${observed.retryAfter === null ? '(absent)' : `"${observed.retryAfter}"`}`
      );
    }

    const acceptedNotLimited = accepted.filter((r) => r.status !== 429);
    const acceptedReachedSignature = accepted.filter((r) => r.status === 401);

    record(
      'requests-up-to-the-limit-are-accepted',
      acceptedNotLimited.length === LIMIT,
      `statuses=[${accepted.map((r) => r.status).join(',')}] none_rate_limited=${acceptedNotLimited.length === LIMIT} codes=[${accepted.map((r) => r.code).join(',')}]`
    );

    // The signed control, observed INSIDE the window, is the evidence that
    // "reached the signature path" is a live observation on this route rather
    // than an assumption: a valid signature is answered 200, an absent one 401.
    const signedControl = accepted[0];
    record(
      'signed-request-is-verified-on-this-route',
      signedControl.status === 200 && acceptedReachedSignature.length === LIMIT - 1,
      `signed_control_status=${signedControl.status} (200 = the real verifier accepted it) unsigned_inside_limit_statuses=[${accepted.slice(1).map((r) => r.status).join(',')}] reached_signature_path=${acceptedReachedSignature.length}/${LIMIT - 1} codes=[${accepted.slice(1).map((r) => r.code).join(',')}]`
    );

    // --- 2. the next request is refused with 429 RATE_LIMITED --------------
    const refused = await postWebhook(false);
    observation(
      `first request OVER the limit (same unsigned shape as the accepted ones) -> HTTP ${refused.status} code=${refused.code}`
    );
    record(
      'next-request-is-refused-with-429-rate-limited',
      refused.status === 429 && refused.code === 'RATE_LIMITED',
      `http_status=${refused.status} code=${refused.code} limit=${refused.body?.limit} windowMs=${refused.body?.windowMs} remaining=${refused.body?.remaining} resetAt=${refused.body?.resetAt}`
    );

    // --- 3. the refusal carries a numeric Retry-After header ---------------
    const retryAfter = refused.retryAfter;
    const numeric = retryAfter !== null && /^\d+$/.test(retryAfter) && Number(retryAfter) >= 1;
    const derived = Number.isFinite(refused.body?.retryAfterMs)
      ? Math.max(1, Math.ceil(refused.body.retryAfterMs / 1000))
      : null;
    observation(
      `Retry-After header on the refusal = ${retryAfter === null ? '(absent)' : `"${retryAfter}"`} (numeric=${numeric}, from retryAfterMs=${refused.body?.retryAfterMs})`
    );
    record(
      'refusal-carries-retry-after-header',
      numeric,
      `retry_after_header=${retryAfter === null ? '(absent)' : `"${retryAfter}"`} is_numeric=${retryAfter !== null && /^\d+$/.test(retryAfter)} seconds_ge_1=${Number(retryAfter) >= 1} derived_from_retryAfterMs=${derived} matches=${derived === Number(retryAfter)}`
    );

    // --- 4. no request after the limit reached the signature path ----------
    const afterLimit = [refused];
    for (let i = 0; i < 3; i += 1) {
      const observed = await postWebhook(false);
      afterLimit.push(observed);
      observation(
        `further request over the limit (no signature, identical shape to an accepted one) -> HTTP ${observed.status} code=${observed.code}`
      );
    }

    const reachedSignatureAfterLimit = afterLimit.filter(
      (r) => r.code === 'WEBHOOK_MISSING_SIGNATURE' || r.status === 401
    );
    const allRateLimitedAfterLimit = afterLimit.every(
      (r) => r.status === 429 && r.code === 'RATE_LIMITED'
    );

    record(
      'no-request-after-the-limit-reached-the-signature-path',
      allRateLimitedAfterLimit && reachedSignatureAfterLimit.length === 0,
      `post_limit_requests=${afterLimit.length} statuses=[${afterLimit.map((r) => r.status).join(',')}] codes=[${afterLimit.map((r) => r.code).join(',')}] reached_signature_path=${reachedSignatureAfterLimit.length} (each post-limit request is unsigned, exactly like the ${LIMIT} accepted ones — a 401 would prove verification ran first)`
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  const failed = results.filter((r) => !r.passed);
  console.log(
    `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length} limit=${LIMIT} windowMs=${WINDOW_MS} key="route:POST /payment/webhook"` +
      (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
  );
  if (failed.length > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.log(`CHECK harness FAIL unexpected_error=${error.message}`);
  process.exitCode = 1;
}
