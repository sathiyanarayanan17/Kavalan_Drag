export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, USERS, createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
	try {
		const { username, password } = await request.json();
		const user = USERS[String(username ?? "").toLowerCase()];
		if (!user || user.password !== password) {
			return NextResponse.json(
				{ error: "Invalid username or password" },
				{ status: 401 },
			);
		}
		const token = await createSessionCookie(
			String(username).toLowerCase(),
			user.role,
		);
		const res = NextResponse.json({ ok: true, role: user.role });
		res.cookies.set(COOKIE_NAME, token, {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: COOKIE_MAX_AGE,
		});
		return res;
	} catch (error) {
		return NextResponse.json({ error: String(error) }, { status: 500 });
	}
}
