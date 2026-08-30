export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
	const session = await verifySession(request.cookies.get(COOKIE_NAME)?.value);
	if (!session) return NextResponse.json({ authenticated: false });
	return NextResponse.json({
		authenticated: true,
		username: session.username,
		role: session.role,
	});
}
