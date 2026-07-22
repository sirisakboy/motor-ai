/**
 * All /api/* routes as a Hono sub-app.
 * All models run through AI Gateway Unified Billing.
 */
import { Hono } from "hono";
import {
	MODELS,
	RETENTION_DAYS,
	SYSTEM_PROMPT,
	SETUP_MODEL,
} from "../src/config";
import type { ModelConfig, TelegramEnv, TelegramConfig } from "../src/config";
import { getTelegramConfig } from "../src/config";
import { CHAT_CONFIG, VEHICLE_TYPES, REPAIR_CATEGORIES } from "../src/chat-config";
import type { VehicleType, RepairCategory } from "../src/chat-config";

// ── Types ──────────────────────────────────────────────────────────────────

type Env = {
	AI: Ai;
	AEO_KV: KVNamespace;
	BRAND_VISIBILITY_QUEUE: Queue;
	TARGET_DOMAIN: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_WEBHOOK_URL?: string;
	TELEGRAM_ALLOWED_CHATS?: string;
	SERPAPI_KEY?: string;
};

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: string;
};

type ChatSession = {
	messages: ChatMessage[];
	vehicleType?: string;
	vehicleBrand?: string;
	vehicleModel?: string;
};

type Site = {
	domain: string;
	brandName?: string;
	competitors?: string[];
	description?: string;
	addedAt: string;
};

type IndexEntry = {
	id: string;
	timestamp: string;
	rate: number;
	modelCount: number;
};

type TestRun = {
	id: string;
	domain: string;
	startedAt: string;
	status: "running" | "complete";
	total: number;
	completed: number;
	citations: Citation[];
	summary?: { total: number; mentioned: number; rate: number };
};

type Citation = {
	model: string;
	provider: string;
	prompt: string;
	mentioned: boolean;
	excerpt: string | null;
	response: string;
};

type Prompt = {
	text: string;
	active: boolean;
};

export type QueueJob = {
	testId: string;
	domain: string;
	modelId: string;
	modelName: string;
	provider: string;
	prompt: string;
	maxTokens: number;
	isGemini?: boolean;
	isAnthropic?: boolean;
};

export const apiRoutes = new Hono<{ Bindings: Env }>();

// ── Sites CRUD ─────────────────────────────────────────────────────────────

apiRoutes.get("/sites", async (c) => {
	return c.json(await getSites(c.env));
});

apiRoutes.post("/sites", async (c) => {
	const b = await c.req.json<{
		domain: string;
		brandName?: string;
		competitors?: string[];
		description?: string;
	}>();
	const d = clean(b.domain);
	if (!d) return c.json({ error: "Missing domain" }, 400);

	const sites = await getSites(c.env);
	const existing = sites.find((s) => s.domain === d);

	if (existing) {
		if (b.brandName) existing.brandName = b.brandName;
		if (b.competitors) existing.competitors = b.competitors;
		if (b.description) existing.description = b.description;
	} else {
		sites.push({
			domain: d,
			brandName: b.brandName,
			competitors: b.competitors,
			description: b.description,
			addedAt: new Date().toISOString(),
		});
	}

	await c.env.AEO_KV.put("sites", JSON.stringify(sites));
	return c.json(sites);
});

apiRoutes.delete("/sites", async (c) => {
	const b = await c.req.json<{ domain: string }>();
	const sites = (await getSites(c.env)).filter(
		(s) => s.domain !== clean(b.domain),
	);
	await c.env.AEO_KV.put("sites", JSON.stringify(sites));
	return c.json(sites);
});

// ── Site-scoped prompts ────────────────────────────────────────────────────

apiRoutes.get("/sites/:domain/prompts", async (c) => {
	return c.json(await getPrompts(c.env, c.req.param("domain")));
});

apiRoutes.post("/sites/:domain/prompts", async (c) => {
	const d = c.req.param("domain");
	const b = await c.req.json<{ prompts?: string[]; prompt?: string }>();
	const toAdd = b.prompts ?? (b.prompt ? [b.prompt] : []);
	const cur = await getPrompts(c.env, d);
	const newPrompts: Prompt[] = toAdd.map((text) => ({ text, active: true }));
	await c.env.AEO_KV.put(
		`site:${d}:prompts`,
		JSON.stringify([...cur, ...newPrompts]),
	);
	return c.json(await getPrompts(c.env, d));
});

