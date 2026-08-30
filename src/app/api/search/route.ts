export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/search?q=...
 * Cross-case full-text-ish search over cases, evidence, autopsy text, and
 * digital evidence. Case-insensitive LIKE matching (SQLite). Returns grouped
 * results with the matching field and a snippet.
 */

export async function GET(request: NextRequest) {
	try {
		const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
		if (q.length < 2) {
			return NextResponse.json({ query: q, results: [], note: "Enter at least 2 characters." });
		}
		const like = `%${q}%`;

		const cases = db
			.prepare(
				`SELECT id, caseRef, title, victimName, location, status
				 FROM cases
				 WHERE title LIKE ? OR description LIKE ? OR victimName LIKE ? OR location LIKE ? OR caseRef LIKE ?
				 LIMIT 25`,
			)
			.all(like, like, like, like, like) as Array<Record<string, unknown>>;

		const evidence = db
			.prepare(
				`SELECT id, caseId, catalogRef, type, description
				 FROM evidence WHERE description LIKE ? OR catalogRef LIKE ? LIMIT 25`,
			)
			.all(like, like) as Array<Record<string, unknown>>;

		const autopsy = db
			.prepare(
				`SELECT id, caseId, causeOfDeath, mannerOfDeath
				 FROM autopsy_reports WHERE rawReport LIKE ? OR causeOfDeath LIKE ? LIMIT 25`,
			)
			.all(like, like) as Array<Record<string, unknown>>;

		const digital = db
			.prepare(
				`SELECT id, caseId, sourceType, subject, location, description
				 FROM digital_evidence WHERE subject LIKE ? OR location LIKE ? OR description LIKE ? LIMIT 25`,
			)
			.all(like, like, like) as Array<Record<string, unknown>>;

		return NextResponse.json({
			query: q,
			counts: {
				cases: cases.length,
				evidence: evidence.length,
				autopsy: autopsy.length,
				digital: digital.length,
			},
			results: { cases, evidence, autopsy, digital },
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
