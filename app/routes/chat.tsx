import { useState, useRef, useEffect } from "react";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: string;
    image?: string;
};

export default function Chat() {
	const [sessionId, setSessionId] = useState<string>("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState("มอเตอร์ไซค์");
	
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const stored = sessionStorage.getItem("chat-session-id");
		const id = stored || crypto.randomUUID();
		if (!stored) sessionStorage.setItem("chat-session-id", id);
		setSessionId(id);
		
		fetch(`/api/chat/session?session=${id}`)
			.then((r) => r.json())
			.then((data) => {
				setMessages(data.messages || []);
			})
			.catch(() => setMessages([]));
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const sendMessage = async (content: string) => {
		if (!content.trim() || !sessionId) return;
		
		setLoading(true);
		setInput("");
        
        const userMsg = { role: "user", content, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
		
		try {
			const response = await fetch("/api/chat/message", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					message: content,
                    vehicleContext: selectedVehicle
				}),
			});
			
			const data = await response.json();
			if (data.message) {
				setMessages((prev) => [...prev, data.message]);
			}
		} catch (err) {
			console.error("Send failed:", err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex-1 flex flex-col min-w-0 relative h-full">
            <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#111418]">
                <div className="flex gap-2">
                    {["มอเตอร์ไซค์", "จักรยาน/ไฟฟ้า"].map(v => (
                        <button 
                            key={v}
                            onClick={() => setSelectedVehicle(v)}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${selectedVehicle === v ? 'bg-orange-500 border-orange-500 text-black' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </header>

            <div id="messages" className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full px-3 md:px-6 py-6 md:py-8 pb-28">
                    {messages.length === 0 ? (
                        <div className="mt-6 md:mt-12 flex flex-col items-center text-center">
                            <div className="relative">
                                <div className="w-[132px] h-[132px] rounded-[24px] bg-[#161a1f] border-2 border-zinc-800 shadow-[6px_6px_0_#000] flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 checker opacity-60"></div>
                                    <div className="relative z-10 w-[68px] h-[68px] rounded-[16px] bg-orange-500 border-2 border-black flex items-center justify-center shadow-[3px_3px_0_#000]">🔧</div>
                                </div>
                            </div>
                            <h1 className="display mt-8 text-[32px] font-[800] leading-[0.9] -skew-x-3">
                                <span className="text-white">ถามช่าง</span> <span className="text-orange-500">MOTORBOY</span><br/>
                                <span className="text-zinc-400 text-[22px] font-bold">ตอบสไตล์อู่ซิ่ง ({selectedVehicle})</span>
                            </h1>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((m) => (
                                <div key={m.id} className={`msg-bubble flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[86%] rounded-[18px] border px-4 py-3 shadow-[3px_3px_0_#000] ${m.role === 'user' ? 'bg-orange-500 border-black text-black' : 'bg-[#161a1f] border-zinc-700 text-zinc-100'}`}>
                                        <div className="whitespace-pre-wrap text-[14px] leading-6 font-medium">{m.content}</div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="msg-bubble flex justify-start">
                                    <div className="bg-[#161a1f] border border-zinc-700 rounded-[18px] px-4 py-3 shadow-[3px_3px_0_#000]">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse delay-75"></div>
                                            <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse delay-150"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            <div className="sticky bottom-0 z-20 bg-gradient-to-t from-[#0b0d10] via-[#0b0d10]/95 to-transparent pt-6">
                <div className="max-w-3xl mx-auto w-full px-3 md:px-6 pb-4">
                    <div className="flex items-end gap-2 bg-[#161a1f] border border-zinc-700 rounded-[22px] p-2 focus-within:border-orange-500 shadow-[4px_4px_0_#000]">
                        <textarea 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={`พิมพ์ถามช่างซิ่งเกี่ยวกับ ${selectedVehicle}...`} 
                            className="flex-1 bg-transparent outline-none resize-none min-h-[44px] max-h-[140px] py-3 px-2 text-[14px] placeholder:text-zinc-500"
                        />
                        <button 
                            onClick={() => sendMessage(input)}
                            disabled={loading || !input.trim()}
                            className="w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-400 text-black flex items-center justify-center shadow-[0_0_0_2px_#000] disabled:opacity-50 shrink-0">
                            ↑
                        </button>
                    </div>
                </div>
            </div>
        </div>
	);
}