apiRoutes.patch("/sites/:domain/prompts", async (c) => {
	const d = c.req.param("domain");
	const b = await c.req.json<{ prompt: string; active: boolean }>();
	const prompts = await getPrompts(c.env, d);
	const updated = prompts.map((p) =>
		p.text === b.prompt ? { ...p, active: b.active } : p,
	);
	await c.env.AEO_KV.put(`site:${d}:prompts`, JSON.stringify(updated));
	return c.json(updated);
});

apiRoutes.delete("/sites/:domain/prompts", async (c) => {
	const d = c.req.param("domain");
	const b = await c.req.json<{ prompt: string }>();
	const cur = (await getPrompts(c.env, d)).filter((p) => p.text !== b.prompt);
	await c.env.AEO_KV.put(`site:${d}:prompts`, JSON.stringify(cur));
	return c.json(await getPrompts(c.env, d));
});

// ── Site-scoped models ─────────────────────────────────────────────────────

apiRoutes.get("/sites/:domain/models", async (c) => {
	return c.json(await getEnabledModels(c.env, c.req.param("domain")));
});

apiRoutes.put("/sites/:domain/models", async (c) => {
	const d = c.req.param("domain");
	const b = await c.req.json<{ models: string[] }>();
	await c.env.AEO_KV.put(`site:${d}:models`, JSON.stringify(b.models ?? []));
	return c.json(b.models);
});

// ── Start test (enqueue jobs) ──────────────────────────────────────────────

apiRoutes.post("/sites/:domain/test", async (c) => {
	const d = c.req.param("domain");
	const allPrompts = await getPrompts(c.env, d);
	const prompts = allPrompts.filter((p) => p.active).map((p) => p.text);
	if (!prompts.length)
		return c.json({ error: "No active prompts configured" }, 400);

	const enabled = await getEnabledModels(c.env, d);
	const models = MODELS.filter((m) => enabled.includes(m.id));
	if (!models.length) return c.json({ error: "No models enabled" }, 400);

	const testId = crypto.randomUUID();
	const jobs: QueueJob[] = [];

	for (const model of models) {
		for (const prompt of prompts) {
			jobs.push({
				testId,
				domain: d,
				modelId: model.id,
				modelName: model.name,
				provider: model.provider,
				prompt,
				maxTokens: model.maxTokens ?? 512,
				isGemini: model.isGemini,
				isAnthropic: model.isAnthropic,
			});
		}
	}

	const run: TestRun = {
		id: testId,
		domain: d,
		startedAt: new Date().toISOString(),
		status: "running",
		total: jobs.length,
		completed: 0,
		citations: [],
	};

	await c.env.AEO_KV.put(`test:${testId}`, JSON.stringify(run), {
		expirationTtl: RETENTION_DAYS * 86400,
	});

	// Enqueue in batches of 25
	for (let i = 0; i < jobs.length; i += 25) {
		await c.env.BRAND_VISIBILITY_QUEUE.sendBatch(
			jobs.slice(i, i + 25).map((j) => ({ body: j })),
		);
	}

	return c.json(run);
});

// ── Test status (polling) ──────────────────────────────────────────────────

apiRoutes.get("/tests/:id/status", async (c) => {
	const testId = c.req.param("id");
	const run = (await c.env.AEO_KV.get(
		`test:${testId}`,
		"json",
	)) as TestRun | null;
	if (!run) return c.json({ error: "Not found" }, 404);

	// Assemble citations from per-job KV keys
	const list = await c.env.AEO_KV.list({ prefix: `test:${testId}:cite:` });
	const citations: Citation[] = [];
	for (const key of list.keys) {
		const cite = (await c.env.AEO_KV.get(key.name, "json")) as Citation | null;
		if (cite) citations.push(cite);
	}

	const completed = citations.length;
	const isComplete = completed >= run.total;

	// Finalize when all jobs done
	if (isComplete && run.status !== "complete") {
		run.status = "complete";
		run.completed = completed;
		run.citations = citations;
		const mentioned = citations.filter((ci) => ci.mentioned).length;
		run.summary = {
			total: citations.length,
			mentioned,
			rate: citations.length > 0 ? mentioned / citations.length : 0,
		};
		await c.env.AEO_KV.put(`test:${testId}`, JSON.stringify(run), {
			expirationTtl: RETENTION_DAYS * 86400,
		});

		// Update site results index
		const raw = await c.env.AEO_KV.get(`site:${run.domain}:results`, "json");
		const index = (raw as IndexEntry[]) ?? [];
		index.unshift({
			id: run.id,
			timestamp: run.startedAt,
			rate: run.summary.rate,
			modelCount: new Set(citations.map((ci) => ci.model)).size,
		});
		await c.env.AEO_KV.put(
			`site:${run.domain}:results`,
			JSON.stringify(index.slice(0, 90)),
		);
	}

	return c.json({
		...run,
		completed,
		citations: isComplete ? citations : [],
		status: isComplete ? "complete" : "running",
		summary: isComplete ? run.summary : undefined,
	});
});

