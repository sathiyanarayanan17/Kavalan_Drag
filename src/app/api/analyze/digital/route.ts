export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { correlateDigitalEvidence } from "@/lib/ai-engine";
import { mlDigital } from "@/lib/ml-client";
import type { DigitalEvidence } from "@/types";

type ClaudePattern = {
	pattern?: string;
	label?: string;
	confidence?: number;
	subjects?: string[];
};

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { caseId, events: inputEvents } = body;

		if (!caseId) {
			return NextResponse.json(
				{ error: "caseId is required" },
				{ status: 400 },
			);
		}

		const caseRow = db.prepare("SELECT id FROM cases WHERE id = ?").get(caseId);
		if (!caseRow) {
			return NextResponse.json({ error: "Case not found" }, { status: 404 });
		}

		let events = inputEvents;

		// If no events provided, fetch from db
		if (!events || events.length === 0) {
			const dbEvents = db
				.prepare(
					"SELECT * FROM digital_evidence WHERE caseId = ? ORDER BY timestamp ASC",
				)
				.all(caseId) as unknown as DigitalEvidence[];

			events = dbEvents.map((e) => ({
				sourceType: e.sourceType,
				sourceName: e.sourceName,
				timestamp: e.timestamp,
				location: e.location,
				subject: e.subject,
				description: e.description,
				anomalyScore: e.anomalyScore,
			}));
		}

		if (events.length === 0) {
			return NextResponse.json({
				caseId,
				eventCount: 0,
				anomalies: [],
				patterns: [],
				digitalRisk: 0,
				timeline: [],
				summary:
					"No digital evidence in this case. Add records (CCTV, mobile, financial, etc.) on the Digital Evidence tab, then rerun correlation.",
			});
		}

		const result = await correlateDigitalEvidence({ events });

		// ML enhancement: score each event with the trained digital-anomaly
		// model. Features are derived from the event the same way the training
		// data was generated (see ml/synth.py). Failures are ignored so the
		// base correlation result always stands.
		let mlHighAnomalyCount = 0;
		let mlScored = 0;
		try {
			const seenLocations = new Set<string>();
			const typeTimes: Record<string, number[]> = {};
			for (const e of events as Array<Record<string, unknown>>) {
				const ts = new Date(String(e.timestamp)).getTime();
				const src = String(e.sourceType ?? "CCTV");
				const hour = new Date(ts).getHours();
				const temporalDeviation = Math.min(1, Math.abs(hour - 12) / 12);
				const loc = String(e.location ?? "");
				const novelLocation = seenLocations.has(loc) ? 0 : 1;
				seenLocations.add(loc);
				// burst: same-type events within 1h
				const times = (typeTimes[src] ??= []);
				const burstCount = times.filter((t) => Math.abs(t - ts) <= 3600000).length;
				times.push(ts);
				const frequencyDeviation = Math.min(1, Math.max(0, (burstCount - 1) / 4));

				const ml = await mlDigital({
					sourceType: src,
					hour,
					temporalDeviation,
					novelLocation,
					burstCount,
					frequencyDeviation,
					subjectDiversity: 0.5,
					confidence: Number(e.anomalyScore ?? 50) / 100,
				});
				if (ml) {
					mlScored++;
					if (ml.highAnomaly) mlHighAnomalyCount++;
				}
			}
		} catch {
			// ignore — ML is an enhancement, correlation result is authoritative
		}

		// Normalise shape to match what the Digital panel UI consumes.
		const patterns = ((
			result as unknown as { patterns?: ClaudePattern[] }
		).patterns ?? []).map((p) => ({
			label: p.label ?? p.pattern ?? "Pattern",
			confidence:
				typeof p.confidence === "number"
					? Math.max(0, Math.min(100, Math.round(p.confidence)))
					: 50,
			subjects: p.subjects,
		}));

		return NextResponse.json({
			caseId,
			eventCount: events.length,
			anomalies: result.anomalies ?? [],
			patterns,
			digitalRisk: Math.max(
				0,
				Math.min(100, Math.round(result.riskContribution ?? 0)),
			),
			timeline: result.timeline ?? [],
			mlHighAnomalyCount,
			mlScored,
			summary:
				(result as unknown as { summary?: string }).summary ??
				(result.anomalies && result.anomalies.length > 0
					? `${result.anomalies.length} anomaly event${
							result.anomalies.length === 1 ? "" : "s"
						} detected across ${events.length} digital record${events.length === 1 ? "" : "s"}.`
					: `Reviewed ${events.length} digital record${events.length === 1 ? "" : "s"}. No significant anomalies flagged.`),
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
