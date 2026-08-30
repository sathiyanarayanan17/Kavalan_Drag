/**
 * auth.ts
 * =======
 * Lightweight, dependency-free authentication using an HMAC-signed cookie.
 * Three roles: SUPERVISOR (full), ANALYST (can run analyses), READONLY (view).
 *
 * Demo users are defined below. For production you would replace this with a
 * real user store and password hashing (bcrypt/argon2). The signing secret is
 * read from AUTH_SECRET in the environment (a default is used for local dev).
 *
 * This runs in the Edge runtime (middleware) so it uses the Web Crypto API.
 */

export type Role = "SUPERVISOR" | "ANALYST" | "READONLY";

export interface Session {
	username: string;
	role: Role;
	exp: number; // epoch seconds
}

export const COOKIE_NAME = "kavalan_session";
const SECRET = process.env.AUTH_SECRET ?? "kavalan-dev-secret-change-me";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

// Demo users. username -> { password, role }
export const USERS: Record<string, { password: string; role: Role }> = {
	supervisor: { password: "supervisor", role: "SUPERVISOR" },
	analyst: { password: "analyst", role: "ANALYST" },
	viewer: { password: "viewer", role: "READONLY" },
};

function b64url(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
	const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function hmac(data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(data),
	);
	return b64url(new Uint8Array(sig));
}

export async function createSessionCookie(
	username: string,
	role: Role,
): Promise<string> {
	const session: Session = {
		username,
		role,
		exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
	};
	const payload = b64url(new TextEncoder().encode(JSON.stringify(session)));
	const sig = await hmac(payload);
	return `${payload}.${sig}`;
}

export async function verifySession(token?: string): Promise<Session | null> {
	if (!token) return null;
	const [payload, sig] = token.split(".");
	if (!payload || !sig) return null;
	const expected = await hmac(payload);
	if (sig !== expected) return null;
	try {
		const session = JSON.parse(
			new TextDecoder().decode(fromB64url(payload)),
		) as Session;
		if (session.exp < Math.floor(Date.now() / 1000)) return null;
		return session;
	} catch {
		return null;
	}
}

export const COOKIE_MAX_AGE = MAX_AGE_SECONDS;
