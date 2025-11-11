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

## Features

Mastra will automatically capture and send to Galileo:
- ✅ **Token metrics** (input tokens, output tokens, total tokens)
- ✅ **Latency metrics** (request duration, TTFT)
- ✅ **LLM interactions** (prompts, completions, model info)
- ✅ **Agent operations** (tool calls, decision paths)
- ✅ **Workflow execution** (step-by-step traces)

## Setup

### 1. Create a Galileo account

If you don't have a Galileo account yet, sign up at **[https://app.galileo.ai/](https://app.galileo.ai/)** to get your API key, project, and log stream.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `env.example` to `.env` and fill in your credentials:

```bash
cp env.example .env
```

Required environment variables:
- `OPENAI_API_KEY` - Your OpenAI API key
- `GALILEO_API_KEY` - Your Galileo API key
- `GALILEO_PROJECT` - Your Galileo project name
- `GALILEO_LOG_STREAM` - Your Galileo log stream name

### 4. Run an example

We provide three examples with increasing complexity:

#### Quick Start (Recommended First)
```bash
npm run quick-start
# Or: npx tsx quick-start.ts
```
Minimal setup (~80 lines). Perfect for getting started.

#### Full Integration (Default)
```bash
npm start
# Or: npx tsx mastra-galileo-integration.ts
```
Complete setup with logging and best practices.

#### Advanced Workflows
```bash
npm run advanced
# Or: npx tsx advanced-workflow-example.ts
```
Multi-agent coordination, workflows, and tools.

## How It Works

### Architecture

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   Mastra    │─────▶│   OpenAI    │      │   Galileo    │
│   Agent     │      │    API      │      │  Dashboard   │
└─────────────┘      └─────────────┘      └──────────────┘
       │                                           ▲
       │                                           │
       └───────────────────────────────────────────┘
              OTEL Traces (auto-captured)
```

1. **Mastra Agent** makes LLM calls using Vercel AI SDK
2. **Mastra's Telemetry** automatically captures:
   - Token usage (input/output)
   - Request/response timing
   - Model and configuration
   - Full conversation context
3. **OTEL Exporter** sends traces to Galileo's endpoint
4. **Galileo Dashboard** displays metrics and traces

### Key Configuration

The integration is configured in the Mastra instance using AI Tracing with the OTEL exporter:

```typescript
import { ArizeExporter } from "@mastra/arize";
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  storage: new LibSQLStore({ url: "file:./mastra.db" }),
  observability: {
    configs: {
      galileo: {
        serviceName: "mastra-app",
        exporters: [
          new ArizeExporter({
            endpoint: "https://api.galileo.ai/otel/traces",
            headers: {
              "Galileo-API-Key": process.env.GALILEO_API_KEY,
              "project": process.env.GALILEO_PROJECT,
              "logstream": process.env.GALILEO_LOG_STREAM,
            },
          }),
        ],
      },
    },
  },
});
```

## Example Files

### 📄 quick-start.ts (⭐ Start Here)

The simplest possible setup in ~80 lines:

```typescript
import { ArizeExporter } from "@mastra/arize";

