import type { Request, Response } from 'express';
import {
  OpenAIProvider,
  AnthropicProvider,
} from '../../../modules/ai-provider/index.js';
import { CircuitBreakerError } from '../../../modules/enterprise-features/index.js';
import { tracer, aiCircuitBreaker, getConfiguredProvider } from '../lib/ai.js';
import { quotaGate, quotaRefusalResponse } from '../lib/quota.js';
import { AI_REQUESTS_PER_MONTH } from '../lib/subscriptions.js';

export const aiDemoHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing or invalid prompt in request body' });
    return;
  }

  const accountId = req.tenantContext?.tenantId;
  if (!accountId) {
    res.status(400).json({ error: 'Missing tenant context' });
    return;
  }

  // Quota gate: an AI completion is a paid resource, so the entitlement is
  // checked and the unit consumed BEFORE the provider is even resolved. A
  // refusal never reaches getConfiguredProvider()/generateText().
  const quota = await quotaGate.assertAndConsumeQuota({
    accountId,
    featureKey: AI_REQUESTS_PER_MONTH,
  });
  if (!quota.allowed) {
    const refusal = quotaRefusalResponse(quota);
    res.status(refusal.status).json(refusal.body);
    return;
  }

  const provider = getConfiguredProvider();
  if (!provider) {
    // Nothing was served, so give the consumed unit back: quota is only burned
    // by requests that actually reach the paid provider.
    await quotaGate.releaseQuota({ accountId, featureKey: AI_REQUESTS_PER_MONTH });
    res.status(503).json({
      error:
        'No AI provider configured on this server instance (set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY)',
    });
    return;
  }

  const providerName =
    provider instanceof OpenAIProvider
      ? 'openai'
      : provider instanceof AnthropicProvider
      ? 'anthropic'
      : 'gemini';

  const span = tracer.startSpan('ai.generateText');
  span.setAttribute('provider', providerName);

  try {
    const result = await aiCircuitBreaker.execute(() =>
      provider.generateText({ prompt })
    );

    if (result.success === false) {
      // The provider call failed (possibly through the circuit breaker without
      // throwing): release the consumed unit so an error never burns quota.
      await quotaGate.releaseQuota({ accountId, featureKey: AI_REQUESTS_PER_MONTH });
    }

    // Existing fields are preserved; `usage` is the consumed quota counter and
    // `limit` the plan limit for this feature. The provider's own token usage is
    // preserved under `tokenUsage` because `usage` is now the quota counter.
    res.json({
      ...result,
      usage: quota.usage,
      limit: quota.limit,
      ...(result.usage ? { tokenUsage: result.usage } : {}),
    });
  } catch (error: unknown) {
    await quotaGate.releaseQuota({ accountId, featureKey: AI_REQUESTS_PER_MONTH });
    if (error instanceof CircuitBreakerError) {
      res
        .status(503)
        .json({ error: 'AI provider circuit is open, try again shortly' });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: message });
  } finally {
    span.end();
  }
};
