import express from 'express';
import { tenantMiddleware } from './middleware/tenant.js';
import { authMiddleware } from './middleware/auth.js';
import { aiDemoHandler } from './routes/ai-demo.js';
import {
  subscribeHandler,
  subscriptionStatusHandler,
} from './routes/subscription-demo.js';
import {
  demoChargeHandler,
  paymentWebhookHandler,
} from './routes/payment-demo.js';

export function createApp(): express.Express {
  const app = express();

  // Stripe webhook endpoint must mount BEFORE the global express.json() so the
  // scoped express.raw() below can receive the raw request buffer for signature
  // verification. If json() runs first it consumes/parses the body and rawBody
  // is empty, breaking HMAC verification.
  app.post(
    '/payment/webhook',
    express.raw({ type: 'application/json' }),
    paymentWebhookHandler
  );

  app.use(express.json());

  // Health check endpoint (public, does not require tenant context)
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Apply tenant middleware to all subsequent routes
  app.use(tenantMiddleware);

  // Tenant-gated verification endpoint
  app.get('/whoami', (req, res) => {
    res.json(req.tenantContext);
  });

  // Tenant and auth gated user profile endpoint
  app.get('/me', authMiddleware, (req, res) => {
    res.json({
      tenant: req.tenantContext,
      auth: req.authContext,
    });
  });

  // Tenant and auth gated AI demo endpoint with circuit breaker & tracing
  app.post('/ai/demo', authMiddleware, aiDemoHandler);

  // Tenant and auth gated Subscription endpoints
  app.post('/subscription/subscribe', authMiddleware, subscribeHandler);
  app.get('/subscription/status', authMiddleware, subscriptionStatusHandler);

  // Tenant and auth gated Payment demo charge endpoint
  app.post('/payment/demo-charge', authMiddleware, demoChargeHandler);

  return app;
}