const mastra = new Mastra({
  storage: new LibSQLStore({ url: "file:./mastra.db" }),
  observability: { /* Galileo config */ },
  agents: { simpleAgent },
});
```

**What you'll see in Galileo:**
- 4 spans (agent, step, gpt-4o, chunk)
- Token metrics on the `gpt-4o` span
- Full trace hierarchy

**Run it:**
```bash
npm run quick-start
```

### 📄 mastra-galileo-integration.ts (⭐⭐ Full Setup)

Production-ready configuration with:
- Structured logging (Pino)
- Environment variable management
- Detailed comments explaining each section

**Run it:**
```bash
npm start
```

### 📄 advanced-workflow-example.ts (⭐⭐⭐ Advanced)

Complex orchestration showing:
- **Multi-agent coordination:** Research agent + Summary agent
- **Custom tools:** Weather API example
- **Workflows:** Multi-step execution with dependencies
- **Complete tracing:** Every agent, tool, and workflow step

**What you'll see in Galileo:**
```
Workflow Execution
├── Research Agent (gpt-4o) → 150 tokens
│   └── Tool: get-weather
├── Summary Agent (gpt-4o-mini) → 80 tokens
└── Total: 230 tokens
```

**Run it:**
```bash
npm run advanced
```

## Why This Approach?

**Important:** Galileo **requires OpenInference** semantic conventions. Mastra's `OtelExporter` (which uses OpenTelemetry GenAI conventions) will not work - Galileo rejects those spans during validation.

### What You Get with Mastra's AI Tracing

Using Mastra's built-in AI Tracing provides:

1. **Automatic Instrumentation**: No need to manually wrap functions or SDK clients
2. **Comprehensive Coverage**: Captures agents, workflows, tools, and every LLM call
3. **Zero Configuration**: Just add the exporter - Mastra handles the rest
4. **Rich Context**: Distributed tracing across your entire agent execution
5. **OpenInference Compatible**: Works with Galileo, Arize Phoenix, and other OpenInference platforms

### vs. Manual OpenAI Wrapper

If you're familiar with Galileo's `wrapOpenAI()` function, here's why this approach is different:

| Aspect | `wrapOpenAI()` | Mastra AI Tracing |
|--------|---------------|-------------------|
| **SDK Compatibility** | OpenAI SDK only | Vercel AI SDK (any provider) |
| **Instrumentation** | Manual wrapper per client | Automatic for all agents |
| **Agent Support** | No | Yes - full agent orchestration |
| **Workflow Support** | No | Yes - multi-step workflows |
| **Tool Usage** | No | Yes - automatic tool tracing |
| **Setup** | Wrap each client | Configure once globally |

**Bottom line:** For Mastra-based applications, AI Tracing with `ArizeExporter` is the only way to integrate with Galileo.

## Advanced Usage

### Multi-Agent Systems

All agents registered with Mastra are automatically traced:

```typescript
const mastra = new Mastra({
  agents: {
    researchAgent,
    summaryAgent,
    reviewAgent,
  },
  telemetry: { /* ... */ },
});
```

### Workflow Tracing

Mastra workflows are also automatically traced:

```typescript
const workflow = createWorkflow({
  id: "data-processing",
  // ...
}).then(step1).then(step2);

await workflow.execute({ input: "data" });
// All steps are traced and sent to Galileo
```

### Custom Spans (Optional)

For additional custom tracking:

```typescript
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("my-custom-tracer");
const span = tracer.startSpan("custom-operation");
// ... do work ...
span.end();
```

## Troubleshooting

### No traces appearing in Galileo

**Most common issue: Program exits before traces are sent**

The OTEL exporter buffers spans and waits ~5 seconds after the root span completes before exporting. If your program exits immediately, traces won't be sent.

**Solution:** Add a delay before your program exits:

```typescript
// After your agent calls
console.log("Flushing traces to Galileo...");
await new Promise(resolve => setTimeout(resolve, 6000));
console.log("Traces sent!");
```

All the examples in this folder include this delay.

**Other checks:**
1. Verify your API key and project/stream names are correct
2. Check the OTEL endpoint is reachable
3. Look for errors in console output
4. Ensure `observability` is properly configured with the OTEL exporter

### Missing token counts

- Token metrics are automatically captured by Mastra's telemetry
- Ensure `observability.default.enabled` is `true`
- Check that storage is properly configured

### Performance concerns

To sample traces instead of capturing all:

```typescript
telemetry: {
  sampling: {
    type: "ratio",
    probability: 0.1, // Sample 10% of traces
  },
}
```

## Related Documentation


### External Resources
- **[OpenInference Semantic Conventions](https://arize-ai.github.io/openinference/spec/semantic_conventions.html)** - Official spec for all OpenInference attributes (required reading!)
- [Galileo's Vercel AI SDK Integration](https://v2docs.galileo.ai/sdk-api/third-party-integrations/opentelemetry-and-openinference/vercel-ai) - For direct Vercel AI SDK usage without Mastra (different approach)
- [Mastra Observability](https://mastra.ai/docs/observability/overview) - Mastra observability docs
- [Mastra AI Tracing](https://mastra.ai/docs/observability/ai-tracing/overview) - AI tracing guide
- [Galileo Documentation](https://docs.galileo.ai/) - Galileo platform docs
- [OpenTelemetry Specification](https://opentelemetry.io/docs/) - OTLP protocol docs

