"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { RiskGauge } from "@/components/cases/RiskGauge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AddEvidenceForm } from "@/components/cases/AddEvidenceForm";
import type { Case, Evidence, CaseActivity } from "@/types";

interface CaseDetail extends Case {
	evidence: Evidence[];
	activities: CaseActivity[];
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | undefined;
}) {
	return (
		<div>
			<p
				className="font-mono text-xs uppercase mb-1"
				style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}
			>
				{label}
			</p>
			<p className="font-mono text-sm" style={{ color: "var(--text-data)" }}>
				{value ?? "—"}
			</p>
		</div>
	);
}

function ConfidenceBar({ value }: { value: number }) {
	const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
	const color =
		pct >= 80 ? "var(--low)" : pct >= 50 ? "var(--medium)" : "var(--critical)";
	return (
		<div className="flex items-center gap-2">
			<div
				style={{
					width: "60px",
					height: "4px",
					background: "var(--bg-surface-3)",
					borderRadius: "2px",
					overflow: "hidden",
				}}
			>
				<div style={{ width: `${pct}%`, height: "100%", background: color }} />
			</div>
			<span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
				{pct}%
			</span>
		</div>
	);
}

export default function CaseOverviewPage() {
	const params = useParams<{ id: string }>();
	const id = params?.id;

	const [caseData, setCaseData] = useState<CaseDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [analyzingRisk, setAnalyzingRisk] = useState(false);
	const [riskResult, setRiskResult] = useState<{
		overall: number;
		tier: string;
		recommendations?: string[];
		anomalies?: string[];
	} | null>(null);

	const loadCase = async () => {
		if (!id) return;
		try {
			const res = await fetch(`/api/cases/${id}`);
			if (!res.ok) throw new Error("Failed to load case");
			const data = await res.json();
			setCaseData(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadCase();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const runRiskAnalysis = async () => {
		if (!id) return;
		setAnalyzingRisk(true);
		try {
			const res = await fetch(`/api/analyze/risk`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ caseId: id }),
			});
			if (!res.ok) throw new Error("Risk analysis failed");
			const result = await res.json();
			// API returns a flat shape: { caseId, overall, tier, factors,
			// anomalies, recommendations }.
			setRiskResult(result);
			setCaseData((prev) =>
				prev
					? {
							...prev,
							riskScore: result.overall ?? prev.riskScore,
							riskLevel: result.tier ?? prev.riskLevel,
						}
					: prev,
			);
		} catch (err) {
			console.error("Risk analysis error:", err);
		} finally {
			setAnalyzingRisk(false);
		}
	};

	const formatDate = (d?: string) => {
		if (!d) return "—";
		try {
			return format(new Date(d), "dd MMM yyyy");
		} catch {
			return d;
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<span
					className="font-mono text-sm"
					style={{ color: "var(--text-dim)" }}
				>
					LOADING...
				</span>
			</div>
		);
	}

	if (error || !caseData) {
		return (
			<div className="flex items-center justify-center h-64">
				<span
					className="font-mono text-sm"
					style={{ color: "var(--critical)" }}
				>
					{error ?? "CASE NOT FOUND"}
				</span>
			</div>
		);
	}

	const tags: string[] = (() => {
		try {
			return JSON.parse(caseData.tags || "[]");
		} catch {
			return [];
		}
	})();

	const recentActivities = (caseData.activities ?? []).slice(0, 5);

	return (
		<motion.div
			className="p-6"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2, ease: "easeOut" }}
		>
			<div className="grid grid-cols-3 gap-6">
				{/* Left: Case Details */}
				<div className="col-span-2 flex flex-col gap-6">
					{/* Case Details */}
					<section>
						<h3
							className="font-mono text-xs uppercase mb-4"
							style={{
								color: "var(--text-dim)",
								letterSpacing: "0.1em",
								borderBottom: "1px solid var(--border)",
								paddingBottom: "8px",
							}}
						>
							CASE DETAILS
						</h3>
						<div className="grid grid-cols-2 gap-4">
							<DetailRow label="Victim" value={caseData.victimName} />
							<DetailRow label="Location" value={caseData.location} />
							<DetailRow
								label="Date of Incident"
								value={formatDate(caseData.dateOfIncident)}
							/>
							<DetailRow
								label="Assigned Agent"
								value={caseData.assignedAgent}
							/>
							<DetailRow
								label="Date Opened"
								value={formatDate(caseData.dateCreated)}
							/>
							<DetailRow label="Status" value={caseData.status} />
						</div>
					</section>

					{/* Description */}
					<section>
						<h3
							className="font-mono text-xs uppercase mb-3"
							style={{
								color: "var(--text-dim)",
								letterSpacing: "0.1em",
								borderBottom: "1px solid var(--border)",
								paddingBottom: "8px",
							}}
						>
							DESCRIPTION
						</h3>
						<p
							className="font-sans text-sm leading-relaxed"
							style={{ color: "var(--text-data)" }}
						>
							{caseData.description || "No description provided."}
						</p>
					</section>

					{/* Evidence Inventory */}
					<section>
						<h3
							className="font-mono text-xs uppercase mb-3"
							style={{
								color: "var(--text-dim)",
								letterSpacing: "0.1em",
								borderBottom: "1px solid var(--border)",
								paddingBottom: "8px",
							}}
						>
							EVIDENCE INVENTORY
						</h3>
						{id && (
							<AddEvidenceForm
								caseId={id as string}
								onCreated={() => loadCase()}
							/>
						)}
						{!caseData.evidence || caseData.evidence.length === 0 ? (
							<p
								className="font-mono text-xs"
								style={{ color: "var(--text-muted)" }}
							>
								NO EVIDENCE CATALOGUED
							</p>
						) : (
							<div
								style={{
									border: "1px solid var(--border)",
									borderRadius: "4px",
									overflow: "hidden",
								}}
							>
								<table style={{ width: "100%", borderCollapse: "collapse" }}>
									<thead>
										<tr style={{ background: "var(--bg-surface-2)" }}>
											{[
												"CATALOG REF",
												"TYPE",
												"DESCRIPTION",
												"IMAGE",
												"COLLECTED",
												"ANALYST",
												"CONFIDENCE",
											].map((h) => (
												<th
													key={h}
													style={{
														padding: "8px 12px",
														textAlign: "left",
														fontFamily: "var(--font-mono, monospace)",
														fontSize: "10px",
														letterSpacing: "0.08em",
														color: "var(--text-muted)",
														borderBottom: "1px solid var(--border)",
													}}
												>
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{caseData.evidence.map((ev, i) => (
											<tr
												key={ev.id}
												style={{
													background:
														i % 2 === 0 ? "var(--bg-surface-1)" : "transparent",
													borderBottom:
														i < caseData.evidence.length - 1
															? "1px solid var(--border-subtle)"
															: "none",
												}}
											>
												<td
													style={{
														padding: "8px 12px",
														fontFamily: "var(--font-mono, monospace)",
														fontSize: "12px",
														color: "var(--amber-dim)",
													}}
												>
													{ev.catalogRef}
												</td>
												<td style={{ padding: "8px 12px" }}>
													<Badge variant="dim">{ev.type}</Badge>
												</td>
												<td
													style={{
														padding: "8px 12px",
														fontFamily: "var(--font-sans)",
														fontSize: "12px",
														color: "var(--text-data)",
														maxWidth: "200px",
													}}
												>
													{ev.description}
												</td>
												<td style={{ padding: "8px 12px" }}>
													{ev.imagePath ? (
														/* eslint-disable-next-line @next/next/no-img-element */
														<a
															href={`/api/evidence/${ev.id}/image`}
															target="_blank"
															rel="noreferrer"
															title="Open full-size image"
														>
															<img
																src={`/api/evidence/${ev.id}/image`}
																alt="Evidence"
																style={{
																	width: 48,
																	height: 48,
																	objectFit: "cover",
																	border: "1px solid var(--border)",
																	display: "block",
																}}
															/>
														</a>
													) : (
														<span
															className="font-mono"
															style={{
																fontSize: 10,
																color: "var(--text-muted)",
															}}
														>
															—
														</span>
													)}
												</td>
												<td
													style={{
														padding: "8px 12px",
														fontFamily: "var(--font-mono, monospace)",
														fontSize: "11px",
														color: "var(--text-dim)",
														whiteSpace: "nowrap",
													}}
												>
													{formatDate(ev.collectedAt)}
												</td>
												<td
													style={{
														padding: "8px 12px",
														fontFamily: "var(--font-mono, monospace)",
														fontSize: "11px",
														color: "var(--text-dim)",
													}}
												>
													{ev.analyst}
												</td>
												<td style={{ padding: "8px 12px" }}>
													<ConfidenceBar value={ev.confidence} />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

					{/* Tags */}
					{tags.length > 0 && (
						<section>
							<div className="flex flex-wrap gap-2 mt-1">
								{tags.map((tag) => (
									<Badge key={tag} variant="dim">
										{tag}
									</Badge>
								))}
							</div>
						</section>
					)}
				</div>

				{/* Right: Risk Gauge + Quick Actions + Activity */}
				<div className="col-span-1 flex flex-col gap-6">
					{/* Risk Gauge */}
					<div className="flex flex-col items-center gap-3">
						<RiskGauge score={caseData.riskScore} size={180} />
						<button
							onClick={runRiskAnalysis}
							disabled={analyzingRisk}
							style={{
								fontFamily: "var(--font-mono, monospace)",
								fontSize: "11px",
								letterSpacing: "0.08em",
								color: analyzingRisk ? "var(--text-muted)" : "var(--amber)",
								background: "transparent",
								border: "1px solid var(--amber-border)",
								padding: "4px 12px",
								borderRadius: "3px",
								cursor: analyzingRisk ? "not-allowed" : "pointer",
							}}
						>
							{analyzingRisk ? "ANALYZING..." : "RISK ANALYSIS"}
						</button>
					</div>

					{/* ML Risk Insight */}
					{riskResult && (
						<section
							style={{
								border: "1px solid var(--border)",
								borderRadius: "4px",
								padding: "12px",
								background: "var(--bg-surface-1)",
							}}
						>
							<h3
								className="font-mono text-xs uppercase mb-2"
								style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}
							>
								AI RISK ASSESSMENT
							</h3>
							<p
								className="font-mono text-sm mb-2"
								style={{ color: "var(--text-data)" }}
							>
								{riskResult.tier} · {riskResult.overall}/100
							</p>
							{(riskResult.recommendations ?? []).slice(0, 4).map((r, i) => (
								<p
									key={i}
									className="font-sans text-xs mb-1"
									style={{ color: "var(--text-dim)" }}
								>
									• {r}
								</p>
							))}
						</section>
					)}

					{/* Export */}
					<section>
						<h3
							className="font-mono text-xs uppercase mb-3"
							style={{
								color: "var(--text-dim)",
								letterSpacing: "0.1em",
								borderBottom: "1px solid var(--border)",
								paddingBottom: "8px",
							}}
						>
							EXPORT & TOOLS
						</h3>
						<div className="flex flex-col gap-2">
							<Button variant="secondary" href={`/api/cases/${id}/export?format=html`}>
								EXPORT REPORT (PDF)
							</Button>
							<Button variant="secondary" href={`/api/cases/${id}/export?format=csv`}>
								EXPORT DATA (CSV)
							</Button>
							<Button variant="secondary" href={`/cases/${id}/graph`}>
								SUSPECT / EVIDENCE GRAPH
							</Button>
							<Button variant="secondary" href={`/cases/${id}/custody`}>
								CHAIN OF CUSTODY
							</Button>
						</div>
					</section>

					{/* Chain-of-custody integrity + TOD-window correlation */}
					<CustodyInsight caseId={id as string} />

					{/* Quick Actions */}
					<section>
						<h3
							className="font-mono text-xs uppercase mb-3"
							style={{
								color: "var(--text-dim)",
								letterSpacing: "0.1em",
								borderBottom: "1px solid var(--border)",
								paddingBottom: "8px",
							}}
						>
							QUICK ACTIONS
						</h3>
						<div className="flex flex-col gap-2">
							{[
								{
									label: "ANALYZE AUTOPSY REPORT",
									href: `/cases/${id}/autopsy`,
								},
								{
									label: "ESTIMATE TIME OF DEATH",
									href: `/cases/${id}/tod`,
								},
								{
									label: "CORRELATE DIGITAL EVIDENCE",
									href: `/cases/${id}/digital`,
								},
								{
									label: "VIEW TIMELINE",
									href: `/cases/${id}/timeline`,
								},
							].map((action) => (
								<Button
									key={action.label}
									variant="secondary"
									href={action.href}
								>
									{action.label}
								</Button>
							))}
						</div>
					</section>

					{/* Recent Activity */}
					{recentActivities.length > 0 && (
						<section>
							<h3
								className="font-mono text-xs uppercase mb-3"
								style={{
									color: "var(--text-dim)",
									letterSpacing: "0.1em",
									borderBottom: "1px solid var(--border)",
									paddingBottom: "8px",
								}}
							>
								RECENT ACTIVITY
							</h3>
							<div className="flex flex-col gap-2">
								{recentActivities.map((act) => (
									<div key={act.id} className="flex flex-col gap-0.5">
										<p
											className="font-sans text-xs"
											style={{ color: "var(--text-data)" }}
										>
											{act.description}
										</p>
										<p
											className="font-mono text-xs"
											style={{ color: "var(--text-muted)" }}
										>
											{act.agent} · {formatDate(act.createdAt)}
										</p>
									</div>
								))}
							</div>
						</section>
					)}
				</div>
			</div>
		</motion.div>
	);
}

function CustodyInsight({ caseId }: { caseId: string }) {
	const [custody, setCustody] = useState<{
		integrity: { intact: boolean; length: number; reason?: string };
	} | null>(null);
	const [tod, setTod] = useState<{
		hasTod: boolean;
		summary?: string;
		insideWindow?: unknown[];
	} | null>(null);

	useEffect(() => {
		if (!caseId) return;
		fetch(`/api/cases/${caseId}/custody`)
			.then((r) => r.json())
			.then(setCustody)
			.catch(() => {});
		fetch(`/api/cases/${caseId}/tod-correlation`)
			.then((r) => r.json())
			.then(setTod)
			.catch(() => {});
	}, [caseId]);

	return (
		<section
			style={{
				border: "1px solid var(--border)",
				borderRadius: "4px",
				padding: "12px",
				background: "var(--bg-surface-1)",
			}}
		>
			<h3
				className="font-mono text-xs uppercase mb-2"
				style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}
			>
				INTEGRITY & INSIGHT
			</h3>

			{custody && (
				<p
					className="font-mono text-xs mb-2"
					style={{
						color: custody.integrity.intact
							? "var(--low, #5ae0a0)"
							: "var(--critical, #e05a5a)",
					}}
				>
					{custody.integrity.intact
						? `● CHAIN OF CUSTODY INTACT (${custody.integrity.length} records)`
						: `⚠ CUSTODY CHAIN BROKEN — ${custody.integrity.reason}`}
				</p>
			)}

			{tod && (
				<p
					className="font-sans text-xs"
					style={{ color: "var(--text-dim)" }}
				>
					{tod.hasTod
						? tod.summary
						: "TOD window correlation available after running a TOD estimate."}
				</p>
			)}
		</section>
	);
}
