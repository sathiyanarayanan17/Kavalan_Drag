export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cases/[id]/graph
 * Builds a relationship graph (nodes + edges) for a case from its digital
 * evidence and evidence records: subjects, locations, devices/sources.
 */

interface GraphNode {
	id: string;
	label: string;
	type: "CASE" | "SUBJECT" | "LOCATION" | "SOURCE" | "EVIDENCE";
	weight: number;
}
interface GraphEdge {
	source: string;
	target: string;
	label: string;
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as
			| { id: string; caseRef: string; title: string; victimName: string }
			| undefined;
		if (!caseRow)
			return NextResponse.json({ error: "Case not found" }, { status: 404 });

		const digital = db
			.prepare(
				"SELECT sourceType,sourceName,subject,location,anomalyScore FROM digital_evidence WHERE caseId = ?",
			)
			.all(id) as Array<{
			sourceType: string;
			sourceName: string;
			subject: string;
			location: string;
			anomalyScore: number;
		}>;

		const nodes = new Map<string, GraphNode>();
		const edges: GraphEdge[] = [];

		const caseNodeId = `case:${caseRow.id}`;
		nodes.set(caseNodeId, {
			id: caseNodeId,
			label: caseRow.caseRef || caseRow.title,
			type: "CASE",
			weight: 10,
		});

		if (caseRow.victimName) {
			const vId = `subject:${caseRow.victimName}`;
			nodes.set(vId, {
				id: vId,
				label: `${caseRow.victimName} (victim)`,
				type: "SUBJECT",
				weight: 8,
			});
			edges.push({ source: caseNodeId, target: vId, label: "victim" });
		}

		const bump = (n: GraphNode) => {
			const existing = nodes.get(n.id);
			if (existing) existing.weight += 1;
			else nodes.set(n.id, n);
		};

		for (const d of digital) {
			const subjId = d.subject ? `subject:${d.subject}` : null;
			const locId = d.location ? `location:${d.location}` : null;
			const srcId = d.sourceName
				? `source:${d.sourceName}`
				: d.sourceType
					? `source:${d.sourceType}`
					: null;

			if (subjId)
				bump({ id: subjId, label: d.subject, type: "SUBJECT", weight: 4 });
			if (locId)
				bump({ id: locId, label: d.location, type: "LOCATION", weight: 3 });
			if (srcId)
				bump({
					id: srcId,
					label: d.sourceName || d.sourceType,
					type: "SOURCE",
					weight: 3,
				});

			// Link subject -> location and subject -> source
			if (subjId && locId)
				edges.push({
					source: subjId,
					target: locId,
					label: d.anomalyScore > 70 ? "anomalous" : "at",
				});
			if (subjId && srcId)
				edges.push({ source: subjId, target: srcId, label: "via" });
			if (!subjId && srcId)
				edges.push({ source: caseNodeId, target: srcId, label: "source" });
		}

		return NextResponse.json({
			caseId: id,
			nodes: Array.from(nodes.values()),
			edges,
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
