/**
 * Brand Visibility Tester — Configuration
 *
 * All models run through Cloudflare AI Gateway (Unified Billing).
 * Third-party models (OpenAI, Anthropic, Google) are billed via Unified Billing credits.
 * Workers AI models (@cf/ prefix) are billed via standard Workers AI pricing.
 * No external API keys required.
 */

export type ModelConfig = {
	/** Model ID — @cf/ for Workers AI, author/model for third-party via gateway */
	id: string;
	/** Display name */
	name: string;
	/** Provider label for badges */
	provider:
		| "openai"
		| "anthropic"
		| "google"
		| "meta"
		| "mistral"
		| "workers-ai";
	/** Max tokens to request */
	maxTokens?: number;
	/** Whether this is a Gemini model (different request/response format) */
	isGemini?: boolean;
	/** Whether this is an Anthropic model (no system role in messages) */
	isAnthropic?: boolean;
};

/**
 * All models — run via env.AI.run() with gateway: { id: "default" }
 * Third-party models use Unified Billing (no API keys).
 * Workers AI models use standard pricing.
 */
export const MODELS: ModelConfig[] = [
	{
		id: "openai/gpt-5.4-nano",
		name: "GPT-5.4 Nano",
		provider: "openai",
		maxTokens: 512,
	},
	{
		id: "anthropic/claude-sonnet-4",
		name: "Claude Sonnet 4",
		provider: "anthropic",
		maxTokens: 512,
		isAnthropic: true,
	},
	{
		id: "google/gemini-3-flash",
		name: "Gemini 3 Flash",
		provider: "google",
		maxTokens: 512,
		isGemini: true,
	},
	{
		id: "@cf/meta/llama-4-scout-17b-16e-instruct",
		name: "Llama 4 Scout 17B",
		provider: "workers-ai",
		maxTokens: 512,
	},
	{
		id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
		name: "Mistral Small 3.1",
		provider: "workers-ai",
		maxTokens: 512,
	},
];

/** Model used for AI prompt generation in /api/setup */
export const SETUP_MODEL = "openai/gpt-5.4-nano";

export const RETENTION_DAYS = 30;

export const SYSTEM_PROMPT =
	"You are a helpful assistant. When answering questions, mention specific companies, products, and websites by name when relevant. Include URLs when you know them.";

/**
 * Telegram Bot Configuration
 * Configure secrets in wrangler.jsonc under "secrets" or use wrangler secret put
 * Usage in worker: TELEGRAM_CONFIG.fromEnv(env) to get runtime values
 */
export type TelegramEnv = {
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_WEBHOOK_URL?: string;
	TELEGRAM_ALLOWED_CHATS?: string;
};

export type TelegramConfig = {
	botToken: string;
	webhookUrl: string;
	allowedChats: number[];
	rateLimit: number;
	maxMessageLength: number;
};

export const TELEGRAM_CONFIG: TelegramConfig = {
	botToken: "",
	webhookUrl: "",
	allowedChats: [],
	rateLimit: 5,
	maxMessageLength: 4096,
};

export function getTelegramConfig(env: TelegramEnv): TelegramConfig {
	return {
		botToken: env.TELEGRAM_BOT_TOKEN || "",
		webhookUrl: env.TELEGRAM_WEBHOOK_URL || "",
		allowedChats: env.TELEGRAM_ALLOWED_CHATS ? env.TELEGRAM_ALLOWED_CHATS.split(",").map(Number) : [],
		rateLimit: 5,
		maxMessageLength: 4096,
	};
}
