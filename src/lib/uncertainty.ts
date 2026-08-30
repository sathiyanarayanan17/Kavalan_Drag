/**
 * uncertainty.ts
 * ==============
 * Method-disagreement detection. When independent analysis methods (the ML
 * model, the rule-based engine, and the LLM) produce different conclusions,
 * that disagreement is itself forensic signal: it means the finding is not
 * robust and warrants human review.
 *
 * This is the core of KAVALAN's explainability principle — the system tells
 * you not just its answer, but how much its own methods agree.
 */

export type UncertaintyLevel = "LOW" | "MODERATE" | "HIGH";

export interface MethodOpinion {
	method: string; // e.g. "ML model", "rule engine", "LLM"
	value: string; // the classification/answer
	confidence?: number; // 0..1 if available
}

export interface DisagreementResult {
	agreement: number; // 0..1 — fraction of methods agreeing with the majority
	consensus: string; // the majority answer
	uncertainty: UncertaintyLevel;
	flagged: boolean; // true when human review is recommended
	opinions: MethodOpinion[];
	note: string;
}

/**
 * Assess agreement across method opinions. `opinions` should exclude methods
 * that produced no answer (filter those out before calling).
 */
export function assessDisagreement(
	opinions: MethodOpinion[],
): DisagreementResult {
	const valid = opinions.filter((o) => o.value && o.value.trim().length > 0);

	if (valid.length === 0) {
		return {
			agreement: 0,
			consensus: "UNDETERMINED",
			uncertainty: "HIGH",
			flagged: true,
			opinions: valid,
			note: "No method produced a conclusion — manual review required.",
		};
	}

	// Tally votes (case-insensitive).
	const tally = new Map<string, { count: number; canonical: string }>();
	for (const o of valid) {
		const key = o.value.trim().toUpperCase();
		const entry = tally.get(key);
		if (entry) entry.count += 1;
		else tally.set(key, { count: 1, canonical: o.value.trim() });
	}

	let consensus = valid[0].value;
	let topCount = 0;
	for (const { count, canonical } of tally.values()) {
		if (count > topCount) {
			topCount = count;
			consensus = canonical;
		}
	}

	const agreement = topCount / valid.length;

	let uncertainty: UncertaintyLevel;
	if (agreement === 1) uncertainty = "LOW";
	else if (agreement >= 0.5) uncertainty = "MODERATE";
	else uncertainty = "HIGH";

	// Also raise uncertainty if the leading method is low-confidence.
	const consensusConfidences = valid
		.filter((o) => o.value.trim().toUpperCase() === consensus.toUpperCase())
		.map((o) => o.confidence ?? 1);
	const minConsensusConf = Math.min(...consensusConfidences);
	if (uncertainty === "LOW" && minConsensusConf < 0.5) uncertainty = "MODERATE";

	const flagged = uncertainty !== "LOW";

	const dissenting = valid
		.filter((o) => o.value.trim().toUpperCase() !== consensus.toUpperCase())
		.map((o) => `${o.method}→${o.value}`);

	const note =
		uncertainty === "LOW"
			? `All ${valid.length} method(s) agree on "${consensus}".`
			: `Methods disagree (${Math.round(agreement * 100)}% agreement). ` +
				`Consensus "${consensus}"; dissent: ${dissenting.join(", ") || "none"}. ` +
				`Recommend human review.`;

	return {
		agreement: Math.round(agreement * 100) / 100,
		consensus,
		uncertainty,
		flagged,
		opinions: valid,
		note,
	};
}
