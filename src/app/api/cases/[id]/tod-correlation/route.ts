export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cases/[id]/tod-correlation
 *
 * Novelty feature: cross-references the estimated time-of-death window with
 * digital-evidence timestamps and flags which events fall INSIDE the window —
 * the "critical window" leads an investigator should examine first. This turns
 * two separate analyses (TOD + digital) into one correlated insight.
 */

export async function GET(
	_request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;

		const tod = db
			.prepare(
				"SELECT estimatedTodEarliest, estimatedTodLatest, centralEstimate, confidenceLevel FROM tod_estimates WHERE caseId = ? ORDER BY estimatedAt DESC LIMIT 1",
			)
			.get(id) as
			| {
					estimatedTodEarliest: string;
					estimatedTodLatest: string;
					centralEstimate: string;
					confidenceLevel: number;
			  }
			| undefined;

		if (!tod) {
			return NextResponse.json({
				caseId: id,
				hasTod: false,
				message:
					"No time-of-death estimate for this case. Run TOD estimation first to enable window correlation.",
				insideWindow: [],
				nearWindow: [],
			});
		}

		const earliest = new Date(tod.estimatedTodEarliest).getTime();
		const latest = new Date(tod.estimatedTodLatest).getTime();
		const NEAR_MS = 60 * 60 * 1000; // 1h either side counts as "near"

		const events = db
			.prepare(
				"SELECT id, sourceType, sourceName, timestamp, subject, location, description, anomalyScore FROM digital_evidence WHERE caseId = ? ORDER BY timestamp ASC",
			)
			.all(id) as Array<{
			id: string;
			sourceType: string;
			sourceName: string;
			timestamp: string;
			subject: string;
			location: string;
			description: string;
			anomalyScore: number;
		}>;

		const insideWindow: typeof events = [];
		const nearWindow: typeof events = [];
		for (const e of events) {
			const t = new Date(e.timestamp).getTime();
			if (Number.isNaN(t)) continue;
			if (t >= earliest && t <= latest) insideWindow.push(e);
			else if (t >= earliest - NEAR_MS && t <= latest + NEAR_MS)
				nearWindow.push(e);
		}

		// Rank inside-window events by anomaly score — the strongest leads.
		insideWindow.sort((a, b) => b.anomalyScore - a.anomalyScore);

		return NextResponse.json({
			caseId: id,
			hasTod: true,
			window: {
				earliest: tod.estimatedTodEarliest,
				latest: tod.estimatedTodLatest,
				central: tod.centralEstimate,
				confidence: tod.confidenceLevel,
			},
			totalEvents: events.length,
			insideWindow,
			nearWindow,
			summary:
				insideWindow.length > 0
					? `${insideWindow.length} digital event(s) fall inside the estimated time-of-death window — these are the critical-window leads.`
					: nearWindow.length > 0
						? `No events inside the window, but ${nearWindow.length} occurred within 1 hour of it.`
						: "No digital events fall inside or near the estimated time-of-death window.",
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
