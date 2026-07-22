import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { apiRoutes } from "./api";
import { queueConsumer } from "./queue";

type Env = {
	AI: Ai;
	AEO_KV: KVNamespace;
	BRAND_VISIBILITY_QUEUE: Queue;
	TARGET_DOMAIN: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_WEBHOOK_URL?: string;
	TELEGRAM_ALLOWED_CHATS?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Honey-pot/Trap middleware
const TRAP_PATHS = ["/admin", "/.env", "/.git", "/config", "/debug", "/login", "/wp-login.php"];

app.use("*", async (c, next) => {
	if (TRAP_PATHS.some((path) => c.req.path.startsWith(path))) {
		console.warn(
			`SECURITY_ALERT: HoneyPot hit from ${c.req.header("cf-connecting-ip") || "unknown-ip"} on ${c.req.path}`,
		);
		return c.text("Unauthorized access.", 403);
	}
	await next();
});

// API routes
app.route("/api", apiRoutes);

// SSR catch-all — React Router handles everything else
app.get("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);
	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

export default {
	fetch: app.fetch,
	queue: queueConsumer,
};
