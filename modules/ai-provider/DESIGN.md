# AI Provider Module — DESIGN.md (v0.2.0)

**Version:** 0.2.0 (P2, Multi-Provider)
**Status:** Implemented module contract; buyer-facing source remains pre-release.
**Language / runtime:** TypeScript, ES2022, strict mode; uses standard Fetch APIs.

---

## 1. Purpose & Architectural Objectives

The **AI Provider Module** abstracts OpenAI, Anthropic, and Google Gemini behind one
host-injected provider contract for text generation and structured-output validation.

> **Current v0.2.0 boundary:**
> - Ships `OpenAIProvider`, `AnthropicProvider`, and `GeminiProvider` adapters.
> - Ships `generateText()` and `generateStructured()` through the `AIProvider` contract.
> - Normalizes provider/model/usage/error information into `AIResponse`.
> - Does **not** ship streaming (`generateStream`) in the current source package.
> - Provider credentials are injected through adapter config; core does not own a vault.

---

## 2. Core Domain Contract

```ts
export interface AIProvider {
  generateText(request: AIRequest): Promise<AIResponse<string>>;
  generateStructured<T>(request: StructuredAIRequest<T>): Promise<AIResponse<T>>;
}
```
`AIRequest` supports model, system/prompt text, temperature, output-token and timeout hints,
and arbitrary metadata. `StructuredAIRequest<T>` adds a host-supplied schema validator.

## 3. Explicit Non-Goals for v0.2.0

- Token streaming.
- Provider key storage or secret rotation.
- Provider-specific SDK dependencies in the core contract.
- Persistence, usage metering, or tenant entitlement ownership.

See `core/types.ts`, `index.ts`, and `adapters/` for the executable source of truth.
