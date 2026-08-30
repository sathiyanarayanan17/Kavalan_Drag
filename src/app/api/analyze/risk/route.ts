export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateRiskScore } from "@/lib/ai-engine";
import { mlRisk } from "@/lib/ml-client";
import { appendCustody } from "@/lib/custody";
import type { Case } from "@/types";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { caseId } = body;
		if (!caseId)
			return NextResponse.json(
				{ error: "caseId is required" },
				{ status: 400 },
			);

		const caseRow = db
			.prepare("SELECT * FROM cases WHERE id = ?")
			.get(caseId) as Case | undefined;
		if (!caseRow)
			return NextResponse.json({ error: "Case not found" }, { status: 404 });

		const autopsyRow = db
			.prepare(
				"SELECT mannerOfDeath FROM autopsy_reports WHERE caseId = ? ORDER BY analyzedAt DESC LIMIT 1",
			)
			.get(caseId) as { mannerOfDeath: string } | undefined;
		const hasTodEstimate = !!db
			.prepare("SELECT id FROM tod_estimates WHERE caseId = ? LIMIT 1")
			.get(caseId);
		const digitalRows = db
			.prepare("SELECT anomalyScore FROM digital_evidence WHERE caseId = ?")
			.all(caseId) as { anomalyScore: number }[];
		const digitalAnomalyCount = digitalRows.filter(
			(d) => d.anomalyScore > 50,
		).length;

		const digitalTimestamps = (
			db
				.prepare(
					"SELECT timestamp FROM digital_evidence WHERE caseId = ? ORDER BY timestamp ASC",
				)
				.all(caseId) as { timestamp: string }[]
		).map((r) => new Date(r.timestamp).getTime());
		let openTimelinGaps = 0;
		for (let i = 1; i < digitalTimestamps.length; i++) {
			if ((digitalTimestamps[i] - digitalTimestamps[i - 1]) / 3600000 > 2)
				openTimelinGaps++;
		}

		const result = calculateRiskScore({
			caseId,
			evidenceCount: caseRow.evidenceCount,
			suspectCount: caseRow.suspectCount,
			digitalAnomalyCount,
			hasAutopsy: !!autopsyRow,
			hasTodEstimate,
			mannerOfDeath: autopsyRow?.mannerOfDeath,
			openTimelinGaps,
			caseAgeHours:
				(Date.now() - new Date(caseRow.dateCreated).getTime()) / 3600000,
		});

		// Cross-check the tier with the trained ML risk model. The numeric
		// score + factor breakdown always come from the auditable formula; the
		// ML model provides a learned second opinion on the tier. On any
		// failure this is a no-op.
		let tierSource = "formula";
		const ml = await mlRisk({
			evidenceCount: caseRow.evidenceCount,
			suspectCount: caseRow.suspectCount,
			digitalAnomalyCount,
			hasAutopsy: autopsyRow ? 1 : 0,
			hasTodEstimate: hasTodEstimate ? 1 : 0,
			mannerOfDeath: autopsyRow?.mannerOfDeath ?? "UNDETERMINED",
			openTimelineGaps: openTimelinGaps,
			caseAgeHours:
				(Date.now() - new Date(caseRow.dateCreated).getTime()) / 3600000,
		});
		if (ml && ml.riskTier && ml.confidence >= 0.6) {
			result.tier = ml.riskTier;
			tierSource = `KAVALAN ML model (${Math.round(ml.confidence * 100)}% confidence)`;
			if (typeof ml.predictedScore === "number") {
				result.overall = Math.round(ml.predictedScore);
			}
			const explain = (ml.explanation ?? [])
				.slice(0, 3)
				.map(
					(e) =>
						`${e.feature} (${e.contribution >= 0 ? "+" : ""}${e.contribution})`,
				)
				.join(", ");
			result.recommendations = [
				`Risk tier confirmed by ${tierSource}.`,
				...(explain ? [`Top drivers: ${explain}.`] : []),
				...result.recommendations,
			];
		} else if (ml && ml.riskTier) {
			// Low-confidence ML prediction — defer to the auditable formula but
			// surface the disagreement for the analyst.
			tierSource = "formula (ML low-confidence, deferred)";
			result.recommendations = [
				`ML model suggested ${ml.riskTier} at ${Math.round(ml.confidence * 100)}% — below threshold, formula tier retained.`,
				...result.recommendations,
			];
		}

		db.prepare(
			"UPDATE cases SET riskScore = $riskScore, riskLevel = $riskLevel WHERE id = $id",
		).run({
			riskScore: result.overall,
			riskLevel: result.tier,
			id: caseId,
		});

		// Counterfactual explanations: what single change would most reduce the
		// tier? Uses the auditable formula so it is explainable and honest.
		const counterfactuals: string[] = [];
		if (result.tier !== "LOW") {
			const ageHours =
				(Date.now() - new Date(caseRow.dateCreated).getTime()) / 3600000;
			const baseInput = {
				caseId,
				evidenceCount: caseRow.evidenceCount,
				suspectCount: caseRow.suspectCount,
				digitalAnomalyCount,
				hasAutopsy: !!autopsyRow,
				hasTodEstimate,
				mannerOfDeath: autopsyRow?.mannerOfDeath,
				openTimelinGaps,
				caseAgeHours: ageHours,
			};
			const scenarios: Array<{ label: string; patch: Partial<typeof baseInput> }> = [];
			if (!autopsyRow)
				scenarios.push({ label: "completing the autopsy", patch: { hasAutopsy: true } });
			if (!hasTodEstimate)
				scenarios.push({
					label: "completing the TOD estimate",
					patch: { hasTodEstimate: true },
				});
			for (const s of scenarios) {
				const alt = calculateRiskScore({ ...baseInput, ...s.patch });
				if (alt.tier !== result.tier || alt.overall < result.overall) {
					counterfactuals.push(
						`Risk would drop to ${alt.tier} (${alt.overall}/100) by ${s.label}.`,
					);
				}
			}
		}
		if (counterfactuals.length > 0) {
			result.recommendations = [...result.recommendations, ...counterfactuals];
		}

		appendCustody(
			caseId,
			"RISK_SCORED",
			`Tier: ${result.tier}; Score: ${result.overall}/100; source: ${tierSource}`,
		);

		return NextResponse.json({ caseId, ...result, counterfactuals });
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
