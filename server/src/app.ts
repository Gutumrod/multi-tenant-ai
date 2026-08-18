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

  app.use(express.json());

  // Health check endpoint (public, does not require tenant context)
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Stripe webhook endpoint (public / not tenant-gated, Stripe sends raw payloads without tenant headers)
  // Note: In production, Stripe signature verification requires access to the raw request buffer.
  // We mount express.raw middleware scoped specifically to this route.
  app.post(
    '/payment/webhook',
    express.raw({ type: 'application/json' }),
    paymentWebhookHandler
  );

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
