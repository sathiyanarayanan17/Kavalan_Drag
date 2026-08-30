/**
 * custody.ts
 * ==========
 * Tamper-evident chain-of-custody audit log.
 *
 * Every significant action (evidence added, analysis run, status changed) is
 * appended as a record whose hash includes the hash of the PREVIOUS record —
 * a hash chain. If any historical record is altered or deleted, every
 * subsequent hash stops matching and the chain is detectably broken.
 *
 * This is a real forensic requirement (chain of custody / admissibility) and
 * is implemented with Node's crypto (SHA-256). Records live in a dedicated
 * `custody_log` table.
 */

import crypto from "crypto";
import { db } from "@/lib/db";

export interface CustodyRecord {
	id: string;
	caseId: string;
	seq: number;
	action: string;
	detail: string;
	actor: string;
	createdAt: string;
	prevHash: string;
	hash: string;
}

const GENESIS = "0".repeat(64);

export function initCustody(): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS custody_log (
			id TEXT PRIMARY KEY,
			caseId TEXT NOT NULL,
			seq INTEGER NOT NULL,
			action TEXT NOT NULL,
			detail TEXT NOT NULL DEFAULT '',
			actor TEXT NOT NULL DEFAULT 'system',
			createdAt TEXT NOT NULL,
			prevHash TEXT NOT NULL,
			hash TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_custody_case ON custody_log(caseId, seq);
	`);
}

function computeHash(r: Omit<CustodyRecord, "hash">): string {
	const payload = `${r.id}|${r.caseId}|${r.seq}|${r.action}|${r.detail}|${r.actor}|${r.createdAt}|${r.prevHash}`;
	return crypto.createHash("sha256").update(payload).digest("hex");
}

/** Append a tamper-evident record to a case's custody chain. */
export function appendCustody(
	caseId: string,
	action: string,
	detail: string,
	actor = "KAVALAN",
): CustodyRecord {
	initCustody();
	const last = db
		.prepare(
			"SELECT seq, hash FROM custody_log WHERE caseId = ? ORDER BY seq DESC LIMIT 1",
		)
		.get(caseId) as { seq: number; hash: string } | undefined;

	const seq = (last?.seq ?? 0) + 1;
	const prevHash = last?.hash ?? GENESIS;
	const base: Omit<CustodyRecord, "hash"> = {
		id: `cust-${crypto.randomUUID().slice(0, 8)}`,
		caseId,
		seq,
		action,
		detail,
		actor,
		createdAt: new Date().toISOString(),
		prevHash,
	};
	const hash = computeHash(base);
	const record: CustodyRecord = { ...base, hash };

	db.prepare(
		`INSERT INTO custody_log (id,caseId,seq,action,detail,actor,createdAt,prevHash,hash)
		 VALUES ($id,$caseId,$seq,$action,$detail,$actor,$createdAt,$prevHash,$hash)`,
	).run(record);

	return record;
}

/** Return the full chain for a case. */
export function getCustodyChain(caseId: string): CustodyRecord[] {
	initCustody();
	return db
		.prepare("SELECT * FROM custody_log WHERE caseId = ? ORDER BY seq ASC")
		.all(caseId) as CustodyRecord[];
}

/**
 * Verify a case's chain integrity. Returns whether it's intact and, if not,
 * the sequence number where the break was detected.
 */
export function verifyCustodyChain(caseId: string): {
	intact: boolean;
	length: number;
	brokenAtSeq?: number;
	reason?: string;
} {
	const chain = getCustodyChain(caseId);
	let prevHash = GENESIS;
	for (const r of chain) {
		if (r.prevHash !== prevHash) {
			return {
				intact: false,
				length: chain.length,
				brokenAtSeq: r.seq,
				reason: "prevHash mismatch (a prior record was altered or removed)",
			};
		}
		const expected = computeHash({
			id: r.id,
			caseId: r.caseId,
			seq: r.seq,
			action: r.action,
			detail: r.detail,
			actor: r.actor,
			createdAt: r.createdAt,
			prevHash: r.prevHash,
		});
		if (expected !== r.hash) {
			return {
				intact: false,
				length: chain.length,
				brokenAtSeq: r.seq,
				reason: "record hash mismatch (this record was tampered with)",
			};
		}
		prevHash = r.hash;
	}
	return { intact: true, length: chain.length };
}
