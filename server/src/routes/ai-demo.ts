import type { Request, Response } from 'express';
import {
  OpenAIProvider,
  AnthropicProvider,
} from '../../../modules/ai-provider/index.js';
import { CircuitBreakerError } from '../../../modules/enterprise-features/index.js';
import { tracer, aiCircuitBreaker, getConfiguredProvider } from '../lib/ai.js';

export const aiDemoHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing or invalid prompt in request body' });
    return;
  }

  const provider = getConfiguredProvider();
  if (!provider) {
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
    res.json(result);
  } catch (error: unknown) {
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
