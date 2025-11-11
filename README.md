# Mastra + Galileo Integration

This example demonstrates how to integrate Mastra agents with Galileo Observability using **OpenInference** semantic conventions transmitted via the OpenTelemetry Protocol (OTLP).

## Why This Integration?

**Mastra uses the Vercel AI SDK (`@ai-sdk/openai`)**, not the official OpenAI SDK. This means:

❌ **Galileo's `wrapOpenAI()` doesn't work with Mastra**
- `wrapOpenAI` wraps the OpenAI SDK (`openai` package)
- Mastra uses Vercel AI SDK (`@ai-sdk/openai`)
- These are incompatible - different APIs, different architectures

✅ **Solution: Use Mastra's AI Tracing with OpenInference**
- Mastra's `ArizeExporter` sends traces using OpenInference conventions
- Galileo accepts OpenInference traces via its OTLP endpoint
- Automatic instrumentation - no manual wrapping needed

**This integration shows you how to get Galileo observability for Mastra applications.**

### What About Galileo's Official Vercel AI SDK Docs?

Galileo has [official documentation for Vercel AI SDK](https://v2docs.galileo.ai/sdk-api/third-party-integrations/opentelemetry-and-openinference/vercel-ai), but that's for **direct Vercel AI SDK usage** (without Mastra). If you're using Mastra's agent framework, you should follow **this integration** instead because:

- Mastra already wraps and instruments Vercel AI SDK calls via AI Tracing
- Trying to use both approaches would instrument the same calls twice
- Mastra's `ArizeExporter` is designed to work with Mastra's agent/workflow abstractions