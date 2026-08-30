export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCustodyChain, initCustody } from "@/lib/custody";
import type { Case } from "@/types";

/**
 * GET /api/alerts
 * Proactive alerts for the dashboard:
 *  - CRITICAL-tier cases
 *  - cases whose chain-of-custody integrity is broken
 */
export async function GET() {
	try {
		initCustody();
		const cases = db.prepare("SELECT * FROM cases").all() as Case[];

		const critical = cases
			.filter((c) => c.riskLevel === "CRITICAL")
			.map((c) => ({
				type: "CRITICAL_CASE",
				caseId: c.id,
				caseRef: c.caseRef,
				message: `${c.caseRef} — ${c.title} is CRITICAL (${c.riskScore}/100)`,
			}));

		const custodyBreaks: Array<Record<string, string>> = [];
		for (const c of cases) {
			const v = verifyCustodyChain(c.id);
			if (!v.intact && v.length > 0) {
				custodyBreaks.push({
					type: "CUSTODY_BREACH",
					caseId: c.id,
					caseRef: c.caseRef,
					message: `${c.caseRef} — custody chain broken at record ${v.brokenAtSeq}: ${v.reason}`,
				});
			}
		}

		const alerts = [...custodyBreaks, ...critical];
		return NextResponse.json({
			count: alerts.length,
			criticalCount: critical.length,
			custodyBreachCount: custodyBreaks.length,
			alerts,
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
