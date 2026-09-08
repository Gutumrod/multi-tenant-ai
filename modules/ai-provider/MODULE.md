# AI Provider Module

**Version:** 0.2.0
**Workspace package:** `@module-hub/ai-provider` (private/local; not a registry publication promise)

## Overview

The **AI Provider Module** provides a lightweight abstraction for LLM inference across
OpenAI, Anthropic, and Google Gemini using host-supplied credentials.

## Shipped Features

- Unified `AIProvider` interface.
- `generateText()` and schema-validated `generateStructured()`.
- OpenAI, Anthropic, and Gemini adapters.
- Secret injection with no core-owned environment/vault dependency.
- Error normalization (`RATE_LIMITED`, `TIMEOUT`, `PROVIDER_ERROR`, and related codes).
- Request timeout management.

## Current Limitation

Token streaming is not implemented in v0.2.0. See `DESIGN.md` and `core/types.ts` for the
current executable contract.
