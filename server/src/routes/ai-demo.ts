import type { Request, Response } from 'express';
import {
  OpenAIProvider,
  AnthropicProvider,
} from '../../../modules/ai-provider/index.js';
import { CircuitBreakerError } from '../../../modules/enterprise-features/index.js';
import { tracer, aiCircuitBreaker, getConfiguredProvider } from '../lib/ai.js';
import { quotaGate, quotaRefusalResponse } from '../lib/quota.js';
import { AI_REQUESTS_PER_MONTH } from '../lib/subscriptions.js';

const MAX_PROMPT_CHARS = 32_000;

export const aiDemoHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing or invalid prompt in request body' });
    return;
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    res.status(413).json({
      error: 'Prompt exceeds the maximum supported size',
      code: 'PROMPT_TOO_LARGE',
    });
    return;
  }

  const accountId = req.authorizedTenantId;
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
      // Provider-returned failure details are untrusted and may contain request,
      // upstream or credential-adjacent data. Release quota and return a stable,
      // sanitized application error instead of proxying the provider payload.
      const usage = await quotaGate.releaseQuota({
        accountId,
        featureKey: AI_REQUESTS_PER_MONTH,
      });
      res.status(502).json({
        error: 'AI provider request failed',
        code: 'AI_PROVIDER_REQUEST_FAILED',
        provider: providerName,
        usage,
        limit: quota.limit,
      });
      return;
    }

    // Existing success fields are preserved; `usage` is the consumed quota
    // counter and `limit` the plan limit for this feature.
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
    res.status(502).json({
      error: 'AI provider request failed',
      code: 'AI_PROVIDER_REQUEST_FAILED',
    });
  } finally {
    span.end();
  }
};
