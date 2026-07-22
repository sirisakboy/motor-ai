import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="th" className="h-full">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>MotorBoy-AI - บอย อะไหล่ยนต์</title>
				<link rel="icon" type="image/png" href="/logo.png" />
				<Meta />
				<Links />
			</head>
			<body className="h-full">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
