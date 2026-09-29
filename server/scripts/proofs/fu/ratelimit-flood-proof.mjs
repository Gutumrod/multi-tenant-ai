#!/usr/bin/env node
/**
 * MT01-PRESALE-P3A flood proof harness (standalone Node ESM).
 *
 * THE OWNER'S ACCEPTANCE TEST, as an executable proof:
 *
 *   ยิง flood ลายเซ็นผิด แล้ว webhook ลายเซ็นถูกยังผ่าน
 *   (flood the endpoint with WRONG signatures, then a correctly-signed webhook
 *    must still pass)
 *
 * It drives the REAL express app (`server/src/app.ts`) over REAL HTTP against a
 * REAL ephemeral port bound to 127.0.0.1. Nothing is mocked: the limiter, the
 * middleware chain, `express.raw()`, the signature verification and the webhook
 * handler are the production ones, mounted in the production order
 * (`express.raw()` -> `webhookRateLimitMiddleware` -> `paymentWebhookHandler`).
 *
 * What it shows, in order:
 *
 *   1. FLOOD — a burst of requests carrying FORGED signatures (well-formed
 *      `t=…,v1=<wrong hmac>`, the shape an attacker can produce) is sent from one
 *      source. The harness reports how many were SENT, how many the limiter
 *      ACCEPTED and how many it REFUSED, and it requires at least one refusal:
 *      a limiter that never refuses is not a fix, and the flood has to be charged
 *      somewhere for the per-source rule to mean anything.
 *   2. SIGNED — with that source's forged-signature allowance already exhausted,
 *      a correctly-signed delivery is sent. It must NOT be refused: it is not
 *      charged to any per-source bucket, so the flood cannot spend its way into
 *      the real delivery path. The status the handler gave it is reported.
 *      A SECOND correctly-signed delivery is sent, so the first is not a
 *      one-shot exemption, and a forged request is sent AFTER them, so the
 *      "passed" answer was not bought by turning the limiter off.
 *   3. PER-SOURCE — a second, genuinely distinct source (`[::1]`: the same app on
 *      the same port, reached over a second loopback address, so the kernel
 *      reports a different `req.socket.remoteAddress`) is flooded until IT is
 *      refused, and the harness checks the two refusals name two different
 *      buckets. One source's flood does not consume another's allowance.
 *
 * The acceptance scenario in the test suite
 * (`webhook-forged-flood-does-not-refuse-a-signed-delivery`) proves the same
 * property from inside vitest; this harness proves it from outside, as a
 * standalone process with a real exit code.
 *
 * Safety: it binds to 127.0.0.1 (the second listener to ::1) and speaks to
 * nothing else; it makes no network request to any other host; it opens no
 * database (`DATABASE_URL` is deleted before the app is imported, so the
 * in-memory repositories are used); it reads no credential — the Stripe values
 * it sets for itself are non-secret placeholders defined in this file, and no
 * secret is ever printed. A real secret is never required, because the harness
 * SIGNS ITS OWN deliveries with the placeholder the app was given.
 *
 * Usage:  cd server && node scripts/proofs/fu/ratelimit-flood-proof.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { tsImport } from 'tsx/esm/api';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');

/**
 * Small, so a short flood is enough to exhaust a source's allowance and the
 * output stays readable. These are the values the app is booted with; they are
 * not the production defaults.
 */
const LIMIT = 3;
const BACKSTOP = 5_000;
const WINDOW_MS = 60_000;

/** How much of a window must be left before the run starts, so nothing straddles a boundary. */
const MIN_WINDOW_REMAINING_MS = 5_000;

/**
 * Non-secret placeholders, defined here and used only by this process. The
 * harness knows the webhook secret because IT sets it: that is what lets it
 * produce both a correctly-signed delivery and a forged one. Neither value is
 * printed, and neither is a credential for anything.
 */
const SECRET = 'whsec_mt01p3a_flood_proof_placeholder_secret';
const PLACEHOLDER_KEY = '«redacted:sk_test_…»';

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

