import { describe, it, expect } from "vitest";
import { calculateRiskScore } from "@/lib/ai-engine";

const base = {
	caseId: "t",
	evidenceCount: 0,
	suspectCount: 0,
	digitalAnomalyCount: 0,
	hasAutopsy: true,
	hasTodEstimate: true,
	openTimelinGaps: 0,
	caseAgeHours: 1000, // old case -> low urgency
};

describe("calculateRiskScore", () => {
	it("returns a bounded 0-100 overall score", () => {
		const r = calculateRiskScore(base);
		expect(r.overall).toBeGreaterThanOrEqual(0);
		expect(r.overall).toBeLessThanOrEqual(100);
	});

	it("assigns LOW tier to a quiet, complete, old case", () => {
		const r = calculateRiskScore(base);
		expect(r.tier).toBe("LOW");
	});

	it("escalates tier as risk factors increase", () => {
		const high = calculateRiskScore({
			...base,
			evidenceCount: 20,
			suspectCount: 5,
			digitalAnomalyCount: 6,
			hasAutopsy: false,
			hasTodEstimate: false,
			caseAgeHours: 2, // fresh -> max urgency
		});
		expect(["HIGH", "CRITICAL"]).toContain(high.tier);
		expect(high.overall).toBeGreaterThan(calculateRiskScore(base).overall);
	});

	it("respects tier thresholds (>=70 CRITICAL, >=50 HIGH, >=30 MEDIUM)", () => {
		const r = calculateRiskScore({
			...base,
			suspectCount: 5, // 20
			digitalAnomalyCount: 6, // 20
			hasAutopsy: false,
			hasTodEstimate: false, // 20
			caseAgeHours: 0, // 20
			evidenceCount: 20, // ~18
		});
		expect(r.overall).toBeGreaterThanOrEqual(70);
		expect(r.tier).toBe("CRITICAL");
	});

	it("flags homicide with no suspects in recommendations/anomalies", () => {
		const r = calculateRiskScore({
			...base,
			mannerOfDeath: "HOMICIDE",
			suspectCount: 0,
		});
		expect(r.anomalies.join(" ")).toContain("Homicide");
	});

	it("returns exactly five scoring factors", () => {
		const r = calculateRiskScore(base);
		expect(r.factors).toHaveLength(5);
	});
});
