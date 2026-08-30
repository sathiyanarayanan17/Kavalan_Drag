export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateRiskScore } from "@/lib/ai-engine";
import type { Case } from "@/types";

/**
 * POST /api/analyze/batch
 * Batch triage: recompute the risk score for every case in one pass and return
 * a ranked list. Uses the auditable formula (fast, no per-case ML round-trip).
 */
export async function POST() {
	try {
		const cases = db.prepare("SELECT * FROM cases").all() as Case[];
		const results: Array<{
			id: string;
			caseRef: string;
			title: string;
			tier: string;
			score: number;
		}> = [];

		const update = db.prepare(
			"UPDATE cases SET riskScore = $riskScore, riskLevel = $riskLevel WHERE id = $id",
		);

		const tx = db.transaction(() => {
			for (const c of cases) {
				const autopsyRow = db
					.prepare(
						"SELECT mannerOfDeath FROM autopsy_reports WHERE caseId = ? ORDER BY analyzedAt DESC LIMIT 1",
					)
					.get(c.id) as { mannerOfDeath: string } | undefined;
				const hasTod = !!db
					.prepare("SELECT id FROM tod_estimates WHERE caseId = ? LIMIT 1")
					.get(c.id);
				const digitalRows = db
					.prepare("SELECT anomalyScore FROM digital_evidence WHERE caseId = ?")
					.all(c.id) as { anomalyScore: number }[];
				const digitalAnomalyCount = digitalRows.filter(
					(d) => d.anomalyScore > 50,
				).length;

				const r = calculateRiskScore({
					caseId: c.id,
					evidenceCount: c.evidenceCount,
					suspectCount: c.suspectCount,
					digitalAnomalyCount,
					hasAutopsy: !!autopsyRow,
					hasTodEstimate: hasTod,
					mannerOfDeath: autopsyRow?.mannerOfDeath,
					openTimelinGaps: 0,
					caseAgeHours:
						(Date.now() - new Date(c.dateCreated).getTime()) / 3600000,
				});
				update.run({ riskScore: r.overall, riskLevel: r.tier, id: c.id });
				results.push({
					id: c.id,
					caseRef: c.caseRef,
					title: c.title,
					tier: r.tier,
					score: r.overall,
				});
			}
		});
		tx();

		results.sort((a, b) => b.score - a.score);
		const critical = results.filter((r) => r.tier === "CRITICAL").length;
		const high = results.filter((r) => r.tier === "HIGH").length;

		return NextResponse.json({
			analyzed: results.length,
			critical,
			high,
			ranked: results,
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
