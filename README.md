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