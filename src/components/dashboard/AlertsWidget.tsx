"use client";

import { useEffect, useState } from "react";

interface Alert {
	type: string;
	caseId: string;
	caseRef: string;
	message: string;
}

export default function AlertsWidget() {
	const [alerts, setAlerts] = useState<Alert[]>([]);
	const [batchMsg, setBatchMsg] = useState<string | null>(null);
	const [running, setRunning] = useState(false);

	const load = () => {
		fetch("/api/alerts")
			.then((r) => r.json())
			.then((d) => setAlerts(d.alerts ?? []))
			.catch(() => {});
	};

	useEffect(() => {
		load();
	}, []);

	const runBatch = async () => {
		setRunning(true);
		setBatchMsg(null);
		try {
			const res = await fetch("/api/analyze/batch", { method: "POST" });
			const d = await res.json();
			setBatchMsg(
				`Triaged ${d.analyzed} cases — ${d.critical} CRITICAL, ${d.high} HIGH.`,
			);
			load();
		} catch {
			setBatchMsg("Batch triage failed.");
		} finally {
			setRunning(false);
		}
	};

	return (
		<div className="bg-surface-1" style={{ border: "1px solid var(--border)", borderRadius: 4 }}>
			<div className="px-5 py-3 border-b border-border-DEFAULT flex items-center justify-between">
				<p className="font-mono text-xs uppercase tracking-wider text-dim">ALERTS</p>
				<button
					onClick={runBatch}
					disabled={running}
					className="font-mono text-xs uppercase tracking-wider"
					style={{
						color: running ? "var(--text-muted)" : "var(--amber)",
						background: "transparent",
						border: "1px solid var(--amber-border, #66512a)",
						borderRadius: 3,
						padding: "3px 10px",
						cursor: running ? "not-allowed" : "pointer",
					}}
				>
					{running ? "TRIAGING..." : "BATCH TRIAGE"}
				</button>
			</div>
			<div className="p-4">
				{batchMsg && (
					<p className="font-mono text-xs mb-3" style={{ color: "var(--low,#5ae0a0)" }}>{batchMsg}</p>
				)}
				{alerts.length === 0 ? (
					<p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>No active alerts.</p>
				) : (
					<ul className="list-none m-0 p-0 flex flex-col gap-2">
						{alerts.map((a, i) => (
							<li key={i}>
								<a
									href={`/cases/${a.caseId}`}
									className="font-sans text-xs"
									style={{
										color: a.type === "CUSTODY_BREACH" ? "var(--critical,#e05a5a)" : "var(--high,#e0a05a)",
									}}
								>
									{a.type === "CUSTODY_BREACH" ? "⚠ " : "● "}
									{a.message}
								</a>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
