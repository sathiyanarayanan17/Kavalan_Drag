import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

/**
 * Auth middleware.
 * - Unauthenticated users are redirected to /login for page routes.
 * - READONLY users are blocked from mutating analysis endpoints.
 * - Public paths (login, seed, static assets) are always allowed.
 */

const PUBLIC_PATHS = [
	"/login",
	"/api/auth/login",
	"/api/auth/logout",
	"/api/auth/me",
	"/api/seed",
	"/api/health",
];

// Endpoints that perform analysis/mutation — blocked for READONLY.
const WRITE_API_PREFIXES = ["/api/analyze"];

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Allow public paths and Next internals/assets.
	if (
		PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
		pathname.startsWith("/_next") ||
		pathname.startsWith("/favicon") ||
		pathname.includes(".")
	) {
		return NextResponse.next();
	}

	const session = await verifySession(request.cookies.get(COOKIE_NAME)?.value);

	if (!session) {
		if (pathname.startsWith("/api/")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		url.searchParams.set("from", pathname);
		return NextResponse.redirect(url);
	}

	// Role enforcement: READONLY cannot run analyses.
	if (
		session.role === "READONLY" &&
		WRITE_API_PREFIXES.some((p) => pathname.startsWith(p))
	) {
		return NextResponse.json(
			{ error: "Forbidden — read-only role cannot run analyses" },
			{ status: 403 },
		);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
