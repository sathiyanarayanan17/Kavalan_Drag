import { describe, it, expect } from "vitest";
import { assessDisagreement } from "@/lib/uncertainty";

describe("assessDisagreement", () => {
	it("reports LOW uncertainty when all methods agree", () => {
		const r = assessDisagreement([
			{ method: "ML", value: "HOMICIDE", confidence: 0.9 },
			{ method: "rules", value: "HOMICIDE", confidence: 0.8 },
		]);
		expect(r.uncertainty).toBe("LOW");
		expect(r.flagged).toBe(false);
		expect(r.consensus.toUpperCase()).toBe("HOMICIDE");
		expect(r.agreement).toBe(1);
	});

	it("flags HIGH/MODERATE uncertainty when methods disagree", () => {
		const r = assessDisagreement([
			{ method: "ML", value: "SUICIDE", confidence: 0.9 },
			{ method: "rules", value: "HOMICIDE", confidence: 0.8 },
		]);
		expect(r.flagged).toBe(true);
		expect(["MODERATE", "HIGH"]).toContain(r.uncertainty);
		expect(r.agreement).toBeLessThan(1);
	});

	it("is case-insensitive when tallying", () => {
		const r = assessDisagreement([
			{ method: "ML", value: "Homicide" },
			{ method: "rules", value: "HOMICIDE" },
		]);
		expect(r.uncertainty).toBe("LOW");
	});

	it("raises uncertainty when consensus is low-confidence", () => {
		const r = assessDisagreement([
			{ method: "ML", value: "NATURAL", confidence: 0.3 },
			{ method: "rules", value: "NATURAL", confidence: 0.4 },
		]);
		expect(r.uncertainty).toBe("MODERATE");
	});

	it("handles the empty case", () => {
		const r = assessDisagreement([]);
		expect(r.uncertainty).toBe("HIGH");
		expect(r.flagged).toBe(true);
	});
});
