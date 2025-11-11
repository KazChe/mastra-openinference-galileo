/**
 * Quick Start: Mastra + Galileo Integration
 * 
 * The simplest possible example showing how to:
 * 1. Create a new mastra agent
 * 2. Send traces to Galileo automatically via OpenInference
 * 3. Get token metrics without any manual instrumentation
 */

import 'dotenv/config';
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { ArizeExporter } from "@mastra/arize"; // Uses OpenInference semantic conventions
import { LibSQLStore } from "@mastra/libsql";

// Step 1: Create your agent
const simpleAgent = new Agent({
  name: "simple-agent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o"),
});

// Step 2: configure Mastra with Galileo using AI Tracing + OpenInference
const mastra = new Mastra({
  // 
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
  
  // AI Tracing configuration with OpenInference exporter for Galileo
  observability: {
    configs: {
      galileo: {
        serviceName: "my-app",
        exporters: [
          new ArizeExporter({
            //use Galileo's OTEL endpoint with OpenInference conventions
            endpoint: "https://api.galileo.ai/otel/traces",
            headers: {
              "Galileo-API-Key": process.env.GALILEO_API_KEY || "",
              "project": process.env.GALILEO_PROJECT || "default",
              "logstream": process.env.GALILEO_LOG_STREAM || "default",
            },
            // logLevel: "debug", // Uncomment to see export details
          }),
        ],
      },
    },
  },
  
  // register your mastra agent
  agents: {
    simpleAgent,
  },
});

// Step 3 Use your agent - that's it!
async function main() {
  const agent = mastra.getAgent("simpleAgent");
  
  console.log("Asking agent a question...\n");
  
  const result = await agent.generate(
    "Explain HNSW in one sentence."
  );
  
  console.log("Response:", result.text);
  console.log("\n✅ Done! Flushing traces to Galileo...");
  
  //waits for the exporter to flush traces (batches every 5-10 seconds)
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log("✅ Traces sent! Check your Galileo dashboard.");
}

// run the example
main().catch(console.error);

export { mastra };

