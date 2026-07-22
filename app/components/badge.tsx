import type { ReactNode } from "react";

type BadgeVariant =
	| "openai"
	| "anthropic"
	| "google"
	| "workers-ai"
	| "meta"
	| "mistral"
	| "category"
	| "success"
	| "danger";

const variants: Record<BadgeVariant, string> = {
	openai: "bg-green-950 text-green-300 ring-1 ring-green-800/50",
	anthropic: "bg-orange-950 text-orange-300 ring-1 ring-orange-800/50",
	google: "bg-blue-950 text-blue-300 ring-1 ring-blue-800/50",
	"workers-ai": "bg-amber-950 text-amber-300 ring-1 ring-amber-800/50",
	meta: "bg-indigo-950 text-indigo-300 ring-1 ring-indigo-800/50",
	mistral: "bg-amber-950 text-amber-300 ring-1 ring-amber-800/50",
	category: "bg-zinc-800 text-zinc-300",
	success: "bg-green-950 text-green-300",
	danger: "bg-red-950 text-red-300",
};

export function Badge({
	variant = "category",
	children,
}: {
	variant?: BadgeVariant;
	children: ReactNode;
}) {
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${variants[variant] ?? variants.category}`}
		>
			{children}
		</span>
	);
}

export function providerBadgeVariant(provider: string): BadgeVariant {
	if (provider in variants) return provider as BadgeVariant;
	return "category";
}

export function providerLabel(provider: string): string {
	const labels: Record<string, string> = {
		openai: "OpenAI",
		anthropic: "Anthropic",
		google: "Google",
		"workers-ai": "Workers AI",
		meta: "Meta",
		mistral: "Mistral",
	};
	return labels[provider] ?? provider;
}