/** A well-formed, WRONG signature: signed with the wrong key, the attacker's shape. */
function forgedSignature(body, timestamp) {
  const sig = crypto
    .createHmac('sha256', `${SECRET}-not-the-real-secret`)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

let eventSeq = 0;

function makeEvent() {
  eventSeq += 1;
  return JSON.stringify({
    id: `evt_mt01p3aflood_${Date.now()}_${eventSeq}`,
    type: 'invoice.paid',
    data: {
      object: {
        id: `pi_mt01p3aflood_${eventSeq}`,
        amount: 500,
        currency: 'usd',
        status: 'succeeded',
      },
    },
  });
}

/** A one-line label for whatever code the response body carries. */
function codeOf(body) {
  if (body && typeof body === 'object') {
    return String(body.code ?? body.error ?? '(no code)');
  }
  return '(non-json body)';
}

/**
 * Aligns to the start of the current fixed window and returns it, so the burst
 * cannot straddle a window rollover.
 *
 * The store gives every bucket the window `Math.floor(now / windowMs) *
 * windowMs` (`modules/rate-limit/adapters/memory-store.ts`), so the window rolls
 * over on the wall clock rather than starting with the first request. A rollover
 * mid-burst would reset the counter and make "accepted then refused" a statement
 * about the clock instead of about the allowance. If less than
 * `MIN_WINDOW_REMAINING_MS` of the window is left, the tail is waited out; the
 * wait is never a whole window.
 */
async function alignToWindowBoundary(windowMs) {
  let windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const remainingMs = windowStart + windowMs - Date.now();
  if (remainingMs < MIN_WINDOW_REMAINING_MS) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs + 5));
    windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  }
  return windowStart;
}