// ── Site results index ─────────────────────────────────────────────────────

apiRoutes.get("/sites/:domain/results", async (c) => {
	return c.json(await getIndex(c.env, c.req.param("domain")));
});

// ── Result by ID ───────────────────────────────────────────────────────────

apiRoutes.get("/results/:id/csv", async (c) => {
	const testId = c.req.param("id");
	const run = (await c.env.AEO_KV.get(
		`test:${testId}`,
		"json",
	)) as TestRun | null;
	if (!run) return c.json({ error: "Not found" }, 404);

	// Assemble citations if not already present
	if (!run.citations?.length) {
		const list = await c.env.AEO_KV.list({ prefix: `test:${testId}:cite:` });
		for (const key of list.keys) {
			const cite = (await c.env.AEO_KV.get(
				key.name,
				"json",
			)) as Citation | null;
			if (cite) run.citations.push(cite);
		}
	}

	const hdr = "Model,Provider,Prompt,Mentioned,Excerpt,Response\n";
	const rows = run.citations
		.map((ci) =>
			[
				ci.model,
				ci.provider,
				csvE(ci.prompt),
				ci.mentioned ? "Yes" : "No",
				csvE(ci.excerpt ?? ""),
				csvE(ci.response),
			].join(","),
		)
		.join("\n");

	return new Response(hdr + rows, {
		headers: {
			"content-type": "text/csv",
			"content-disposition": `attachment; filename="visibility-${run.domain}-${run.id.slice(0, 8)}.csv"`,
		},
	});
});

apiRoutes.get("/results/:id", async (c) => {
	const testId = c.req.param("id");
	const run = (await c.env.AEO_KV.get(
		`test:${testId}`,
		"json",
	)) as TestRun | null;
	if (!run) return c.json({ error: "Not found" }, 404);

	if (!run.citations?.length && run.status === "complete") {
		const list = await c.env.AEO_KV.list({ prefix: `test:${testId}:cite:` });
		for (const key of list.keys) {
			const cite = (await c.env.AEO_KV.get(
				key.name,
				"json",
			)) as Citation | null;
			if (cite) run.citations.push(cite);
		}
	}

	return c.json(run);
});

// ── Models ─────────────────────────────────────────────────────────────────

apiRoutes.get("/models", (c) => {
	return c.json({
		total: MODELS.length,
		models: MODELS.map((m) => ({
			name: m.name,
			id: m.id,
			provider: m.provider,
		})),
	});
});

// ── Setup (AI prompt generation via gateway) ───────────────────────────────

apiRoutes.get("/setup", async (c) => {
	const domain = c.req.query("domain");
	if (!domain) return c.json({ error: "Missing ?domain=" }, 400);
	const brandName = c.req.query("brand") ?? "";
	const competitors = c.req.query("competitors") ?? "";
	return handleSetup(c.env, domain, brandName, competitors, c);
});

// ── Web Search Helper ──────────────────────────────────────────────────────

