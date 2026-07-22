import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<table className={`w-full border-collapse text-[13px] ${className}`}>
			{children}
		</table>
	);
}

export function Thead({ children }: { children: ReactNode }) {
	return <thead className="bg-[#111418]">{children}</thead>;
}

export function Th({
	children,
	className = "",
	...props
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
	return (
		<th
			className={`text-left px-4 py-3 font-black text-[11px] uppercase tracking-[0.1em] text-zinc-500 border-b border-zinc-800 ${className}`}
			{...props}
		>
			{children}
		</th>
	);
}

export function Td({
	children,
	className = "",
	...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
	return (
		<td
			className={`px-4 h-[52px] align-middle border-b border-zinc-800 text-zinc-300 ${className}`}
			{...props}
		>
			{children}
		</td>
	);
}

export function Tr({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<tr className={`hover:bg-[#1a1f26] transition-colors ${className}`}>
			{children}
		</tr>
	);
}