async function main() {
  // The environment the real app reads. Set BEFORE the app module is imported,
  // because server/src/lib/rate-limit.ts resolves its settings at import time.
  process.env.WEBHOOK_RATE_LIMIT_MAX = String(LIMIT);
  process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS = String(WINDOW_MS);
  process.env.WEBHOOK_RATE_LIMIT_BACKSTOP_MAX = String(BACKSTOP);
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
  // Bound to the IPv4 loopback ADDRESS, so the source address the limiter sees
  // is the literal `127.0.0.1` rather than the IPv4-mapped form a dual-stack
  // socket reports. Nothing is exposed beyond loopback.
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  /** The second source: the SAME app, the same port, a different loopback address. */
  let secondServer = null;
  let secondBaseUrl = null;
  try {
    secondServer = await new Promise((resolve, reject) => {
      const listener = app.listen(port, '::1', () => resolve(listener));
      listener.on('error', reject);
    });
    secondBaseUrl = `http://[::1]:${port}`;
  } catch (error) {
    observation(`second source could not be bound (${error.message}); the per-source check will report that`);
  }

  observation(
    `express app from src/app.ts listening on an ephemeral port bound to 127.0.0.1 (port ${port})`
  );
  observation(
    `limit=${LIMIT} backstop=${BACKSTOP} windowMs=${WINDOW_MS} order=express.raw() -> webhookRateLimitMiddleware -> paymentWebhookHandler`
  );
  if (secondBaseUrl) {
    observation(`second source bound on the SAME port at ::1 (${secondBaseUrl})`);
  }

  /**
   * One real HTTP POST. `signature` is passed through verbatim when supplied
   * (that is how the flood sends a WRONG one); `signed` computes a correct one.
   */
  async function postWebhook(targetBaseUrl, options = {}) {
    const body = options.body ?? makeEvent();
    const headers = { 'content-type': 'application/json' };
    if (options.signature !== undefined) {
      headers['stripe-signature'] = options.signature;
    } else if (options.signed) {
      headers['stripe-signature'] = stripeSignature(body, Math.floor(Date.now() / 1000));
    }
    const response = await fetch(`${targetBaseUrl}/payment/webhook`, {
      method: 'POST',
      headers,
      body,
    });
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
      code: codeOf(parsed),
      bucketKey: parsed && typeof parsed === 'object' ? parsed.details?.key ?? null : null,
      body: parsed,
    };
  }

  /** A forged POST against `targetBaseUrl`. */
  async function forgeAt(targetBaseUrl) {
    const body = makeEvent();
    return postWebhook(targetBaseUrl, {
      body,
      signature: forgedSignature(body, Math.floor(Date.now() / 1000)),
    });
  }

  try {
    const windowStart = await alignToWindowBoundary(WINDOW_MS);
    const windowIndex = Math.floor(windowStart / WINDOW_MS);
    observation(`aligned to the start of window ${windowIndex} at ${windowStart} before any request`);

    // -----------------------------------------------------------------------
    // 1. THE FLOOD — WRONG signatures from one source.
    // -----------------------------------------------------------------------
    const floodSent = [];
    let floodAccepted = 0;
    let floodRefused = 0;
    let firstRefusal = null;
    const MAX_FLOOD = LIMIT * 5;
    for (let i = 0; i < MAX_FLOOD && floodRefused < 3; i += 1) {
      const observed = await forgeAt(baseUrl);
      floodSent.push(observed);
      if (observed.status === 429) {
        floodRefused += 1;
        if (firstRefusal === null) firstRefusal = observed;
      } else {
        floodAccepted += 1;
      }
    }

    const floodStatuses = floodSent.map((r) => r.status).join(',');
    record(
      'flood-with-wrong-signatures-is-refused-once-over-its-allowance',
      floodRefused >= 1 && floodAccepted >= LIMIT,
      `forged_requests_sent=${floodSent.length} accepted=${floodAccepted} refused=${floodRefused} limit=${LIMIT} statuses=[${floodStatuses}] first_refusal_status=${firstRefusal ? firstRefusal.status : '(none)'} first_refusal_code=${firstRefusal ? firstRefusal.code : '(none)'} retry_after=${firstRefusal && firstRefusal.retryAfter !== null ? `"${firstRefusal.retryAfter}"` : '(absent)'}`
    );

    // -----------------------------------------------------------------------
    // 2. THE ACCEPTANCE — a correctly-signed delivery must still pass.
    // -----------------------------------------------------------------------
    const signedDelivery = await postWebhook(baseUrl, { signed: true });
    observation(
      `correctly-signed delivery, sent while the flood source's allowance is exhausted -> HTTP ${signedDelivery.status} code=${signedDelivery.code} retry_after=${signedDelivery.retryAfter === null ? '(absent)' : `"${signedDelivery.retryAfter}"`}`
    );
    record(
      'correctly-signed-delivery-is-not-refused-after-the-flood',
      signedDelivery.status !== 429 && signedDelivery.retryAfter === null,
      `signed_delivery_status=${signedDelivery.status} (200 = the handler accepted it; 429 would be the limiter refusing a real delivery) code=${signedDelivery.code} refused_by_limiter=${signedDelivery.status === 429} retry_after=${signedDelivery.retryAfter === null ? '(absent)' : `"${signedDelivery.retryAfter}"`}`
    );

    const secondSignedDelivery = await postWebhook(baseUrl, { signed: true });
    record(
      'signed-deliveries-keep-passing-not-a-one-shot-exemption',
      secondSignedDelivery.status !== 429,
      `first_signed_status=${signedDelivery.status} second_signed_status=${secondSignedDelivery.status} both_not_refused=${signedDelivery.status !== 429 && secondSignedDelivery.status !== 429}`
    );

    // -----------------------------------------------------------------------
    // 3. THE LIMITER IS STILL ARMED — the good delivery was not bought by
    //    turning the per-source limit off.
    // -----------------------------------------------------------------------
    const forgedAfterTheGoodDeliveries = await forgeAt(baseUrl);
    record(
      'forged-flood-is-still-refused-after-the-signed-deliveries',
      forgedAfterTheGoodDeliveries.status === 429,
      `forged_after_good_status=${forgedAfterTheGoodDeliveries.status} code=${forgedAfterTheGoodDeliveries.code} (429 = the limit is still armed, not disabled to make the delivery pass)`
    );

    // -----------------------------------------------------------------------
    // 4. PER-SOURCE — one source's flood does not spend another's allowance.
    // -----------------------------------------------------------------------
    if (secondBaseUrl === null) {
      record(
        'per-source-flood-does-not-consume-another-sources-allowance',
        false,
        'the second loopback listener could not be bound, so two genuinely distinct TCP sources could not be driven'
      );
    } else {
      const sourceBStatuses = [];
      let sourceBRefusal = null;
      for (let i = 0; i < LIMIT * 4 && sourceBRefusal === null; i += 1) {
        const observed = await forgeAt(secondBaseUrl);
        sourceBStatuses.push(observed.status);
        if (observed.status === 429) sourceBRefusal = observed;
      }

      const sourceAKey = firstRefusal ? firstRefusal.bucketKey : null;
      const sourceBKey = sourceBRefusal ? sourceBRefusal.bucketKey : null;
      observation(
        `source A (127.0.0.1) refusal bucket=${sourceAKey === null ? '(none)' : `"${sourceAKey}"`}; source B (::1) forged statuses=[${sourceBStatuses.join(',')}] refusal bucket=${sourceBKey === null ? '(none)' : `"${sourceBKey}"`}`
      );
      record(
        'per-source-flood-does-not-consume-another-sources-allowance',
        sourceBRefusal !== null &&
          sourceAKey !== null &&
          sourceBKey !== null &&
          sourceAKey !== sourceBKey &&
          sourceBStatuses.slice(0, LIMIT).every((status) => status !== 429),
        `source_b_forged_statuses=[${sourceBStatuses.join(',')}] source_b_first_refusal_status=${sourceBRefusal ? sourceBRefusal.status : '(none)'} source_b_refusal_bucket=${sourceBKey === null ? '(none)' : `"${sourceBKey}"`} source_a_refusal_bucket=${sourceAKey === null ? '(none)' : `"${sourceAKey}"`} buckets_differ=${sourceAKey !== null && sourceBKey !== null && sourceAKey !== sourceBKey} source_b_allowance_intact_for_first_${LIMIT}=${sourceBStatuses.slice(0, LIMIT).every((status) => status !== 429)}`
      );

      // A correctly-signed delivery passes from the source whose forged bucket
      // is exhausted, too: the per-source rule is not "one good delivery per
      // source per window".
      const signedFromA = await postWebhook(baseUrl, { signed: true });
      const signedFromB = await postWebhook(secondBaseUrl, { signed: true });
      record(
        'signed-delivery-passes-from-either-source-after-both-floods',
        signedFromA.status === 200 && signedFromB.status === 200,
        `signed_from_source_a_status=${signedFromA.status} signed_from_source_b_status=${signedFromB.status} both_200=${signedFromA.status === 200 && signedFromB.status === 200}`
      );
    }

    // The whole run stayed inside one window, so every "accepted then refused"
    // above is a statement about the allowance and not about the clock.
    const elapsedMs = Date.now() - windowStart;
    observation(
      `window_index_before=${windowIndex} window_index_after=${Math.floor(Date.now() / WINDOW_MS)} elapsedMs=${elapsedMs} windowMs=${WINDOW_MS}`
    );
    record(
      'the-run-stayed-inside-one-window-so-the-counting-is-not-a-rollover-artefact',
      Math.floor(Date.now() / WINDOW_MS) === windowIndex,
      `window_index_before=${windowIndex} window_index_after=${Math.floor(Date.now() / WINDOW_MS)} elapsedMs=${elapsedMs} windowMs=${WINDOW_MS} same_window=${Math.floor(Date.now() / WINDOW_MS) === windowIndex}`
    );
  } finally {
    // Stop what was started: every listener this harness bound is closed, so no
    // port is left listening when the process exits.
    if (secondServer !== null) {
      await new Promise((resolve, reject) => {
        secondServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  const failed = results.filter((r) => !r.passed);
  console.log(
    `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length} limit=${LIMIT} backstop=${BACKSTOP} windowMs=${WINDOW_MS}` +
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
