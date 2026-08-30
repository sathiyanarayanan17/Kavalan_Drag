import { describe, it, expect, afterAll } from "vitest";
import {
	appendCustody,
	getCustodyChain,
	verifyCustodyChain,
} from "@/lib/custody";
import { db } from "@/lib/db";

const TEST_CASE = `__test_custody_${Date.now()}`;

afterAll(() => {
	try {
		db.prepare("DELETE FROM custody_log WHERE caseId = ?").run(TEST_CASE);
	} catch {
		/* ignore */
	}
});

describe("chain of custody", () => {
	it("appends records that form an intact chain", () => {
		appendCustody(TEST_CASE, "EVIDENCE_ADDED", "item 1");
		appendCustody(TEST_CASE, "ANALYSIS_RUN", "autopsy");
		appendCustody(TEST_CASE, "RISK_SCORED", "tier HIGH");

		const chain = getCustodyChain(TEST_CASE);
		expect(chain).toHaveLength(3);
		expect(chain[0].seq).toBe(1);
		expect(chain[2].seq).toBe(3);

		const result = verifyCustodyChain(TEST_CASE);
		expect(result.intact).toBe(true);
		expect(result.length).toBe(3);
	});

	it("detects tampering with a historical record", () => {
		// Tamper: alter the detail of record #2 directly in the DB.
		db.prepare(
			"UPDATE custody_log SET detail = ? WHERE caseId = ? AND seq = 2",
		).run("TAMPERED", TEST_CASE);

		const result = verifyCustodyChain(TEST_CASE);
		expect(result.intact).toBe(false);
		expect(result.brokenAtSeq).toBe(2);
	});
});
