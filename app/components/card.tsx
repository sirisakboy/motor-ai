import type { ReactNode } from "react";

export function Card({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`w-full text-base border-2 border-zinc-800 rounded-2xl shadow-[6px_6px_0_#000] bg-[#111418] overflow-hidden ${className}`}
		>
			{children}
		</div>
	);
}

export function CardHeader({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`px-4 py-3 font-black text-zinc-100 flex items-center justify-between text-base border-b border-zinc-800 ${className}`}
		>
			{children}
		</div>
	);
}

export function CardTitle({
	title,
	description,
	actions,
	className = "",
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`px-4 py-3 flex items-center text-base border-b border-zinc-800 relative ${className}`}
		>
			<div className="flex flex-col gap-1 relative">
				<div
					role="heading"
					aria-level={2}
					className="text-[17px]/[1.25] font-black text-white flex items-center gap-1"
				>
					{title}
				</div>
				{description && (
					<div className="text-sm text-zinc-400">{description}</div>
				)}
			</div>
			{actions && (
				<span className="ml-auto flex items-center gap-2 shrink-0">
					{actions}
				</span>
			)}
		</div>
	);
}

export function CardBody({
	children,
	flush = false,
	className = "",
}: {
	children: ReactNode;
	flush?: boolean;
	className?: string;
}) {
	return (
		<div className={`${flush ? "p-0 overflow-hidden" : "p-4"} ${className}`}>
			{children}
		</div>
	);
}
