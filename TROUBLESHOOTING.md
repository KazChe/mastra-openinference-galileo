# Troubleshooting Guide: Mastra + Galileo Integration

This guide contains the actual commands and techniques used to debug the integration.

## Quick Diagnostic Commands

### 1. Check if Environment Variables are Loaded

```bash
cd examples/mastra  # Navigate to your project directory
node -e "require('dotenv').config(); console.log('API Key:', process.env.GALILEO_API_KEY?.substring(0, 10) + '...'); console.log('Project:', process.env.GALILEO_PROJECT); console.log('Stream:', process.env.GALILEO_LOG_STREAM);"
```

Sample output:
```bash
API Key: 1234567890...
Project: my-project
Stream: my-stream
```

**What to look for:**
- API key should show first 10 characters
- Project and stream names should match what's in Galileo UI

### 2. Test Galileo Endpoint Connectivity

**Purpose:** This command sends a minimal test trace directly to Galileo, bypassing Mastra entirely. It helps you verify:
- ✅ Your API credentials are correct
- ✅ Galileo accepts OpenInference format
- ✅ Network connectivity to Galileo's endpoint
- ✅ The exact HTTP response (status code, headers, body)

**How it works:**
1. Creates a minimal OTLP trace with OpenInference attributes
2. Sends it directly to `https://api.galileo.ai/otel/traces`
3. Uses your `.env` credentials
4. Shows the complete HTTP response from Galileo

**When to use this:**
- Before setting up Mastra (to test credentials)
- When traces aren't appearing (to isolate if it's a Mastra or Galileo issue)
- To understand exactly what error Galileo is returning

Run this command:

```bash
node << 'EOF'
require('dotenv').config();
const https = require('https');

const testSpan = {
  resourceSpans: [{
    resource: {
      attributes: [
        { key: 'service.name', value: { stringValue: 'test-service' } }
      ]
    },
    scopeSpans: [{
      scope: { name: 'test' },
      spans: [{
        traceId: Buffer.from('12345678901234567890123456789012').toString('base64'),
        spanId: Buffer.from('1234567890123456').toString('base64'),
        name: 'test-span',
        kind: 2,
        startTimeUnixNano: String(Date.now() * 1000000),
        endTimeUnixNano: String((Date.now() + 1000) * 1000000),
        attributes: [
          { key: 'openinference.span.kind', value: { stringValue: 'LLM' } },
          { key: 'llm.model_name', value: { stringValue: 'gpt-4' } },
          { key: 'llm.token_count.prompt', value: { intValue: '10' } },
          { key: 'llm.token_count.completion', value: { intValue: '20' } }
        ]
      }]
    }]
  }]
};

const data = Buffer.from(JSON.stringify(testSpan));

const options = {
  hostname: 'api.galileo.ai',
  port: 443,
  path: '/otel/traces',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Galileo-API-Key': process.env.GALILEO_API_KEY,
    'project': process.env.GALILEO_PROJECT,
    'logstream': process.env.GALILEO_LOG_STREAM
  }
};

const req = https.request(options, (res) => {
  console.log('\n=== Response from Galileo ===');
  console.log('HTTP Status:', res.statusCode);
  console.log('Status Message:', res.statusMessage);
  console.log('\nHeaders:', JSON.stringify(res.headers, null, 2));
  
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\nResponse Body:', body);
    console.log('\n=== Interpretation ===');
    
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS: Galileo accepted the trace');
    } else if (res.statusCode === 401) {
      console.log('❌ AUTHENTICATION ERROR: Check your API key and headers');
    } else if (res.statusCode === 422) {
      console.log('❌ VALIDATION ERROR: Galileo rejected the span format');
      console.log('This usually means wrong semantic conventions (need OpenInference)');
    } else if (res.statusCode === 415) {
      console.log('❌ MEDIA TYPE ERROR: Wrong Content-Type');
      console.log('Galileo requires application/x-protobuf for protobuf format');
    } else {
      console.log('❌ UNEXPECTED ERROR:', res.statusCode);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network Error:', error.message);
});

req.write(data);
req.end();
EOF
```

**Example Output (415 - EXPECTED & GOOD!):**
```
=== Response from Galileo ===
HTTP Status: 415
Status Message: Unsupported Media Type

Response Body: {"detail":"application/json is not supported, content_type needs to be: 'application/x-protobuf'"}

=== Interpretation ===
❌ MEDIA TYPE ERROR: Wrong Content-Type
Galileo requires application/x-protobuf for protobuf format
```

