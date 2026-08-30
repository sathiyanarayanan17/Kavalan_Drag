export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { mlHealth } from "@/lib/ml-client";
import fs from "fs";
import path from "path";

/**
 * GET /api/models
 * Returns trained-model metrics (from ml/models/summary.json) plus live ML
 * service availability. Powers the model explainability dashboard.
 */
export async function GET() {
	let metrics: Record<string, unknown> = {};
	try {
		const p = path.join(process.cwd(), "ml", "models", "summary.json");
		if (fs.existsSync(p)) {
			metrics = JSON.parse(fs.readFileSync(p, "utf-8"));
		}
	} catch {
		metrics = {};
	}
	const serviceUp = await mlHealth();
	return NextResponse.json({
		serviceUp,
		metrics,
		note: serviceUp
			? "ML service reachable — predictions are model-backed."
			: "ML service unreachable — app falls back to the rule-based engine.",
	});
}
