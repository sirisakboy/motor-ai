# MANUAL: API Key Management for Motor-AI

This document outlines how to securely update your SerpApi Key.

## Why use Cloudflare Secrets?
Even if you hardcoded a placeholder for initial testing, it is critical to move the actual API key to Cloudflare's secure secret storage to prevent leaks and unauthorized usage.

## How to update your SerpApi Key securely

1. Open your terminal in the root directory of the project.
2. Run the following command:

   ```bash
   npx wrangler secret put SERPAPI_KEY
   ```

3. When prompted, paste your **actual** SerpApi key and press Enter.

This will encrypt your key and store it securely within your Cloudflare Worker environment. The code (`workers/api.ts`) is designed to use this secret automatically if available.
