export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, verifyUser, createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
	try {
		const { username, password } = await request.json();
		const uname = String(username ?? "").toLowerCase();
		const role = await verifyUser(uname, String(password ?? ""));
		if (!role) {
			return NextResponse.json(
				{ error: "Invalid username or password" },
				{ status: 401 },
			);
		}
		const token = await createSessionCookie(uname, role);
		const res = NextResponse.json({ ok: true, role });
		res.cookies.set(COOKIE_NAME, token, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: COOKIE_MAX_AGE,
		});
		return res;
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
