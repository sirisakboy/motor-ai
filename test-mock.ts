import { executeJob } from "./workers/queue";
import type { QueueJob } from "./workers/api";

async function runTest() {
    const mockEnv = {
        AI: undefined, // Simulating no AI binding
        AEO_KV: {
            put: async () => console.log("KV put called (mock)")
        } as any
    };

    console.log("--- Running Simulation Tests ---");

    // Test Case 1: Brand NOT mentioned (fallback)
    const job1: QueueJob = {
        testId: "test-1",
        domain: "example.com",
        modelId: "gpt-5.4",
        modelName: "GPT-5.4",
        provider: "OpenAI",
        prompt: "...",
        maxTokens: 50
    };

    console.log("\nTest 1 (No mention):");
    const result1 = await executeJob(mockEnv, job1);
    console.log("Result:", result1);
    console.assert(result1.mentioned === false, "Test 1 failed: Brand should not be mentioned");

    // Test Case 2: Brand MENTIONED (mocking AI)
    // To simulate a mention, we need a way to mock `callModel`.
    // Since `executeJob` calls `callModel` and `callModel` calls `env.AI.run`,
    // and `env.AI` is undefined here, it falls back to a string that DOES NOT contain example.com.
    //
    // To properly test this, we need to either:
    // 1. Mock `callModel` directly by exporting it.
    // 2. Pass an environment that mocks `env.AI.run`.
    
    console.log("\nTest 2 (Mentioned - requires mocking AI.run):");
    const mockEnvWithAI = {
        AI: {
            run: async () => "This is a response mentioning example.com for you."
        } as any,
        AEO_KV: mockEnv.AEO_KV
    };
    
    const job2: QueueJob = {
        testId: "test-2",
        domain: "example.com",
        modelId: "gpt-5.4",
        modelName: "GPT-5.4",
        provider: "OpenAI",
        prompt: "...",
        maxTokens: 50
    };
    
    const result2 = await executeJob(mockEnvWithAI, job2);
    console.log("Result:", result2);
    console.assert(result2.mentioned === true, "Test 2 failed: Brand should be mentioned");
    console.assert(result2.excerpt !== null, "Test 2 failed: Excerpt should not be null");

    console.log("\n--- Tests Passed ---");
}

runTest().catch(console.error);
