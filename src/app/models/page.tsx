"use client";

import { useEffect, useState } from "react";

interface ModelsData {
	serviceUp: boolean;
	note: string;
	metrics: {
		autopsy?: { accuracy: number; macro_f1: number; params: number; classes: string[] };
		digital?: { accuracy: number; roc_auc: number; macro_f1: number; features: string[] };
		risk?: { accuracy: number; macro_f1: number; cv_accuracy_mean: number; features: string[] };
	};
}

function pct(n?: number) {
	return n == null ? "—" : `${(n * 100).toFixed(2)}%`;
}

export default function ModelsPage() {
	const [data, setData] = useState<ModelsData | null>(null);

	useEffect(() => {
		fetch("/api/models")
			.then((r) => r.json())
			.then(setData)
			.catch(() => {});
	}, []);

	return (
		<div className="p-6">
			<h2 className="font-mono text-xs uppercase mb-1" style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}>
				MODEL INTELLIGENCE
			</h2>
			{data && (
				<p className="font-mono text-xs mb-6" style={{ color: data.serviceUp ? "var(--low,#5ae0a0)" : "var(--critical,#e05a5a)" }}>
					{data.serviceUp ? "● ML SERVICE ONLINE" : "○ ML SERVICE OFFLINE (rule-based fallback active)"}
				</p>
			)}

			<div className="grid grid-cols-3 gap-4">
				<Card title="AUTOPSY — Manner of Death" subtitle="PyTorch neural network">
					<Metric label="Accuracy" value={pct(data?.metrics.autopsy?.accuracy)} />
					<Metric label="Macro F1" value={pct(data?.metrics.autopsy?.macro_f1)} />
					<Metric label="Parameters" value={data?.metrics.autopsy?.params?.toLocaleString() ?? "—"} />
					<Metric label="Classes" value={data?.metrics.autopsy?.classes?.join(", ") ?? "—"} />
				</Card>
				<Card title="DIGITAL — Anomaly" subtitle="XGBoost">
					<Metric label="Accuracy" value={pct(data?.metrics.digital?.accuracy)} />
					<Metric label="ROC-AUC" value={pct(data?.metrics.digital?.roc_auc)} />
					<Metric label="Macro F1" value={pct(data?.metrics.digital?.macro_f1)} />
				</Card>
				<Card title="RISK — Tier" subtitle="LightGBM">
					<Metric label="Accuracy" value={pct(data?.metrics.risk?.accuracy)} />
					<Metric label="Macro F1" value={pct(data?.metrics.risk?.macro_f1)} />
					<Metric label="CV Accuracy" value={pct(data?.metrics.risk?.cv_accuracy_mean)} />
				</Card>
			</div>

			<p className="font-sans text-xs mt-6" style={{ color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 720 }}>
				Note: models are trained on synthetic data generated from the app&apos;s own
				vocabulary and rule logic. These metrics measure how well each model
				generalises across that space — not validated real-world forensic
				accuracy. All outputs require review by qualified professionals.
			</p>
		</div>
	);
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
	return (
		<div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 16, background: "var(--bg-surface-1)" }}>
			<p className="font-mono text-xs" style={{ color: "var(--amber-dim)", letterSpacing: "0.05em" }}>{title}</p>
			<p className="font-mono text-xs mb-3" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
			<div className="flex flex-col gap-2">{children}</div>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between items-baseline gap-2">
			<span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>{label}</span>
			<span className="font-mono text-xs text-right" style={{ color: "var(--text-data)" }}>{value}</span>
		</div>
	);
}
