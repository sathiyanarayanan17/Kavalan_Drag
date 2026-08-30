"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
	const router = useRouter();
	const search = useSearchParams();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error ?? "Login failed");
			}
			const from = search?.get("from") || "/";
			router.push(from);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "var(--bg, #0a0a0f)",
			}}
		>
			<form
				onSubmit={submit}
				style={{
					width: 340,
					border: "1px solid var(--border, #333)",
					borderRadius: 6,
					padding: 24,
					background: "var(--bg-surface-1, #12121a)",
				}}
			>
				<h1
					className="font-mono"
					style={{
						fontSize: 18,
						color: "var(--amber, #b8860b)",
						marginBottom: 4,
						letterSpacing: "0.1em",
					}}
				>
					KAVALAN
				</h1>
				<p
					className="font-mono"
					style={{ fontSize: 11, color: "var(--text-dim, #888)", marginBottom: 20 }}
				>
					FORENSIC INTELLIGENCE · SIGN IN
				</p>

				<label className="font-mono" style={{ fontSize: 10, color: "var(--text-dim,#888)" }}>
					USERNAME
				</label>
				<input
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					autoComplete="username"
					style={inputStyle}
				/>

				<label className="font-mono" style={{ fontSize: 10, color: "var(--text-dim,#888)" }}>
					PASSWORD
				</label>
				<input
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					autoComplete="current-password"
					style={inputStyle}
				/>

				{error && (
					<p className="font-mono" style={{ fontSize: 11, color: "#e05a5a", marginBottom: 10 }}>
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={loading}
					style={{
						width: "100%",
						padding: "8px",
						marginTop: 6,
						background: "var(--amber, #b8860b)",
						color: "#000",
						border: "none",
						borderRadius: 4,
						fontFamily: "monospace",
						fontSize: 12,
						cursor: loading ? "not-allowed" : "pointer",
						letterSpacing: "0.08em",
					}}
				>
					{loading ? "SIGNING IN..." : "SIGN IN"}
				</button>

				<p
					className="font-mono"
					style={{ fontSize: 10, color: "var(--text-muted,#666)", marginTop: 16, lineHeight: 1.6 }}
				>
					Demo accounts:<br />
					supervisor / supervisor (full)<br />
					analyst / analyst (run analyses)<br />
					viewer / viewer (read-only)
				</p>
			</form>
		</div>
	);
}

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "8px",
	marginTop: 4,
	marginBottom: 14,
	background: "var(--bg-surface-2, #1a1a24)",
	border: "1px solid var(--border, #333)",
	borderRadius: 4,
	color: "var(--text-data, #ddd)",
	fontFamily: "monospace",
	fontSize: 13,
};

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div
					style={{
						minHeight: "100vh",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "var(--bg, #0a0a0f)",
						color: "var(--text-dim, #888)",
						fontFamily: "monospace",
						fontSize: 12,
					}}
				>
					LOADING...
				</div>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
