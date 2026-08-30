"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useLivePolling
 * ==============
 * Lightweight real-time updates via polling. Fetches the given URL every
 * `intervalMs` and returns the latest JSON payload. Pauses when the tab is
 * hidden to save resources. This gives a live-updating feel without a custom
 * WebSocket server.
 */
export function useLivePolling<T>(url: string, intervalMs = 5000) {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		let cancelled = false;

		const tick = async () => {
			if (document.hidden) return;
			try {
				const res = await fetch(url, { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = (await res.json()) as T;
				if (!cancelled) {
					setData(json);
					setError(null);
				}
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : "poll failed");
			}
		};

		tick();
		timer.current = setInterval(tick, intervalMs);
		return () => {
			cancelled = true;
			if (timer.current) clearInterval(timer.current);
		};
	}, [url, intervalMs]);

	return { data, error };
}
