/**
 * ml-client.ts
 * ============
 * Thin client for the KAVALAN ML microservice (ml/service.py).
 *
 * Every call is defensive: short timeout, and on ANY failure (service down,
 * model not loaded, network error) it returns `null` so the caller falls back
 * to the existing rule-based engine. The app therefore never breaks whether or
 * not the ML service is running.
 *
 * Set ML_SERVICE_URL in .env.local to override the default.
 */

const BASE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8008";
const TIMEOUT_MS = 4000;

async function post<T>(path: string, body: unknown): Promise<T | null> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		const res = await fetch(`${BASE_URL}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		clearTimeout(timer);
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

export interface MlAutopsyResult {
	mannerOfDeath: string;
	confidence: number; // 0..1
	probabilities: Record<string, number>;
}

export interface MlDigitalResult {
	highAnomaly: boolean;
	anomalyProbability: number; // 0..1
}

export interface MlRiskResult {
	riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	confidence: number; // 0..1
	probabilities: Record<string, number>;
	predictedScore?: number; // 0..100
	explanation?: Array<{ feature: string; contribution: number }>;
}

export function mlAutopsy(text: string) {
	return post<MlAutopsyResult>("/predict/autopsy", { text });
}

export function mlDigital(input: {
	sourceType: string;
	hour: number;
	temporalDeviation: number;
	novelLocation: number;
	burstCount: number;
	frequencyDeviation: number;
	subjectDiversity: number;
	confidence: number;
}) {
	return post<MlDigitalResult>("/predict/digital", input);
}

export function mlRisk(input: {
	evidenceCount: number;
	suspectCount: number;
	digitalAnomalyCount: number;
	hasAutopsy: number;
	hasTodEstimate: number;
	mannerOfDeath: string;
	openTimelineGaps: number;
	caseAgeHours: number;
}) {
	return post<MlRiskResult>("/predict/risk", input);
}

export async function mlHealth(): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		const res = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
		clearTimeout(timer);
		return res.ok;
	} catch {
		return false;
	}
}
