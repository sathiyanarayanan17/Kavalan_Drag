export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mlHealth } from "@/lib/ml-client";

/**
 * GET /api/health
 * Liveness + dependency status for the app, the database, and the ML service.
 */
export async function GET() {
	let dbOk = false;
	let caseCount = 0;
	try {
		const row = db.prepare("SELECT COUNT(*) as c FROM cases").get() as {
			c: number;
		};
		caseCount = row.c;
		dbOk = true;
	} catch {
		dbOk = false;
	}

	const mlOk = await mlHealth();

	return NextResponse.json({
		status: dbOk ? "ok" : "degraded",
		database: { ok: dbOk, cases: caseCount },
		mlService: {
			ok: mlOk,
			note: mlOk
				? "Trained models available"
				: "ML service unreachable — using rule-based fallback",
		},
		timestamp: new Date().toISOString(),
	});
}
