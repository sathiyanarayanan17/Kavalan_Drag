export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cases/[id]/export?format=csv|html
 *
 * Produces a downloadable case summary:
 *  - csv:  flat evidence + digital-evidence tables
 *  - html: a self-contained printable report (Ctrl+P -> Save as PDF)
 *
 * No external dependencies required.
 */

type Row = Record<string, unknown>;

function esc(v: unknown): string {
	const s = v == null ? "" : String(v);
	return `"${s.replace(/"/g, '""')}"`;
}

function csvSection(title: string, rows: Row[]): string {
	if (rows.length === 0) return `${title}\n(no records)\n`;
	const headers = Object.keys(rows[0]);
	const lines = [
		title,
		headers.map(esc).join(","),
		...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
	];
	return lines.join("\n") + "\n";
}

function h(v: unknown): string {
	const s = v == null ? "" : String(v);
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function htmlTable(rows: Row[]): string {
	if (rows.length === 0) return "<p><em>No records.</em></p>";
	const headers = Object.keys(rows[0]);
	return `<table><thead><tr>${headers
		.map((x) => `<th>${h(x)}</th>`)
		.join("")}</tr></thead><tbody>${rows
		.map(
			(r) =>
				`<tr>${headers.map((x) => `<td>${h(r[x])}</td>`).join("")}</tr>`,
		)
		.join("")}</tbody></table>`;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		const format = (
			request.nextUrl.searchParams.get("format") ?? "html"
		).toLowerCase();

		const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as
			| Row
			| undefined;
		if (!caseRow)
			return NextResponse.json({ error: "Case not found" }, { status: 404 });

		const evidence = db
			.prepare("SELECT catalogRef,type,description,collectedAt,analyst,confidence FROM evidence WHERE caseId = ? ORDER BY collectedAt DESC")
			.all(id) as Row[];
		const autopsy = db
			.prepare("SELECT analyzedAt,causeOfDeath,mannerOfDeath,postmortemInterval,woundsCount,confidence FROM autopsy_reports WHERE caseId = ? ORDER BY analyzedAt DESC")
			.all(id) as Row[];
		const digital = db
			.prepare("SELECT sourceType,sourceName,timestamp,subject,location,anomalyScore FROM digital_evidence WHERE caseId = ? ORDER BY timestamp ASC")
			.all(id) as Row[];
		const tod = db
			.prepare("SELECT estimatedAt,estimatedTodEarliest,estimatedTodLatest,confidenceLevel FROM tod_estimates WHERE caseId = ? ORDER BY estimatedAt DESC")
			.all(id) as Row[];

		const ref = (caseRow.caseRef as string) ?? id;

		if (format === "csv") {
			const body =
				csvSection(`KAVALAN CASE EXPORT — ${ref}`, [caseRow]) +
				"\n" +
				csvSection("EVIDENCE", evidence) +
				"\n" +
				csvSection("AUTOPSY REPORTS", autopsy) +
				"\n" +
				csvSection("DIGITAL EVIDENCE", digital) +
				"\n" +
				csvSection("TOD ESTIMATES", tod);
			return new NextResponse(body, {
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="${ref}.csv"`,
				},
			});
		}

		// HTML report (printable to PDF)
		const html = `<!doctype html><html><head><meta charset="utf-8">
<title>KAVALAN Report — ${h(ref)}</title>
<style>
  body{font-family:Inter,Arial,sans-serif;color:#111;max-width:900px;margin:32px auto;padding:0 24px;}
  h1{border-bottom:3px solid #b8860b;padding-bottom:8px;}
  h2{margin-top:28px;color:#7a5a00;text-transform:uppercase;font-size:14px;letter-spacing:1px;}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px;}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}
  th{background:#f5f0e0;}
  .meta{font-size:12px;color:#666;}
  .disclaimer{margin-top:32px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:12px;}
  @media print{button{display:none;}}
</style></head><body>
<h1>KAVALAN Case Report — ${h(ref)}</h1>
<p class="meta">${h(caseRow.title)} · Status: ${h(caseRow.status)} · Risk: ${h(caseRow.riskLevel)} (${h(caseRow.riskScore)}/100) · Generated ${new Date().toISOString()}</p>
<button onclick="window.print()">Print / Save as PDF</button>
<h2>Case Details</h2>${htmlTable([caseRow])}
<h2>Evidence Inventory</h2>${htmlTable(evidence)}
<h2>Autopsy Reports</h2>${htmlTable(autopsy)}
<h2>Digital Evidence</h2>${htmlTable(digital)}
<h2>Time-of-Death Estimates</h2>${htmlTable(tod)}
<p class="disclaimer">ADVISORY TOOL ONLY. All analyses are probabilistic estimates intended to assist trained professionals, not replace them. ML outputs are approximations and must be reviewed by qualified personnel before use in any legal or investigative proceeding.</p>
</body></html>`;

		return new NextResponse(html, {
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