async function webSearch(query: string, apiKey: string): Promise<string> {
	// Added site:suparat.net to narrow down results for spare parts
	const searchQuery = `${query} site:suparat.net`;
	const params = new URLSearchParams({
		q: searchQuery,
		location: "Thailand",
		hl: "th",
		gl: "th",
		google_domain: "google.co.th",
		engine: "google",
		api_key: apiKey
	});

	const url = `https://serpapi.com/search.json?${params.toString()}`;
	try {
		const response = await fetch(url);
		const data = await response.json() as any;
		
		if (data.organic_results && data.organic_results.length > 0) {
			return data.organic_results
				.slice(0, 3)
				.map((r: any) => `${r.title}: ${r.link}`)
				.join("\n");
		}
		// Fallback to normal search if site-specific search fails
		return "ไม่พบข้อมูลที่ตรงกัน";
	} catch (err) {
		console.error("Search error:", err);
		return "เกิดข้อผิดพลาดในการค้นหา";
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clean(d: string): string {
	return (d || "")
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/\/.*/, "")
		.trim();
}

function csvE(s: string): string {
	if (s.includes(",") || s.includes('"') || s.includes("\n")) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

async function getSites(env: Env): Promise<Site[]> {
	return ((await env.AEO_KV.get("sites", "json")) as Site[]) ?? [];
}

async function getPrompts(env: Env, domain: string): Promise<Prompt[]> {
	const raw = await env.AEO_KV.get(`site:${domain}:prompts`, "json");
	if (!raw) return [];

	if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
		return (raw as string[]).map((text) => ({ text, active: true }));
	}

	return (raw as Prompt[]) ?? [];
}

async function getIndex(env: Env, domain: string): Promise<IndexEntry[]> {
	return (
		((await env.AEO_KV.get(
			`site:${domain}:results`,
			"json",
		)) as IndexEntry[]) ?? []
	);
}

async function getEnabledModels(env: Env, domain: string): Promise<string[]> {
	const raw = await env.AEO_KV.get(`site:${domain}:models`, "json");
	if (raw && Array.isArray(raw) && raw.length) return raw as string[];
	return MODELS.map((m) => m.id);
}

// ── Setup endpoint ─────────────────────────────────────────────────────────

async function handleSetup(
	env: Env,
	domain: string,
	brandName: string,
	competitors: string,
	c: any,
) {
	let siteContent = "";
	let fetchError = "";
	let detectedBrand = "";

	try {
		const res = await fetch(`https://${domain}`, {
			headers: { "User-Agent": "Brand-Visibility-Tester/1.0" },
			redirect: "follow",
		});

		if (res.ok) {
			const html = await res.text();
			const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
			const d = html.match(
				/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
			);
			const og = html.match(
				/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
			);
			const ogSiteName = html.match(
				/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
			);

			detectedBrand =
				ogSiteName?.[1]?.trim() ??
				t?.[1]
					?.trim()
					.split(/[|\-–—]/)[0]
					?.trim() ??
				"";

			const headings = [...html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi)]
				.map((m) => m[1].trim())
				.filter((h) => h.length > 3 && h.length < 200)
				.slice(0, 15);

			const navLinks = [
				...html.matchAll(/<a[^>]+href=["'][^"']*["'][^>]*>([^<]{3,60})<\/a>/gi),
			]
				.map((m) => m[1].trim())
				.filter((l) => !l.includes("<") && l.length > 3);
			const uniqueNav = [...new Set(navLinks)].slice(0, 20);

			const keywords = html.match(
				/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i,
			);

			const stripped = html
				.replace(/<script[\s\S]*?<\/script>/gi, "")
				.replace(/<style[\s\S]*?<\/style>/gi, "")
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 1500);

			siteContent = [
				t ? `Title: ${t[1].trim()}` : "",
				d ? `Description: ${d[1].trim()}` : "",
				og && !d ? `Description: ${og[1].trim()}` : "",
				keywords ? `Keywords: ${keywords[1].trim()}` : "",
				headings.length ? `Key headings: ${headings.join(", ")}` : "",
				uniqueNav.length ? `Navigation: ${uniqueNav.join(", ")}` : "",
				`Text: ${stripped}`,
			]
				.filter(Boolean)
				.join("\n");
		} else {
			fetchError = `${res.status}`;
		}
	} catch (err) {
		fetchError = err instanceof Error ? err.message : String(err);
	}

	const brand = brandName || detectedBrand || domain.split(".")[0];
	const competitorList = competitors
		? competitors
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	// If AI binding is not available, return mock prompts
	if (!env.AI) {
		console.log("AI binding not available, using mock prompts");
		return c.json({
			brandName: brand,
			description: `Test prompts for ${domain}`,
			prompts: [
				{ text: `What is ${brand}?`, tag: "Branded" },
				{
					text: `How does ${brand} compare to alternatives?`,
					tag: "Competitive",
				},
				{ text: `What are the key features of ${domain}?`, tag: "Category" },
				{
					text: `Is ${brand} a good choice for my needs?`,
					tag: "Branded",
				},
				{
					text: competitorList.length
						? `Compare ${brand} vs ${competitorList[0]}`
						: `What are alternatives to ${brand}?`,
					tag: "Competitive",
				},
			],
		});
	}

	const prompt = `You are an AI visibility consultant. Generate prompts to test whether AI assistants mention a brand.

Domain: ${domain}
Brand: ${brand}
${competitorList.length ? `Competitors: ${competitorList.join(", ")}` : ""}
${siteContent ? `\nSite content:\n${siteContent}` : `\n(Could not fetch: ${fetchError}. Infer from domain.)`}

Generate 5 prompts. Mix:
1. Branded (1-2): Include "${brand}" directly. Test if AI knows the brand.
2. Category (2-3): Do NOT include brand name. Category questions where ${brand} SHOULD appear.
${competitorList.length ? `3. Competitive (1): Compare ${brand} vs ${competitorList.slice(0, 2).join(" or ")}.` : `3. Competitive (1): Ask about ${brand}'s competitors or alternatives.`}