**⚠️ Important:** This 415 error is **EXPECTED and means your setup is working!**

Why? The test command sends JSON for readability, but Galileo requires protobuf. This proves:
- ✅ Your credentials work (no 401)
- ✅ Headers are correct (no 401)
- ✅ Endpoint is reachable
- ✅ Galileo is validating properly

The real `ArizeExporter` sends protobuf correctly, so you won't see this error in production.

**Example Success Output (Less Common):**
```
=== Response from Galileo ===
HTTP Status: 200
Status Message: OK

Headers: {
  "content-type": "application/json",
  "galileo-request-received-at-nanoseconds": "1762683382051511342"
}

Response Body: {"status":"ok"}

=== Interpretation ===
✅ SUCCESS: Galileo accepted the trace
```

Note: You'll rarely see HTTP 200 from this test since we send JSON. The 415 is the expected response.

**Example Failure Output (Wrong Credentials):**
```
=== Response from Galileo ===
HTTP Status: 401
Status Message: Unauthorized

Response Body: {"detail":"Invalid credentials."}

=== Interpretation ===
❌ AUTHENTICATION ERROR: Check your API key and headers
```

**Example Failure Output (Wrong Format):**
```
=== Response from Galileo ===
HTTP Status: 422
Status Message: Unprocessable Entity

Response Body: {"detail":"Trace processing failed: spans - List should have at least 1 item after validation, not 0"}

=== Interpretation ===
❌ VALIDATION ERROR: Galileo rejected the span format
This usually means wrong semantic conventions (need OpenInference)
```

**Understanding the test span:**

The command sends a trace with these OpenInference attributes:
```javascript
{
  'openinference.span.kind': 'LLM',           // ← OpenInference span type
  'llm.model_name': 'gpt-4',                  // ← Model used
  'llm.token_count.prompt': 10,              // ← Input tokens
  'llm.token_count.completion': 20           // ← Output tokens
}
```

If Galileo accepts this, it means:
- Your credentials work ✅
- Galileo endpoint is reachable ✅
- OpenInference format is accepted ✅

**Common Responses:**

| Status Code | Meaning | What It Means for You |
|-------------|---------|----------------------|
| **415** | Unsupported media type | **✅ EXPECTED! Your setup works!** (Test sends JSON, Galileo wants protobuf) |
| 401 | Unauthorized | ❌ Check `Galileo-API-Key` header and credentials |
| 422 | Validation failed | ❌ Wrong semantic conventions (ArizeExporter issue) |
| 200 | Success | ✅ Rare with this test, but means everything perfect |

**TL;DR:** If you see **415**, you're good! It means authentication and headers work. The actual `ArizeExporter` sends protobuf and won't get this error.

### 3. Enable Debug Logging

**First, uncomment the debug line in your config:**

Open `quick-start.ts` and find this line:
```typescript
// logLevel: "debug", // Uncomment to see export details
```

Change it to:
```typescript
logLevel: "debug", // Uncomment to see export details
```

Or use this command to uncomment it:
```bash
sed -i '' 's|// logLevel: "debug"|logLevel: "debug"|' quick-start.ts
```

**Then run and check the output:**

```bash
npx tsx quick-start.ts 2>&1 | grep -E "Export|Status|items to be sent" | head -20
```

**Example Output:**
```
OTLPExportDelegate items to be sent [
  MastraReadableSpan {
    name: 'chat gpt-4o',
    ...
  }
]
OTLPExportDelegate Export succeeded but could not deserialize response
✅ Traces sent! Check your Galileo dashboard.
```

**What to look for:**
- "items to be sent" - Shows what spans are being exported
- "Export succeeded" - Trace was sent successfully
- "Export failed" - Something went wrong
- Any error messages or stack traces

**Don't forget to comment it back out when done:**
```bash
sed -i '' 's|logLevel: "debug"|// logLevel: "debug"|' quick-start.ts
```

### 4. Check Span Attributes

**Note:** Debug logging must be enabled first (see step 3 above).

To see what attributes Mastra is sending:

```bash
npx tsx quick-start.ts 2>&1 | grep -A 10 "attributes:" | head -30
```

**Example Output (Good - OpenInference):**
```javascript
attributes: {
  'openinference.span.kind': 'LLM',
  'output.value': '{"text":"HNSW (Hierarchical Navigable Small World)..."}',
  'output.mime_type': 'application/json'
}
```

