"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface GraphNode {
	id: string;
	label: string;
	type: "CASE" | "SUBJECT" | "LOCATION" | "SOURCE" | "EVIDENCE";
	weight: number;
}
interface GraphEdge {
	source: string;
	target: string;
	label: string;
}
interface GraphData {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

const TYPE_COLOR: Record<GraphNode["type"], string> = {
	CASE: "#b8860b",
	SUBJECT: "#e05a5a",
	LOCATION: "#5a9be0",
	SOURCE: "#5ae0a0",
	EVIDENCE: "#c9a227",
};

export default function CaseGraphPage() {
	const params = useParams<{ id: string }>();
	const id = params?.id;
	const [data, setData] = useState<GraphData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!id) return;
		fetch(`/api/cases/${id}/graph`)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
			.then(setData)
			.catch((e) => setError(String(e)));
	}, [id]);

	if (error)
		return (
			<div className="p-6 font-mono text-sm" style={{ color: "var(--critical)" }}>
				{error}
			</div>
		);
	if (!data)
		return (
			<div className="p-6 font-mono text-sm" style={{ color: "var(--text-dim)" }}>
				LOADING GRAPH...
			</div>
		);

	// Radial layout: CASE at centre, others on a circle by index.
	const W = 900;
	const H = 620;
	const cx = W / 2;
	const cy = H / 2;
	const center = data.nodes.find((n) => n.type === "CASE") ?? data.nodes[0];
	const others = data.nodes.filter((n) => n.id !== center?.id);
	const R = Math.min(W, H) * 0.38;

	const pos: Record<string, { x: number; y: number }> = {};
	if (center) pos[center.id] = { x: cx, y: cy };
	others.forEach((n, i) => {
		const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
		pos[n.id] = { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
	});

	return (
		<div className="p-6">
			<h2
				className="font-mono text-xs uppercase mb-4"
				style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}
			>
				SUSPECT / EVIDENCE RELATIONSHIP GRAPH
			</h2>
			<div
				style={{
					border: "1px solid var(--border)",
					borderRadius: "4px",
					background: "var(--bg-surface-1)",
					overflow: "auto",
				}}
			>
				<svg width={W} height={H} role="img" aria-label="Relationship graph">
					{/* edges */}
					{data.edges.map((e, i) => {
						const a = pos[e.source];
						const b = pos[e.target];
						if (!a || !b) return null;
						return (
							<g key={`e${i}`}>
								<line
									x1={a.x}
									y1={a.y}
									x2={b.x}
									y2={b.y}
									stroke={
										e.label === "anomalous"
											? "var(--critical)"
											: "var(--border-strong)"
									}
									strokeWidth={e.label === "anomalous" ? 2 : 1}
								/>
							</g>
						);
					})}
					{/* nodes */}
					{data.nodes.map((n) => {
						const p = pos[n.id];
						if (!p) return null;
						const r = 8 + Math.min(18, n.weight);
						return (
							<g key={n.id}>
								<circle
									cx={p.x}
									cy={p.y}
									r={r}
									fill={TYPE_COLOR[n.type]}
									opacity={0.85}
								/>
								<text
									x={p.x}
									y={p.y + r + 12}
									textAnchor="middle"
									style={{
										fontFamily: "'JetBrains Mono', monospace",
										fontSize: 10,
										fill: "var(--text-data)",
									}}
								>
									{n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
								</text>
							</g>
						);
					})}
				</svg>
			</div>
			{/* legend */}
			<div className="flex gap-4 mt-3">
				{Object.entries(TYPE_COLOR).map(([type, color]) => (
					<div key={type} className="flex items-center gap-1.5">
						<span
							style={{
								width: 10,
								height: 10,
								borderRadius: "50%",
								background: color,
								display: "inline-block",
							}}
						/>
						<span
							className="font-mono text-xs"
							style={{ color: "var(--text-dim)" }}
						>
							{type}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