Be SPECIFIC to the site content. No generic questions.
Respond with ONLY valid JSON:
{"brandName":"${brand}","description":"1 sentence","prompts":[{"text":"question","tag":"Branded|Category|Competitive"}]}`;

	try {
		const response = await env.AI.run(
			SETUP_MODEL as Parameters<Ai["run"]>[0],
			{ messages: [{ role: "user", content: prompt }], max_tokens: 1024 },
			{ gateway: { id: "default" } },
		);

		const text = extractAIText(response);
		let cleaned = text
			.replace(/```json\s*/gi, "")
			.replace(/```\s*/g, "")
			.trim();

		const s = cleaned.search(/[{\[]/);
		const e = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
		if (s >= 0 && e > s) cleaned = cleaned.slice(s, e + 1);

		let parsed: any;
		try {
			parsed = JSON.parse(cleaned);
		} catch {
			// Regex fallback: extract quoted strings that look like questions
			const m = text.match(/"([^"]{15,})"/g);
			const ex = (m ?? [])
				.map((x: string) => x.slice(1, -1))
				.filter(
					(x: string) =>
						x.includes("?") || /^(what|how|compare|which)/i.test(x),
				)
				.slice(0, 5);

			const brandFallback = [
				`What is ${brand} and what does it do?`,
				`Is ${brand} worth using compared to alternatives?`,
				`What are the best alternatives to ${brand}?`,
				...(competitorList.length
					? [`Compare ${brand} vs ${competitorList[0]}`]
					: [`Who are ${brand}'s main competitors?`]),
				`What do users say about ${brand}?`,
			];

			parsed = {
				description: `Website at ${domain}`,
				prompts: (ex.length ? ex : brandFallback).map(
					(t: string, i: number) => ({
						text: t,
						tag:
							["Branded", "Branded", "Category", "Competitive", "Category"][
								i
							] || "Category",
					}),
				),
			};
		}

		if (!Array.isArray(parsed.prompts)) parsed.prompts = [];
		parsed.prompts = parsed.prompts
			.map((p: any) =>
				typeof p === "string"
					? { text: p, tag: "Category" }
					: p && p.text
						? { text: p.text, tag: p.tag || "Category" }
						: null,
			)
			.filter((p: any) => p && p.text.length > 5)
			.slice(0, 5);

		return c.json({
			domain,
			brandName: parsed.brandName || brand,
			...parsed,
			fetchedSite: !fetchError,
		});
	} catch {
		// Complete fallback with brand interpolation
		const fallback: { text: string; tag: string }[] = [
			{ text: `What is ${brand} and what does it do?`, tag: "Branded" },
			{
				text: `Is ${brand} worth using? What are the pros and cons of ${brand}?`,
				tag: "Branded",
			},
			{
				text: `What are the best alternatives to ${brand}?`,
				tag: "Category",
			},
		];

		if (competitorList.length >= 2) {
			fallback.push({
				text: `Compare ${brand} vs ${competitorList[0]} vs ${competitorList[1]}`,
				tag: "Competitive",
			});
			fallback.push({
				text: `Should I use ${competitorList[0]} or ${brand}?`,
				tag: "Competitive",
			});
		} else if (competitorList.length === 1) {
			fallback.push({
				text: `Compare ${brand} vs ${competitorList[0]} — which is better?`,
				tag: "Competitive",
			});
			fallback.push({
				text: `What can ${brand} do that ${competitorList[0]} can't?`,
				tag: "Competitive",
			});
		} else {
			fallback.push({
				text: `Who are ${brand}'s main competitors?`,
				tag: "Competitive",
			});
			fallback.push({
				text: `What do users say about ${brand}? Is ${brand} reliable?`,
				tag: "Category",
			});
		}

		return c.json({
			domain,
			brandName: brand,
			description: `Website at ${domain}`,
			prompts: fallback.slice(0, 5),
			fetchedSite: false,
		});
	}
}

