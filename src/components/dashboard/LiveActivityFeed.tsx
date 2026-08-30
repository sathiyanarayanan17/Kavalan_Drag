"use client";

import { useLivePolling } from "@/lib/useLivePolling";
import { timeAgo } from "@/lib/utils";
import type { CaseActivity } from "@/types";

/**
 * LiveActivityFeed
 * ================
 * Self-refreshing activity feed. Polls /api/activities every 5s so the
 * dashboard reflects new analyses/evidence in near real-time.
 */
export default function LiveActivityFeed() {
	const { data } = useLivePolling<CaseActivity[]>("/api/activities", 5000);
	const activities = Array.isArray(data) ? data.slice(0, 8) : [];

	return (
		<div className="bg-surface-1">
			<div className="px-5 py-3 border-b border-border-DEFAULT flex items-center justify-between">
				<p className="font-mono text-xs uppercase tracking-wider text-dim">
					LIVE ACTIVITY
				</p>
				<span
					className="font-mono text-xs"
					style={{ color: "var(--low, #5ae0a0)" }}
					title="Auto-refreshing every 5s"
				>
					● LIVE
				</span>
			</div>
			{activities.length === 0 ? (
				<div className="flex items-center justify-center py-12">
					<span className="font-mono text-xs text-dim">NO ACTIVITY YET</span>
				</div>
			) : (
				<ul className="divide-y divide-border-DEFAULT list-none p-0 m-0">
					{activities.map((a) => (
						<li key={a.id} className="flex items-start gap-3 px-5 py-3">
							<span className="font-mono text-xs text-dim shrink-0 tabular-nums pt-0.5 w-[72px]">
								{timeAgo(a.createdAt)}
							</span>
							<span className="flex-1 font-sans text-xs text-data leading-snug">
								{a.description}
							</span>
							<span className="font-mono text-xs text-dim shrink-0 truncate max-w-[96px] text-right">
								{a.agent}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