**Check for Token Metrics:**
```bash
npx tsx quick-start.ts 2>&1 | grep -B 5 "llm.token_count"
```

**Example Output (Good - Has Token Metrics):**
```javascript
'llm.input_messages.1.message.contents.0.message_content.text': 'Explain HNSW in one sentence.',
'llm.output_messages.0.message.role': 'assistant',
'llm.output_messages.0.message.contents.0.message_content.text': 'HNSW (Hierarchical Navigable Small World)...',
'llm.token_count.prompt': 25,        // ✅ Input tokens
'llm.token_count.completion': 42,    // ✅ Output tokens
'llm.token_count.total': 67,         // ✅ Total tokens
```

**What you SHOULD see (OpenInference - Correct):**
```javascript
{
  'openinference.span.kind': 'LLM',           // ✅ OpenInference
  'llm.model_name': 'gpt-4o',                 // ✅ OpenInference
  'llm.token_count.prompt': 25,               // ✅ OpenInference
  'llm.token_count.completion': 42            // ✅ OpenInference
}
```

**What you should NOT see (OpenTelemetry GenAI - Wrong):**
```javascript
{
  'gen_ai.request.model': 'gpt-4o',           // ❌ Wrong format
  'gen_ai.usage.input_tokens': 24,            // ❌ Wrong format
  'gen_ai.system': 'openai'                   // ❌ Wrong format
}
```

**See Multiple Spans:**

You should see several spans for one query:
```bash
npx tsx quick-start.ts 2>&1 | grep "name:" | grep -E "chunk|step|chat"
```

**Example Output:**
```
name: "chunk: 'text'",
name: 'step: 0',
name: 'chat gpt-4o',
name: 'agent.simple-agent',
```

Only the `chat gpt-4o` span will have token metrics - this is correct!

## Common Issues and Solutions

### Issue: "Nothing shows up in Galileo"

**Step 1: Check environment variables**
```bash
node -e "require('dotenv').config(); console.log('Keys loaded:', !!process.env.GALILEO_API_KEY)"
```

**Step 2: Verify you're using ArizeExporter**
```bash
grep -n "ArizeExporter" quick-start.ts
```

Should show: `import { ArizeExporter } from "@mastra/arize";`

**Not:** `import { OtelExporter } from "@mastra/otel-exporter";` ❌

**Step 3: Check for flush delay**
```bash
grep -n "setTimeout" quick-start.ts
```

Should show a 10-second delay before exit.