// ── AI text extraction ─────────────────────────────────────────────────────

function extractAIText(r: any): string {
	if (typeof r === "string") return r;
	if (!r || typeof r !== "object") return String(r);

	// Workers AI: { response: "..." }
	if ("response" in r && typeof r.response === "string") return r.response;

	// OpenAI/Anthropic: { choices: [{ message: { content: "..." } }] }
	if (r.choices && Array.isArray(r.choices)) {
		for (const choice of r.choices) {
			const msg = choice.message ?? choice.delta;
			if (msg?.content && typeof msg.content === "string") return msg.content;
			if (msg?.reasoning_content && typeof msg.reasoning_content === "string")
				return msg.reasoning_content;
		}
	}

	// Gemini: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
	if (r.candidates && Array.isArray(r.candidates)) {
		const t = r.candidates[0]?.content?.parts?.[0]?.text;
		if (t) return t;
	}

	// Anthropic messages: { content: [{ type: "text", text: "..." }] }
	if (Array.isArray(r.content)) {
		const tb = r.content.find((b: any) => b.type === "text" && b.text);
		if (tb) return tb.text;
	}

	// Last resort: regex
	const s = JSON.stringify(r);
	const m = s.match(/"(?:content|text)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
	if (m) return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
	return s;
}

// ── Chat endpoints ─────────────────────────────────────────────────────────────

apiRoutes.get("/chat/session", async (c) => {
	// Get or create chat session
	const sessionId = c.req.query("session") || crypto.randomUUID();
	const raw = await c.env.AEO_KV.get(`chat:${sessionId}`, "json") as ChatSession | null;
	
	if (raw) {
		return c.json({ sessionId, ...raw });
	}
	
	const session: ChatSession = { messages: [] };
	await c.env.AEO_KV.put(`chat:${sessionId}`, JSON.stringify(session), {
		expirationTtl: CHAT_CONFIG.session.ttlSeconds,
	});
	
	return c.json({ sessionId, ...session });
});

apiRoutes.post("/chat/message", async (c) => {
	const body = await c.req.json<{
		sessionId: string;
		message: string;
		vehicleContext?: string;
	}>();
	
	const { sessionId, message, vehicleContext } = body;
	if (!sessionId || !message) return c.json({ error: "Missing sessionId or message" }, 400);
	
	const raw = await c.env.AEO_KV.get(`chat:${sessionId}`, "json") as ChatSession | null;
	const session: ChatSession = raw || { messages: [] };
	
	session.messages.push({
		id: crypto.randomUUID(),
		role: "user",
		content: message,
		timestamp: new Date().toISOString(),
	});
	
	// 1. Analyze if web search is needed
	const needSearch = await determineIfSearchNeeded(c.env.AI, message, vehicleContext || "");
	let webData = "";
	let imageUrl = null;

	if (needSearch && c.env.SERPAPI_KEY) {
		// Try to get cached image
		const cacheKey = `img-cache:${btoa(message + (vehicleContext || ""))}`;
		imageUrl = await c.env.AEO_KV.get(cacheKey);

		if (!imageUrl) {
			webData = await webSearch(message + " " + (vehicleContext || ""), c.env.SERPAPI_KEY);
			imageUrl = await getPartsDiagramUrl(message + " " + (vehicleContext || ""), c.env.SERPAPI_KEY);
			
			if (imageUrl) {
				await c.env.AEO_KV.put(cacheKey, imageUrl, { expirationTtl: 604800 }); // 7 days
			}
		}
	}

	// 2. AI Analysis, Response Generation, and Insight Extraction
	const { responseText, technicalInsight } = await generateAndLearn(
		c.env.AI, 
		message, 
		vehicleContext || "", 
		webData,
		imageUrl,
        c.env.GROQ_API_KEY
	);

	// 3. Save Technical Insight if valid
	if (technicalInsight) {
		await saveNewTechnicalKnowledge(c.env.AEO_KV, technicalInsight);
	}
	
	const assistantMsg: ChatMessage = {
		id: crypto.randomUUID(),
		role: "assistant",
		content: responseText,
		timestamp: new Date().toISOString(),
	};
	session.messages.push(assistantMsg);
	
	await c.env.AEO_KV.put(`chat:${sessionId}`, JSON.stringify(session), {
		expirationTtl: CHAT_CONFIG.session.ttlSeconds,
	});
	
	return c.json({ sessionId, message: assistantMsg });
});

// --- Helper Functions ---

async function getPartsDiagramUrl(query: string, apiKey: string): Promise<string | null> {
    const searchQuery = `${query} suparat.net parts diagram`;
    const params = new URLSearchParams({
        q: searchQuery,
        tbm: "isch",
        api_key: apiKey
    });
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json() as any;
        return data.images_results?.[0]?.original || null;
    } catch {
        return null;
    }
}

