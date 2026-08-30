"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CustodyRecord {
	id: string;
	seq: number;
	action: string;
	detail: string;
	actor: string;
	createdAt: string;
	prevHash: string;
	hash: string;
}
interface CustodyData {
	integrity: { intact: boolean; length: number; brokenAtSeq?: number; reason?: string };
	chain: CustodyRecord[];
}

export default function CustodyPage() {
	const params = useParams<{ id: string }>();
	const id = params?.id;
	const [data, setData] = useState<CustodyData | null>(null);

	useEffect(() => {
		if (!id) return;
		fetch(`/api/cases/${id}/custody`)
			.then((r) => r.json())
			.then(setData)
			.catch(() => {});
	}, [id]);

	return (
		<div className="p-6">
			<h2 className="font-mono text-xs uppercase mb-1" style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}>
				CHAIN OF CUSTODY
			</h2>
			<p className="font-mono text-xs mb-6" style={{ color: "var(--text-muted)" }}>
				Tamper-evident audit trail. Each record&apos;s hash includes the previous record&apos;s hash (SHA-256).
			</p>

			{data && (
				<div
					className="font-mono text-xs mb-6 p-3"
					style={{
						border: `1px solid ${data.integrity.intact ? "var(--low,#5ae0a0)" : "var(--critical,#e05a5a)"}`,
						borderRadius: 4,
						color: data.integrity.intact ? "var(--low,#5ae0a0)" : "var(--critical,#e05a5a)",
					}}
				>
					{data.integrity.intact
						? `● CHAIN INTACT — ${data.integrity.length} record(s) verified`
						: `⚠ CHAIN BROKEN at seq ${data.integrity.brokenAtSeq} — ${data.integrity.reason}`}
				</div>
			)}

			{data && data.chain.length === 0 && (
				<p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
					No custody records yet. Run an analysis to begin the chain.
				</p>
			)}

			<div className="flex flex-col gap-2">
				{data?.chain.map((r) => (
					<div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 12, background: "var(--bg-surface-1)" }}>
						<div className="flex justify-between mb-1">
							<span className="font-mono text-xs" style={{ color: "var(--amber-dim)" }}>#{r.seq} · {r.action}</span>
							<span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{new Date(r.createdAt).toLocaleString()}</span>
						</div>
						<p className="font-sans text-xs mb-1" style={{ color: "var(--text-data)" }}>{r.detail}</p>
						<p className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)", wordBreak: "break-all" }}>
							hash: {r.hash.slice(0, 32)}… · actor: {r.actor}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}
