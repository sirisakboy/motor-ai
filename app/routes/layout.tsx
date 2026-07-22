import { Outlet, NavLink } from "react-router";
import { ChatCircleDots, ListBullets, Cube, Gear, ChartBar } from "@phosphor-icons/react";

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
                
                <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    {[
                        { to: "/", label: "Dashboard", icon: <ChartBar size={20} /> },
                        { to: "/chat", label: "แชทซิ่ง", icon: <ChatCircleDots size={20} /> },
                        { to: "/prompts", label: "Prompts", icon: <ListBullets size={20} /> },
                        { to: "/models", label: "Models", icon: <Cube size={20} /> },
                        { to: "/setup", label: "ตั้งค่าอู่", icon: <Gear size={20} /> },
                    ].map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                                    isActive
                                        ? "bg-orange-500 text-black shadow-[4px_4px_0_#000]"
                                        : "text-zinc-400 hover:bg-[#1a1f26] hover:text-white"
                                }`
                            }
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
			</aside>

			{/* Main */}
			<main className="flex-1 flex flex-col min-w-0">
				<header className="h-[64px] bg-[#111418]/90 backdrop-blur border-b border-zinc-800 flex items-center px-5 shrink-0 sticky top-0 z-20">
                    <span className="display font-black text-[18px]">บอย อะไหล่ยนต์ - แผงควบคุม</span>
                </header>
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
			</main>
		</div>
	);
}