async function determineIfSearchNeeded(ai: Ai, query: string, context: string): Promise<boolean> {
	if (!ai) return false;
	const prompt = `Context: ${context}\nQuery: ${query}\nDoes this query require real-time technical info or a parts diagram from the web? Reply ONLY "yes" or "no".`;
	const res = await ai.run(CHAT_CONFIG.model.id as any, { messages: [{ role: "user", content: prompt }] });
	return extractAIText(res).toLowerCase().includes("yes");
}

import { Groq } from 'groq-sdk';

async function generateAndLearn(ai: Ai, query: string, context: string, webData: string, imageUrl: string | null, groqApiKey?: string) {
    const prompt = `You are MotorBoy-AI (บอย อะไหล่ยนต์), expert mechanic.
Context: ${context}
Query: ${query}
Web Data: ${webData}
Parts Diagram URL: ${imageUrl || "None"}

Perform two tasks:
1. Provide a direct, casual, technical repair response. If a Parts Diagram URL is provided, include it in the response as an image link: ![Parts Diagram](${imageUrl}).
2. Analyze the Web Data. If it contains a RARE or UNIQUE technical repair technique, insight, or fix NOT widely known, extract it for the knowledge base.

Respond in JSON ONLY:
{
    "answer": "Repair response here (include image markdown if diagram is provided)",
    "technicalInsight": "Unique technical insight or null if none found"
}`;

    const messages = [{ role: "user", content: prompt }];

    // 1. Try Cloudflare Workers AI
    if (ai) {
        try {
            const isWorkersAI = CHAT_CONFIG.model.id.startsWith("@cf/");
            const res = await ai.run(CHAT_CONFIG.model.id as any, { 
                messages, 
                max_tokens: CHAT_CONFIG.model.maxTokens 
            }, isWorkersAI ? undefined : { gateway: { id: "default" } });
            
            const text = extractAIText(res);
            return parseAIResponse(text);
        } catch (e) {
            console.error("Workers AI failed, falling back to Groq:", e);
        }
    }

    // 2. Fallback to Groq
    if (groqApiKey) {
        try {
            const groq = new Groq({ apiKey: groqApiKey });
            const res = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "qwen-2.5-32b", // Using Qwen 2.5 32B as requested
                temperature: 0.6,
            });
            const text = res.choices[0]?.message?.content || "";
            return parseAIResponse(text);
        } catch (e) {
            console.error("Groq fallback also failed:", e);
        }
    }

    return { responseText: "ขอโทษครับ ระบบ AI ตอนนี้ไม่สามารถใช้งานได้ กรุณาลองใหม่อีกครั้ง", technicalInsight: null };
}

// Helper to parse the JSON response from AI
function parseAIResponse(text: string) {
    try {
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        return { responseText: parsed.answer, technicalInsight: parsed.technicalInsight };
    } catch {
        return { responseText: text, technicalInsight: null };
    }
}

async function saveNewTechnicalKnowledge(kv: KVNamespace, insight: string) {
	const id = crypto.randomUUID();
	await kv.put(`tech-insight:${id}`, JSON.stringify({
		timestamp: new Date().toISOString(),
		content: insight
	}));
}

