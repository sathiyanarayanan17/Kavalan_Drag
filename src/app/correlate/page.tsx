"use client";

import { useEffect, useState } from "react";

interface Link {
	caseA: string;
	caseARef: string;
	caseB: string;
	caseBRef: string;
	sharedSubjects: string[];
	sharedLocations: string[];
	sharedSources: string[];
	strength: number;
}

export default function CorrelatePage() {
	const [links, setLinks] = useState<Link[] | null>(null);
	const [meta, setMeta] = useState<{ caseCount: number; linkCount: number }>();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/correlate")
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
			.then((d) => {
				setLinks(d.links);
				setMeta({ caseCount: d.caseCount, linkCount: d.linkCount });
			})
			.catch((e) => setError(String(e)));
	}, []);

	return (
		<div className="p-6">
			<h2
				className="font-mono text-xs uppercase mb-2"
				style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}
			>
				CROSS-CASE CORRELATION
			</h2>
			{meta && (
				<p className="font-mono text-xs mb-4" style={{ color: "var(--text-muted)" }}>
					{meta.linkCount} connection(s) across {meta.caseCount} case(s)
				</p>
			)}
			{error && (
				<p className="font-mono text-sm" style={{ color: "var(--critical)" }}>
					{error}
				</p>
			)}
			{links && links.length === 0 && (
				<p className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>
					No cross-case connections found. Add digital evidence with shared
					subjects, locations, or sources to reveal links.
				</p>
			)}
			<div className="flex flex-col gap-3">
				{(links ?? []).map((l, i) => (
					<div
						key={i}
						style={{
							border: "1px solid var(--border)",
							borderRadius: "4px",
							padding: "12px",
							background: "var(--bg-surface-1)",
						}}
					>
						<div className="flex items-center justify-between mb-2">
							<span
								className="font-mono text-sm"
								style={{ color: "var(--amber-dim)" }}
							>
								<a href={`/cases/${l.caseA}`}>{l.caseARef}</a>
								{"  ↔  "}
								<a href={`/cases/${l.caseB}`}>{l.caseBRef}</a>
							</span>
							<span
								className="font-mono text-xs"
								style={{
									color: l.strength >= 6 ? "var(--critical)" : "var(--medium)",
								}}
							>
								STRENGTH {l.strength}
							</span>
						</div>
						{l.sharedSubjects.length > 0 && (
							<p className="font-sans text-xs" style={{ color: "var(--text-dim)" }}>
								Subjects: {l.sharedSubjects.join(", ")}
							</p>
						)}
						{l.sharedLocations.length > 0 && (
							<p className="font-sans text-xs" style={{ color: "var(--text-dim)" }}>
								Locations: {l.sharedLocations.join(", ")}
							</p>
						)}
						{l.sharedSources.length > 0 && (
							<p className="font-sans text-xs" style={{ color: "var(--text-dim)" }}>
								Sources: {l.sharedSources.join(", ")}
							</p>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
