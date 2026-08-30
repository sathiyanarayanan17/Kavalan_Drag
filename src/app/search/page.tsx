"use client";

import { useState } from "react";

interface SearchResults {
	query: string;
	counts?: Record<string, number>;
	results?: {
		cases: Array<Record<string, unknown>>;
		evidence: Array<Record<string, unknown>>;
		autopsy: Array<Record<string, unknown>>;
		digital: Array<Record<string, unknown>>;
	};
	note?: string;
}

export default function SearchPage() {
	const [q, setQ] = useState("");
	const [data, setData] = useState<SearchResults | null>(null);
	const [loading, setLoading] = useState(false);

	const run = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			setData(await res.json());
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="p-6">
			<h2 className="font-mono text-xs uppercase mb-4" style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}>
				CROSS-CASE SEARCH
			</h2>
			<form onSubmit={run} className="flex gap-2 mb-6">
				<input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Search cases, evidence, autopsy, digital..."
					style={{
						flex: 1,
						padding: "8px 12px",
						background: "var(--bg-surface-2)",
						border: "1px solid var(--border)",
						borderRadius: 4,
						color: "var(--text-data)",
						fontFamily: "monospace",
						fontSize: 13,
					}}
				/>
				<button
					type="submit"
					disabled={loading}
					style={{
						padding: "8px 16px",
						background: "var(--amber)",
						color: "#000",
						border: "none",
						borderRadius: 4,
						fontFamily: "monospace",
						fontSize: 12,
						cursor: "pointer",
					}}
				>
					{loading ? "..." : "SEARCH"}
				</button>
			</form>

			{data?.note && (
				<p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{data.note}</p>
			)}

			{data?.results && (
				<div className="flex flex-col gap-6">
					<Section title={`CASES (${data.counts?.cases ?? 0})`}>
						{data.results.cases.map((c) => (
							<a key={String(c.id)} href={`/cases/${c.id}`} className="block font-mono text-xs py-1" style={{ color: "var(--amber-dim)" }}>
								{String(c.caseRef)} — {String(c.title)} · {String(c.victimName)}
							</a>
						))}
					</Section>
					<Section title={`EVIDENCE (${data.counts?.evidence ?? 0})`}>
						{data.results.evidence.map((e) => (
							<a key={String(e.id)} href={`/cases/${e.caseId}`} className="block font-sans text-xs py-1" style={{ color: "var(--text-dim)" }}>
								[{String(e.type)}] {String(e.description)}
							</a>
						))}
					</Section>
					<Section title={`AUTOPSY (${data.counts?.autopsy ?? 0})`}>
						{data.results.autopsy.map((a) => (
							<a key={String(a.id)} href={`/cases/${a.caseId}/autopsy`} className="block font-sans text-xs py-1" style={{ color: "var(--text-dim)" }}>
								{String(a.causeOfDeath)} · {String(a.mannerOfDeath)}
							</a>
						))}
					</Section>
					<Section title={`DIGITAL (${data.counts?.digital ?? 0})`}>
						{data.results.digital.map((d) => (
							<a key={String(d.id)} href={`/cases/${d.caseId}/digital`} className="block font-sans text-xs py-1" style={{ color: "var(--text-dim)" }}>
								[{String(d.sourceType)}] {String(d.subject)} @ {String(d.location)}
							</a>
						))}
					</Section>
				</div>
			)}
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	const arr = Array.isArray(children) ? children : [children];
	return (
		<section>
			<h3 className="font-mono text-xs uppercase mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.1em", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
				{title}
			</h3>
			{arr.length === 0 ? (
				<p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>No matches.</p>
			) : (
				children
			)}
		</section>
	);
}
