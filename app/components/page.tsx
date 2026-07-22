import type { ReactNode } from "react";

export function PageHeader({
	title,
	subtitle,
	actions,
	children,
}: {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="max-w-[1400px] mx-auto w-full px-6 lg:px-10 pt-8 lg:pt-10">
			<h1 className="display text-[32px] font-black text-white mb-1 tracking-wide">{title}</h1>
			{subtitle && (
				<p className="text-[14px] text-zinc-400 mb-6">{subtitle}</p>
			)}
			{actions && <div className="flex items-center gap-2 mb-6">{actions}</div>}
			{children}
		</div>
	);
}

export function PageBody({ children }: { children: ReactNode }) {
	return (
		<div className="max-w-[1400px] mx-auto w-full px-6 lg:px-10 pb-10 flex flex-col gap-6">
			{children}
		</div>
	);
}
