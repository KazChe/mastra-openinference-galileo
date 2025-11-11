/**
 * Advanced Mastra + Galileo Integration
 * 
 * This example demonstrates:
 * 1. Multi-agent coordination
 * 2. Workflow execution with multiple steps
 * 3. Tool usage
 * 4. All automatically traced to Galileo
 */

import 'dotenv/config'; // Load environment variables from .env
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { ArizeExporter } from "@mastra/arize"; // Galileo requires OpenInference conventions
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Define a custom tool (this will also be traced)
const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context }) => {
    // Simulated weather API call
    // In production, this would call a real weather API
    return {
      temperature: 72,
      conditions: "Sunny",
    };
  },
});

// Create agents with different roles
const researchAgent = new Agent({
  name: "research-agent",
  instructions: "You are a research assistant that gathers information.",
  model: openai("gpt-4o"),
  tools: { weatherTool },
});

const summaryAgent = new Agent({
  name: "summary-agent",
  instructions: "You are a summarization expert. Create concise summaries.",
  model: openai("gpt-4o-mini"),
});

// Create a workflow with multiple steps
const researchStep = createStep({
  id: "research-step",
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    findings: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    logger.info("Starting research phase", { topic: inputData.topic });
    
    const agent = mastra.getAgent("research-agent");
    const result = await agent.generate(
      `Research the following topic: ${inputData.topic}`
    );
    
    return {
      findings: result.text || "No findings",
    };
  },
});

const summaryStep = createStep({
  id: "summary-step",
  inputSchema: z.object({
    findings: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    logger.info("Starting summary phase");
    
    const agent = mastra.getAgent("summary-agent");
    const result = await agent.generate(
      `Summarize these findings: ${inputData.findings}`
    );
    
    return {
      summary: result.text || "No summary",
    };
  },
});

// Create and commit workflow
const researchWorkflow = createWorkflow({
  id: "research-workflow",
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
})
  .then(researchStep)
  .then(summaryStep)
  .commit();

// Configure Mastra with Galileo
export const mastra = new Mastra({
  logger: new PinoLogger({
    name: "Mastra-Galileo-Advanced",
    level: "info",
  }),
  
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
  
  // AI Tracing configuration with OpenInference exporter for Galileo
  observability: {
    configs: {
      galileo: {
        serviceName: "mastra-advanced-app",
        // sampling: { type: "always" }, // Default is to capture all traces
        exporters: [
          new ArizeExporter({
            endpoint: "https://api.galileo.ai/otel/traces",
            headers: {
              "Galileo-API-Key": process.env.GALILEO_API_KEY || "",
              "project": process.env.GALILEO_PROJECT || "default-project",
              "logstream": process.env.GALILEO_LOG_STREAM || "default-stream",
            },
          }),
        ],
      },
    },
  },
  
  agents: {
    "research-agent": researchAgent,
    "summary-agent": summaryAgent,
  },
  
  workflows: {
    researchWorkflow,
  },
});

// Example: Multi-agent interaction
async function runMultiAgentExample() {
  console.log("\n=== Multi-Agent Example ===\n");
  
  const research = mastra.getAgent("research-agent");
  const summary = mastra.getAgent("summary-agent");
  
  // Step 1: Research agent gathers information
  const researchResult = await research.generate(
    "What are the benefits of TypeScript?"
  );
  
  console.log("Research findings:", researchResult.text?.substring(0, 100) + "...");
  
  // Step 2: Summary agent summarizes the findings
  const summaryResult = await summary.generate(
    `Summarize this: ${researchResult.text}`
  );
  
  console.log("Summary:", summaryResult.text);
  
  // Both interactions are automatically traced to Galileo with:
  // - Individual token counts per agent
  // - Latency per agent
  // - Full conversation context
}

// Example: Workflow execution
async function runWorkflowExample() {
  console.log("\n=== Workflow Example ===\n");
  
  const workflow = mastra.getWorkflow("researchWorkflow");
  
  // Create and execute a workflow run
  const run = await workflow.createRunAsync();
  const result = await run.start({
    inputData: {
      topic: "The impact of AI on software development",
    },
  });
  
  console.log("Workflow result:", result);
  
  // The entire workflow is traced to Galileo showing:
  // - Each step's execution
  // - Token usage per step
  // - Total workflow duration
  // - Step-by-step timing
}

// Example: Agent with tool usage
async function runToolUsageExample() {
  console.log("\n=== Tool Usage Example ===\n");
  
  const agent = mastra.getAgent("research-agent");
  
  const result = await agent.generate(
    "What's the weather like in San Francisco? Use the weather tool."
  );
  
  console.log("Result with tool:", result.text);
  
  // Galileo will show:
  // - The LLM deciding to use the tool
  // - Tool invocation details
  // - Tool response
  // - Final LLM response incorporating tool data
}

// Main execution
async function main() {
  console.log("Starting Mastra + Galileo Advanced Examples");
  console.log("All interactions will be traced to Galileo\n");
  
  try {
    await runMultiAgentExample();
    await runWorkflowExample();
    await runToolUsageExample();
    
    console.log("\n✅ All examples completed!");
    console.log("Flushing traces to Galileo...");
    
    // Wait for exporter to flush traces (batches every 5-10 seconds)
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log("✅ Traces sent! Check your Galileo dashboard for detailed traces and metrics.");
  } catch (error) {
    console.error("Error running examples:", error);
  }
}

//run the examples
main().catch(console.error);