apiRoutes.get("/chat/vehicles", async (c) => {
	// Return vehicle types and repair categories for the chat UI
	const { VEHICLE_TYPES, REPAIR_CATEGORIES } = await import("../src/chat-config");
	return c.json({
		vehicleTypes: VEHICLE_TYPES,
		repairCategories: REPAIR_CATEGORIES,
	});
});

// ── Telegram endpoints ─────────────────────────────────────────────────────────

apiRoutes.post("/telegram/webhook", async (c) => {
	const update = await c.req.json<any>();
	const tgConfig = getTelegramConfig(c.env as TelegramEnv);
	
	if (!tgConfig.botToken) {
		return new Response("Unauthorized", { status: 401 });
	}
	
	const message = update.message || update.edited_message;
	if (!message) return new Response("OK");
	
	const chatId = message.chat.id;
	const text = message.text || "";
	
	// Check allowed chats
	if (tgConfig.allowedChats.length > 0 && !tgConfig.allowedChats.includes(chatId)) {
		return new Response("Forbidden", { status: 403 });
	}
	
	// Handle /start command
	if (text === "/start") {
		await sendTelegramMessage(tgConfig.botToken, chatId, `สวัสดี! ฉันคือผู้ช่วยช่างซ่อมรถ 🚗🔧\n\n${CHAT_CONFIG.disclaimer}`);
		return new Response("OK");
	}
	
	// Handle chat messages
	if (text) {
		const sessionId = `tg:${chatId}`;
		const raw = await c.env.AEO_KV.get(`chat:${sessionId}`, "json") as ChatSession | null;
		const session: ChatSession = raw || { messages: [] };
		
		// Add user message
		session.messages.push({
			id: crypto.randomUUID(),
			role: "user",
			content: text,
			timestamp: new Date().toISOString(),
		});
		
		// Generate AI response
		let responseText = "";
		if (c.env.AI) {
			try {
				const isWorkersAI = CHAT_CONFIG.model.id.startsWith("@cf/");
				const input: any = {
					messages: [
						{ role: "system", content: CHAT_CONFIG.systemPrompt },
						...session.messages.map((m) => ({ role: m.role, content: m.content })),
					],
					max_tokens: CHAT_CONFIG.model.maxTokens,
				};
				if (CHAT_CONFIG.model.temperature) {
					input.temperature = CHAT_CONFIG.model.temperature;
				}
				const response = await c.env.AI.run(
					CHAT_CONFIG.model.id as Parameters<Ai["run"]>[0],
					input,
					isWorkersAI ? undefined : { gateway: { id: "default" } },
				);
				responseText = extractAIText(response);
			} catch {
				responseText = "เกิดข้อผิดพลาด กรุณาลองใหม่";
			}
		} else {
			responseText = "โหมดจำลอง: " + text;
		}
		
		// Add and save assistant message
		session.messages.push({
			id: crypto.randomUUID(),
			role: "assistant",
			content: responseText,
			timestamp: new Date().toISOString(),
		});
		
		await c.env.AEO_KV.put(`chat:${sessionId}`, JSON.stringify(session), {
			expirationTtl: CHAT_CONFIG.session.ttlSeconds,
		});
		
		await sendTelegramMessage(tgConfig.botToken, chatId, responseText);
	}
	
	return new Response("OK");
});

apiRoutes.post("/telegram/webhook/setup", async (c) => {
	const tgConfig = getTelegramConfig(c.env as TelegramEnv);
	
	if (!tgConfig.botToken) {
		return c.json({ error: "Telegram not configured" }, 500);
	}
	
	if (!tgConfig.webhookUrl) {
		return c.json({ error: "Webhook URL not configured" }, 400);
	}
	
	try {
		const response = await fetch(
			`https://api.telegram.org/bot${tgConfig.botToken}/setWebhook`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: tgConfig.webhookUrl }),
			},
		);
		
		const result = await response.json();
		return c.json(result);
	} catch (err) {
		return c.json({ error: String(err) }, 500);
	}
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function sendTelegramMessage(
	botToken: string,
	chatId: number | string,
	text: string,
) {
	await fetch(
		`https://api.telegram.org/bot${botToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				text: text,
				parse_mode: "HTML",
			}),
		},
	);
}
