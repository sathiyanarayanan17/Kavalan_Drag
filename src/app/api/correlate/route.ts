export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/correlate
 * Cross-case correlation: finds cases connected by shared subjects, locations,
 * or digital-evidence sources. Returns ranked case-pair links with the shared
 * entities and a simple connection strength score.
 */

interface Link {
	caseA: string;
	caseARef: string;
	caseB: string;
	caseBRef: string;
	sharedSubjects: string[];
	sharedLocations: string[];
	sharedSources: string[];
	strength: number;
}

export async function GET() {
	try {
		const cases = db
			.prepare("SELECT id, caseRef, title FROM cases")
			.all() as Array<{ id: string; caseRef: string; title: string }>;

		const digital = db
			.prepare(
				"SELECT caseId, subject, location, sourceName FROM digital_evidence",
			)
			.all() as Array<{
			caseId: string;
			subject: string;
			location: string;
			sourceName: string;
		}>;

		// Build per-case entity sets.
		const byCase = new Map<
			string,
			{ subjects: Set<string>; locations: Set<string>; sources: Set<string> }
		>();
		for (const c of cases)
			byCase.set(c.id, {
				subjects: new Set(),
				locations: new Set(),
				sources: new Set(),
			});
		for (const d of digital) {
			const e = byCase.get(d.caseId);
			if (!e) continue;
			if (d.subject) e.subjects.add(d.subject.trim().toLowerCase());
			if (d.location) e.locations.add(d.location.trim().toLowerCase());
			if (d.sourceName) e.sources.add(d.sourceName.trim().toLowerCase());
		}

		const refOf = new Map(cases.map((c) => [c.id, c.caseRef || c.title]));
		const inter = (a: Set<string>, b: Set<string>) =>
			[...a].filter((x) => b.has(x));

		const links: Link[] = [];
		for (let i = 0; i < cases.length; i++) {
			for (let j = i + 1; j < cases.length; j++) {
				const A = byCase.get(cases[i].id)!;
				const B = byCase.get(cases[j].id)!;
				const sharedSubjects = inter(A.subjects, B.subjects);
				const sharedLocations = inter(A.locations, B.locations);
				const sharedSources = inter(A.sources, B.sources);
				const strength =
					sharedSubjects.length * 3 +
					sharedLocations.length * 2 +
					sharedSources.length * 2;
				if (strength > 0) {
					links.push({
						caseA: cases[i].id,
						caseARef: refOf.get(cases[i].id) ?? cases[i].id,
						caseB: cases[j].id,
						caseBRef: refOf.get(cases[j].id) ?? cases[j].id,
						sharedSubjects,
						sharedLocations,
						sharedSources,
						strength,
					});
				}
			}
		}

		links.sort((a, b) => b.strength - a.strength);

		return NextResponse.json({
			caseCount: cases.length,
			linkCount: links.length,
			links: links.slice(0, 50),
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
