export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { getCustodyChain, verifyCustodyChain } from "@/lib/custody";

/**
 * GET /api/cases/[id]/custody
 * Returns the tamper-evident chain-of-custody log for a case plus an integrity
 * verification result.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: { id: string } },
) {
	try {
		const { id } = params;
		const chain = getCustodyChain(id);
		const integrity = verifyCustodyChain(id);
		return NextResponse.json({ caseId: id, integrity, chain });
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
