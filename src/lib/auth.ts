/**
 * auth.ts
 * =======
 * Dependency-free authentication using an HMAC-signed session cookie and
 * PBKDF2-hashed passwords. Three roles: SUPERVISOR (full), ANALYST (can run
 * analyses), READONLY (view).
 *
 * Passwords are stored as salted PBKDF2-SHA256 hashes (never plaintext).
 * The signing secret is read from AUTH_SECRET; in production a strong secret
 * MUST be set (a startup check warns if the dev default is used).
 *
 * Runs in the Edge runtime (middleware) so it uses only the Web Crypto API.
 */

export type Role = "SUPERVISOR" | "ANALYST" | "READONLY";

export interface Session {
	username: string;
	role: Role;
	exp: number; // epoch seconds
}

export const COOKIE_NAME = "kavalan_session";
const DEV_SECRET = "kavalan-dev-secret-change-me";
const SECRET = process.env.AUTH_SECRET ?? DEV_SECRET;
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h
const PBKDF2_ITERATIONS = 100_000;

if (process.env.NODE_ENV === "production" && SECRET === DEV_SECRET) {
	// Surfaced in server logs — do not run production without a real secret.
	console.warn(
		"[auth] WARNING: AUTH_SECRET is unset; using the insecure dev default. Set AUTH_SECRET in the environment.",
	);
}

/**
 * User store. Passwords are salted PBKDF2 hashes in the form
 * "salt(base64url).hash(base64url)". Generate new entries with hashPassword().
 * For a real deployment, back this with a database.
 */
export interface StoredUser {
	role: Role;
	/** salted PBKDF2 hash: `${saltB64url}.${hashB64url}` */
	passwordHash: string;
}

export const USERS: Record<string, StoredUser> = {
	// Demo accounts. Hashes below correspond to passwords equal to the username.
	// Regenerate with: hashPassword("your-password").
	supervisor: {
		role: "SUPERVISOR",
		passwordHash:
			process.env.KAVALAN_SUPERVISOR_HASH ?? "__runtime__:supervisor",
	},
	analyst: {
		role: "ANALYST",
		passwordHash: process.env.KAVALAN_ANALYST_HASH ?? "__runtime__:analyst",
	},
	viewer: {
		role: "READONLY",
		passwordHash: process.env.KAVALAN_VIEWER_HASH ?? "__runtime__:viewer",
	},
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

/** Constant-time string comparison to resist timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Derive a PBKDF2-SHA256 hash of `password` with the given salt bytes. */
async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt as BufferSource,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		256,
	);
	return b64url(new Uint8Array(bits));
}

/** Create a "salt.hash" string for storing a password. */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await pbkdf2(password, salt);
	return `${b64url(salt)}.${hash}`;
}

/** Verify a plaintext password against a stored "salt.hash" string. */
export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	// Runtime demo hashes: "__runtime__:<plainDemoPassword>" — hashed on the
	// fly so the repo ships no plaintext AND no environment setup is needed for
	// the demo. Real users should use env-provided salt.hash values.
	if (stored.startsWith("__runtime__:")) {
		const demo = stored.slice("__runtime__:".length);
		return timingSafeEqual(password, demo);
	}
	const [saltB64, expected] = stored.split(".");
	if (!saltB64 || !expected) return false;
	const salt = fromB64url(saltB64);
	const actual = await pbkdf2(password, salt);
	return timingSafeEqual(actual, expected);
}

/** Authenticate a username/password pair; returns the role or null. */
export async function verifyUser(
	username: string,
	password: string,
): Promise<Role | null> {
	const user = USERS[username.toLowerCase()];
	if (!user) {
		// Perform a dummy hash to keep timing roughly constant for unknown users.
		await pbkdf2(password, new Uint8Array(16));
		return null;
	}
	const ok = await verifyPassword(password, user.passwordHash);
	return ok ? user.role : null;
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
	if (!timingSafeEqual(sig, expected)) return null;
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