**Step 4: Run test endpoint command** (see #2 above)

### Issue: "401 Unauthorized"

```bash
# Test your headers
node -e "
require('dotenv').config();
const headers = {
  'Galileo-API-Key': process.env.GALILEO_API_KEY,
  'project': process.env.GALILEO_PROJECT,
  'logstream': process.env.GALILEO_LOG_STREAM
};
console.log('Headers that will be sent:');
console.log(JSON.stringify(headers, null, 2));
console.log('\nAPI Key length:', process.env.GALILEO_API_KEY?.length);
"
```

**Common causes:**
- Missing `Galileo-API-Key` header
- Using `Authorization` header instead ❌
- Wrong header names (`X-Galileo-Project` instead of `project`) ❌

### Issue: "422 Validation Error"

This means Galileo received spans but rejected them during validation.

**Check which exporter you're using:**
```bash
grep "import.*Exporter" quick-start.ts
```

**Should be:**
```typescript
import { ArizeExporter } from "@mastra/arize"; // ✅ OpenInference
```

**NOT:**
```typescript
import { OtelExporter } from "@mastra/otel-exporter"; // ❌ GenAI conventions
```

**Test with debug logging:**
```bash
# Enable debug in code first, then:
npx tsx quick-start.ts 2>&1 | grep -E "openinference|gen_ai"
```

Should see `openinference.span.kind`, not `gen_ai.request.model`.

### Issue: "415 Unsupported Media Type"

This means wrong content-type. Galileo requires protobuf for OTLP.

**Note:** This error is expected if testing with JSON (like in our diagnostic command above). The actual ArizeExporter sends protobuf correctly.

### Issue: "Export succeeded but could not deserialize response"

This is **harmless**! It means:
- ✅ Galileo accepted the trace (HTTP 200)
- ❌ Response format doesn't match expected protobuf

**Verify traces are in Galileo:**
- Check your dashboard
- Look for traces in the time range
- Filter by service name

## Advanced Debugging

### Capture Full Request/Response

```bash
# Run with all output
npx tsx quick-start.ts 2>&1 | tee debug-output.log

# Search for errors
grep -i "error\|failed\|rejected" debug-output.log

# Check HTTP status
grep -E "status.*[0-9]{3}" debug-output.log
```

### Compare Span Formats

**Note:** Debug logging must be enabled first (uncomment `logLevel: "debug"` in your config).

**Get a span from Mastra:**
```bash
npx tsx quick-start.ts 2>&1 | grep -A 30 "MastraReadableSpan {" | head -40 > mastra-span.txt
```

**If you get nothing:** Debug logging isn't enabled. Go back and uncomment the `logLevel: "debug"` line.

**Check for required OpenInference attributes:**
```bash
grep "openinference\|llm\." mastra-span.txt
```

**Example Output (Good):**
```
'openinference.span.kind': 'LLM',
'llm.input_messages.0.message.role': 'system',
'llm.input_messages.1.message.role': 'user',
'llm.output_messages.0.message.role': 'assistant',
'llm.token_count.prompt': 25,
'llm.token_count.completion': 42,
'llm.token_count.total': 67,
```

If you see these attributes, you're using OpenInference correctly! ✅

### Test Different Exporters

**Test with ArizeExporter (correct):**
```typescript
import { ArizeExporter } from "@mastra/arize";
new ArizeExporter({ /* config */ })
```

**Test with OtelExporter (will fail):**
```typescript
import { OtelExporter } from "@mastra/otel-exporter";
new OtelExporter({ /* config */ })
```

Run both and compare the Galileo responses.

## Verification Checklist

Before reaching out for support, verify:

- [ ] Environment variables loaded (`dotenv/config` imported)
- [ ] Using `ArizeExporter`, not `OtelExporter`
- [ ] Correct headers: `Galileo-API-Key`, `project`, `logstream`
- [ ] 10-second flush delay before exit
- [ ] Storage configured: `new LibSQLStore(...)`
- [ ] Test endpoint returns 200 or 422 (not 401)
- [ ] Debug logging shows `openinference.*` attributes
- [ ] Project and logstream exist in Galileo UI

## Getting Help

If still stuck after trying these steps:

1. **Run the diagnostic test** (#2 above) and capture output
2. **Enable debug logging** and capture full output
3. **Check Galileo dashboard** for any traces (filter by time range)
4. **Share these details:**
   - HTTP status code from test
   - Whether you see `openinference` or `gen_ai` attributes
   - Mastra version: `npm list @mastra/core`
   - ArizeExporter version: `npm list @mastra/arize`

## Quick Reference: Working Configuration

```typescript
import 'dotenv/config';
import { ArizeExporter } from "@mastra/arize";
import { LibSQLStore } from "@mastra/libsql";

const mastra = new Mastra({
  storage: new LibSQLStore({ url: "file:./mastra.db" }),
  observability: {
    configs: {
      galileo: {
        serviceName: "my-app",
        exporters: [
          new ArizeExporter({
            endpoint: "https://api.galileo.ai/otel/traces",
            headers: {
              "Galileo-API-Key": process.env.GALILEO_API_KEY,
              "project": process.env.GALILEO_PROJECT,
              "logstream": process.env.GALILEO_LOG_STREAM,
            },
            // logLevel: "debug", // Uncomment for debugging
          }),
        ],
      },
    },
  },
  agents: { /* your agents */ },
});

// Always include flush delay
await new Promise(resolve => setTimeout(resolve, 10000));
```

## See Also

### Internal Documentation
- [SOLUTION.md](./SOLUTION.md) - Complete problem/solution explanation
- [SPAN-HIERARCHY.md](./SPAN-HIERARCHY.md) - Understanding token metrics
- [TERMINOLOGY.md](./TERMINOLOGY.md) - OpenTelemetry vs OpenInference
- [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) - Quick setup guide

### External Resources
- [OpenInference Semantic Conventions](https://arize-ai.github.io/openinference/spec/semantic_conventions.html) - Official specification for all OpenInference attributes (span kinds, token counts, message formats, etc.)
- [Mastra AI Tracing Docs](https://mastra.ai/docs/observability/ai-tracing/overview) - Mastra's observability documentation
- [Galileo Documentation](https://docs.galileo.ai/) - Galileo observability platform docs

