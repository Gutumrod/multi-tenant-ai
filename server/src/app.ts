import express from 'express';
import { tenantMiddleware } from './middleware/tenant.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantAuthorizationMiddleware } from './middleware/tenant-authorization.js';
import { aiDemoHandler } from './routes/ai-demo.js';
import {
  subscribeHandler,
  subscriptionStatusHandler,
} from './routes/subscription-demo.js';
import {
  demoChargeHandler,
  paymentWebhookHandler,
} from './routes/payment-demo.js';
import { webhookRateLimitMiddleware } from './lib/rate-limit.js';
import {
  createDemoAuthMiddleware,
  demoAuthRefusalMessage,
  demoAuthState,
  refusedDemoAuthMiddleware,
} from './middleware/demo-auth.js';
import {
  PAGE_ROUTES,
  WEB_ROOT,
  listPlansForUi,
  renderPage,
  requestLocale,
} from './lib/web-pages.js';
import { join } from 'node:path';

const JSON_BODY_LIMIT = '64kb';
const WEBHOOK_BODY_LIMIT = '256kb';

export function createApp(): express.Express {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Stripe webhook endpoint must mount BEFORE the global express.json() so the
  // scoped express.raw() below can receive the raw request buffer for signature
  // verification. If json() runs first it consumes/parses the body and rawBody
  // is empty, breaking HMAC verification.
  //
  // ORDERING (H7-FU-RATELIMIT; re-ordered by MT01-PRESALE-P3A for review finding
  // LOW-2): webhookRateLimitMiddleware runs AFTER express.raw() and BEFORE the
  // handler. It needs the raw body, because it verifies the delivery's signature
  // itself in order to charge only the requests whose signature is WRONG to a
  // per-source bucket — a correctly-signed delivery is therefore never counted
  // into a bucket an attacker can fill, and cannot be refused because of one.
  // The limiter neither alters nor re-parses the body, so the raw buffer the
  // handler's own verification needs is exactly the one express.raw() produced.
  //
  // What the reorder costs, stated plainly: the previous order refused a flood
  // before spending HMAC work, and this one spends HMAC work on whatever reaches
  // the middleware. That is bounded by a coarse every-request backstop inside the
  // middleware, and it is the deliberate trade — bounded real work in exchange
  // for never refusing a real payment delivery. See server/src/lib/rate-limit.ts
  // for the keys, the variables, the residual and the failure modes.
  //
  // The limiter is deliberately not mounted on any other route — the paid routes
  // are quota-gated elsewhere and keep their existing behaviour.
  app.post(
    '/payment/webhook',
    express.raw({ type: 'application/json', limit: WEBHOOK_BODY_LIMIT }),
    webhookRateLimitMiddleware,
    paymentWebhookHandler
  );

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Health check endpoint (public, does not require tenant context)
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // HOUSE-SWARM-7 WU-4 sample UI (web/). Mounted here — after the webhook
  // raw-body mount and before tenantMiddleware — because these are public
  // read-only page/asset routes: a browser loading a page sends no
  // x-tenant-id header, so they must not sit behind the tenant middleware.
  // Every path below is disjoint from every API path registered in this file,
  // so no existing route is shadowed and the API's behaviour is unchanged.
  // ---------------------------------------------------------------------------
  app.use('/assets', express.static(join(WEB_ROOT, 'assets'), { index: false }));

  // The page route map: /plans and /app (and their .html spellings) resolve to
  // the page files; the shell is rendered server-side for ?lang=.
  for (const route of PAGE_ROUTES) {
    app.get(route.urlPath, (req, res) => {
      try {
        res
          .type('html')
          .send(renderPage(route.file, requestLocale(req.query)));
      } catch (_error: unknown) {
        res.status(500).json({
          error: 'Sample UI page could not be rendered',
          code: 'UI_PAGE_RENDER_FAILED',
        });
      }
    });
  }

  // Public, read-only plan catalogue for the sample UI (the "choose a plan"
  // screen). It exposes plan id/name/price/entitlements only — no tenant data,
  // no credentials — and reads the same plan repository the entitlement engine
  // resolves limits from, so the numbers shown cannot drift from what the paid
  // routes enforce.
  app.get('/ui/plans.json', async (_req, res) => {
    try {
      res.json({ plans: await listPlansForUi() });
    } catch (error: unknown) {
      res.status(503).json({
        error: 'Plan catalogue is unavailable on this server instance',
        code: 'PLAN_CATALOGUE_UNAVAILABLE',
      });
    }
  });

  // Apply tenant middleware to all subsequent routes
  app.use(tenantMiddleware);

  // Tenant-gated verification endpoint
  app.get('/whoami', (req, res) => {
    res.json(req.tenantContext);
  });

  // ---------------------------------------------------------------------------
  // Identity for the paid routes.
  //
  // DEMO_AUTH is OFF by default: `demoAuthState()` reports { active: false } and
  // this is literally the original `authMiddleware`, so the real auth path is
  // unchanged. When DEMO_AUTH=true the demonstration identity middleware is
  // mounted in its place (it refuses to activate under NODE_ENV=production, in
  // which case the refusal middleware answers 503 instead), and the real
  // authMiddleware is NOT mounted on these routes — so a demo identity can never
  // travel down the real auth path and vice versa.
  // ---------------------------------------------------------------------------
  const demoAuth = demoAuthState();
  const paidRoutesAuth = demoAuth.active
    ? createDemoAuthMiddleware(demoAuth)
    : demoAuth.refusal === 'production'
      ? refusedDemoAuthMiddleware
      : authMiddleware;

  if (demoAuth.requested) {
    const refusalMessage = demoAuthRefusalMessage(demoAuth);
    if (refusalMessage) {
      console.error(refusalMessage);
    } else {
      console.warn(
        '[demo-auth] DEMO_AUTH=true: demonstration identity gate mounted on the paid routes. ' +
          'This is a demonstration mode and NOT authentication.'
      );
    }
  }

  // Tenant and auth gated user profile endpoint
  app.get('/me', paidRoutesAuth, tenantAuthorizationMiddleware, (req, res) => {
    res.json({
      tenant: req.tenantContext,
      auth: req.authContext,
    });
  });

  // Tenant and auth gated AI demo endpoint with circuit breaker & tracing
  app.post('/ai/demo', paidRoutesAuth, tenantAuthorizationMiddleware, aiDemoHandler);

  // Tenant and auth gated Subscription endpoints
  app.post('/subscription/subscribe', paidRoutesAuth, tenantAuthorizationMiddleware, subscribeHandler);
  app.get('/subscription/status', paidRoutesAuth, tenantAuthorizationMiddleware, subscriptionStatusHandler);

  // Tenant and auth gated Payment demo charge endpoint
  app.post('/payment/demo-charge', paidRoutesAuth, tenantAuthorizationMiddleware, demoChargeHandler);

  // Final fail-closed HTTP error boundary. In particular, do not let body-parser
  // syntax/size errors fall through to Express' HTML/stack-style default response.
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const bodyError = error as { type?: string; status?: number };
    if (bodyError?.type === 'entity.too.large' || bodyError?.status === 413) {
      res.status(413).json({
        error: 'Request body too large',
        code: 'REQUEST_BODY_TOO_LARGE',
      });
      return;
    }

    if (bodyError?.type === 'entity.parse.failed') {
      res.status(400).json({
        error: 'Invalid JSON request body',
        code: 'INVALID_JSON',
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}
