/**
 * AI Car Repair Chat — Configuration
 *
 * Configuration for the car repair assistant chat system.
 */

export type VehicleType = {
	id: string;
	name: string;
	brands: string[];
	commonModels: string[];
};

export type RepairCategory = {
	id: string;
	name: string;
	icon: string;
	promptTemplate: string;
};

export const VEHICLE_TYPES: VehicleType[] = [
	{
		id: "car",
		name: "รถยนต์",
		brands: ["Toyota", "Honda", "Nissan", "Mazda", "Mitsubishi", "Ford", "Chevrolet", "Tesla", "BYD"],
		commonModels: ["Corolla", "Civic", "Altis", "Mazda 3", "Model 3", "Atto 3"],
	},
	{
		id: "ev",
		name: "รถยนต์ไฟฟ้า (EV)",
		brands: ["Tesla", "BYD", "MG", "Ora", "Neta"],
		commonModels: ["Model Y", "Dolphin", "ZS EV", "Good Cat"],
	},
	{
		id: "motorcycle",
		name: "มอเตอร์ไซค์",
		brands: ["Honda", "Yamaha", "Kawasaki", "Ducati", "BMW"],
		commonModels: ["Wave", "PCX", "R15", "Monster", "S1000RR"],
	},
	{
		id: "electric-bike",
		name: "จักรยานไฟฟ้า",
		brands: ["Xiaomi", "Decathlon", "E-Bike"],
		commonModels: ["Himo", "City", "Mountain"],
	},
];

export const REPAIR_CATEGORIES: RepairCategory[] = [
	{
		id: "engine",
		name: "เครื่องยนต์",
		icon: "🔧",
		promptTemplate: "วิธีซ่อมเครื่องยนต์ {vehicle} ที่มีอาการ {symptom}",
	},
	{
		id: "brake",
		name: "ระบบเบรก",
		icon: "🛑",
		promptTemplate: "วิธีซ่อมระบบเบรก {vehicle} ที่มีอาการ {symptom}",
	},
	{
		id: "electrical",
		name: "ระบบไฟฟ้า",
		icon: "⚡",
		promptTemplate: "วิธีซ่อมระบบไฟฟ้า {vehicle} ที่มีอาการ {symptom}",
	},
	{
		id: "suspension",
		name: "ระบบสปริง/โช๊ว",
		icon: "🔩",
		promptTemplate: "วิธีซ่อมระบบโช๊ว {vehicle} ที่มีอาการ {symptom}",
	},
	{
		id: "ac",
		name: "ระบบทำความเย็น",
		icon: "❄️",
		promptTemplate: "วิธีซ่อมแอร์ {vehicle} ที่มีอาการ {symptom}",
	},
	{
		id: "tire",
		name: "ยางและล้อ",
		icon: "🛞",
		promptTemplate: "วิธีซ่อมหรือปลูกยาง {vehicle} ที่มีอาการ {symptom}",
	},
];

export const CHAT_CONFIG = {
	// Model settings for car repair chat
	model: {
		id: "@cf/meta/llama-4-scout-17b-16e-instruct",
		maxTokens: 1024,
	},
	
	// System prompt for car repair specialist
	systemPrompt: `คุณคือช่างซ่อมยานยนต์และวิศวกรเครื่องยนต์มืออาชีพ ตอบคำถามสำหรับช่างเทคนิคเท่านั้น
- ใช้ศัพท์เทคนิคเฉพาะทาง (Technical Terminology) และขั้นตอนการวินิจฉัย (Diagnostic Procedures) ที่แม่นยำ
- ระบุตำแหน่งชิ้นส่วน (Component Location), รหัสอะไหล่ (ถ้ามี), และเครื่องมือที่ใช้ (Tooling) ให้ชัดเจน
- หากเป็นการโมดิฟาย (Modification) ให้ยึดหลักวิศวกรรมและความทนทาน
- เมื่อได้รับภาพ ให้วิเคราะห์เชิงลึก (Deep Analysis) ด้านโครงสร้าง เส้นสาย และความสมดุลของการตกแต่ง
- การแนะนำอะไหล่: ระบุชื่ออะไหล่ภาษาอังกฤษหรือรหัสมาตรฐาน พร้อมคำค้นหาหรือลิงค์ที่ตรงประเด็น
- ตอบตรงประเด็น (Direct & Technical) ไม่ต้องมีคำเกริ่นนำ หรือคำเตือนสำหรับผู้ใช้ทั่วไป ให้คำแนะนำที่เหมาะสมสำหรับช่างเท่านั้น`,
	
	// Quick reply suggestions
	quickReplies: [
		"เครื่องยนต์มีเสียงแปลกๆ",
		"แต่งภายนอกยังไงให้สวย",
		"แนะนำอะไหล่รถรุ่นนี้",
		"ปัญหาแบตเตอรี่รถไฟฟ้า",
		"ปรับแต่งประสิทธิภาพมอเตอร์ไซค์",
		"ตรวจเช็คเบื้องต้นก่อนเดินทางไกล",
	],
	
	// Session settings
	session: {
		maxHistory: 50,
		ttlSeconds: 3600,
	},
	
	// Safety disclaimer
	disclaimer: `⚠️ คำแนะนำนี้สำหรับช่างเทคนิคที่มีประสบการณ์เท่านั้น ผู้ใช้งานต้องรับผิดชอบต่อการตรวจสอบความปลอดภัยและความเหมาะสมของอะไหล่หรือการปรับแต่งตามมาตรฐานวิศวกรรม`,
};

export type ChatConfig = typeof CHAT_CONFIG;