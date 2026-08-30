export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(
	_request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id);
		if (!caseRow)
			return NextResponse.json({ error: "Case not found" }, { status: 404 });

		const evidence = db
			.prepare(
				"SELECT * FROM evidence WHERE caseId = ? ORDER BY collectedAt DESC",
			)
			.all(id);
		const activities = db
			.prepare(
				"SELECT * FROM case_activities WHERE caseId = ? ORDER BY createdAt DESC",
			)
			.all(id);
		const autopsyReports = db
			.prepare(
				"SELECT * FROM autopsy_reports WHERE caseId = ? ORDER BY analyzedAt DESC",
			)
			.all(id);
		const digitalEvidence = db
			.prepare(
				"SELECT * FROM digital_evidence WHERE caseId = ? ORDER BY timestamp ASC",
			)
			.all(id);
		const todEstimates = db
			.prepare(
				"SELECT * FROM tod_estimates WHERE caseId = ? ORDER BY estimatedAt DESC",
			)
			.all(id);

		return NextResponse.json({
			...caseRow,
			evidence,
			activities,
			autopsyReports,
			digitalEvidence,
			todEstimates,
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		const body = await request.json();
		const existing = db.prepare("SELECT * FROM cases WHERE id = ?").get(id);
		if (!existing)
			return NextResponse.json({ error: "Case not found" }, { status: 404 });

		const allowed = [
			"title",
			"description",
			"status",
			"riskLevel",
			"riskScore",
			"location",
			"dateOfIncident",
			"assignedAgent",
			"suspectCount",
			"evidenceCount",
			"victimName",
			"tags",
		];
		const setClauses: string[] = [];
		const updateParams: Record<string, unknown> = { id: id };

		for (const field of allowed) {
			if (field in body) {
				setClauses.push(`${field} = $${field}`);
				updateParams[field] = body[field];
			}
		}
		if (setClauses.length === 0)
			return NextResponse.json({ error: "No valid fields" }, { status: 400 });

		db.prepare(`UPDATE cases SET ${setClauses.join(", ")} WHERE id = $id`).run(
			updateParams,
		);

		// Audit log: write STATUS_CHANGED when status actually changes.
		const prev = existing as { status?: string };
		if (
			"status" in body &&
			typeof body.status === "string" &&
			body.status !== prev.status
		) {
			db.prepare(
				"INSERT INTO case_activities (id,caseId,type,description,createdAt,agent) VALUES ($id,$caseId,$type,$description,$createdAt,$agent)",
			).run({
				id: `act-${randomUUID().slice(0, 8)}`,
				caseId: id,
				type: "STATUS_CHANGED",
				description: `Case status changed from ${prev.status ?? "?"} to ${body.status}.`,
				createdAt: new Date().toISOString(),
				agent: "Investigator",
			});
		}

		return NextResponse.json(
			db.prepare("SELECT * FROM cases WHERE id = ?").get(id),
		);
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		// Defense-in-depth: only SUPERVISOR may delete a case.
		const { COOKIE_NAME, verifySession } = await import("@/lib/auth");
		const session = await verifySession(
			request.cookies.get(COOKIE_NAME)?.value,
		);
		if (!session || session.role !== "SUPERVISOR") {
			return NextResponse.json(
				{ error: "Forbidden — only SUPERVISOR may delete cases" },
				{ status: 403 },
			);
		}
		if (!db.prepare("SELECT id FROM cases WHERE id = ?").get(id))
			return NextResponse.json({ error: "Case not found" }, { status: 404 });

		// Remove the case and all related records atomically.
		const tx = db.transaction(() => {
			for (const table of [
				"evidence",
				"digital_evidence",
				"autopsy_reports",
				"tod_estimates",
				"case_activities",
				"custody_log",
			]) {
				try {
					db.prepare(`DELETE FROM ${table} WHERE caseId = ?`).run(id);
				} catch {
					// table may not exist yet (e.g. custody_log) — ignore
				}
			}
			db.prepare("DELETE FROM cases WHERE id = ?").run(id);
		});
		tx();

		return NextResponse.json({ success: true, id });
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
