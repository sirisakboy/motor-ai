import { Outlet } from "react-router";

export default function GarageLayout() {
	return (
		<div className="flex min-h-screen bg-[#0b0d10] text-zinc-100 overflow-hidden">
			{/* Sidebar */}
			<aside className="w-[300px] h-screen bg-[#111418] border-r border-zinc-800 flex flex-col shrink-0">
				<div className="h-[6px] hazard shrink-0"></div>
				<div className="p-4 flex items-center gap-3 border-b border-zinc-800">
					<div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center -rotate-6 shadow-[3px_3px_0_#000]">🔧</div>
					<div>
						<div className="display font-black text-[20px] tracking-wide leading-none">MotorBoy<span className="text-orange-500">-AI</span></div>
						<div className="text-[10px] tracking-[0.18em] uppercase text-orange-400 font-bold mt-1">บอย อะไหล่ยนต์</div>
					</div>
					<div className="ml-auto bg-black border border-yellow-400 text-yellow-400 text-[9px] font-black px-2 py-1 rounded-full rotate-[12deg]">100% ซิ่ง</div>
				</div>
                <div className="flex-1 overflow-y-auto p-3">
                    {/* Navigation items will be added here */}
                </div>
			</aside>

			{/* Main */}
			<main className="flex-1 flex flex-col min-w-0">
				<header className="h-[64px] bg-[#111418]/90 backdrop-blur border-b border-zinc-800 flex items-center px-5 shrink-0 sticky top-0 z-20">
                    <span className="display font-black text-[18px]">GARAGE DASHBOARD</span>
                </header>
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
			</main>
		</div>
	);
}
