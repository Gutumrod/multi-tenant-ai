import {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
} from '../../../modules/ai-provider/index.js';
import {
  CircuitBreaker,
  MemoryTracer,
} from '../../../modules/enterprise-features/index.js';

export const tracer = new MemoryTracer();

export const aiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 30000,
});

export function getConfiguredProvider():
  | OpenAIProvider
  | AnthropicProvider
  | GeminiProvider
  | null {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY });
  }
  return null;
}
