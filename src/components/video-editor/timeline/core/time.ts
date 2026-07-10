import type { Range } from "dnd-timeline";
import { FALLBACK_RANGE_MS, TARGET_MARKER_COUNT } from "./constants";

export interface TimelineScaleConfig {
	minItemDurationMs: number;
	defaultItemDurationMs: number;
	minVisibleRangeMs: number;
	/** CapCut-style zoom-out ceiling (can exceed total media length). */
	maxVisibleRangeMs: number;
}

const SCALE_CANDIDATES = [
	{ intervalSeconds: 0.05, gridSeconds: 0.01 },
	{ intervalSeconds: 0.1, gridSeconds: 0.02 },
	{ intervalSeconds: 0.25, gridSeconds: 0.05 },
	{ intervalSeconds: 0.5, gridSeconds: 0.1 },
	{ intervalSeconds: 1, gridSeconds: 0.25 },
	{ intervalSeconds: 2, gridSeconds: 0.5 },
	{ intervalSeconds: 5, gridSeconds: 1 },
	{ intervalSeconds: 10, gridSeconds: 2 },
	{ intervalSeconds: 15, gridSeconds: 3 },
	{ intervalSeconds: 30, gridSeconds: 5 },
	{ intervalSeconds: 60, gridSeconds: 10 },
	{ intervalSeconds: 120, gridSeconds: 20 },
	{ intervalSeconds: 300, gridSeconds: 30 },
	{ intervalSeconds: 600, gridSeconds: 60 },
	{ intervalSeconds: 900, gridSeconds: 120 },
	{ intervalSeconds: 1800, gridSeconds: 180 },
	{ intervalSeconds: 3600, gridSeconds: 300 },
];

export function calculateAxisScale(visibleRangeMs: number): {
	intervalMs: number;
	gridMs: number;
} {
	const visibleSeconds = visibleRangeMs / 1000;
	const candidate =
		SCALE_CANDIDATES.find((scaleCandidate) => {
			if (visibleSeconds <= 0) {
				return true;
			}
			return visibleSeconds / scaleCandidate.intervalSeconds <= TARGET_MARKER_COUNT;
		}) ?? SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1];

	return {
		intervalMs: Math.round(candidate.intervalSeconds * 1000),
		gridMs: Math.round(candidate.gridSeconds * 1000),
	};
}

export function calculateTimelineScale(durationSeconds: number): TimelineScaleConfig {
	const totalMs = Math.max(0, Math.round(durationSeconds * 1000));
	const minItemDurationMs = 100;

	const defaultItemDurationMs =
		totalMs > 0
			? Math.max(minItemDurationMs, Math.min(Math.round(totalMs * 0.05), 30000))
			: Math.max(minItemDurationMs, 1000);

	// Tightest zoom-in: ~0.3s window so tiny regions can still be scrubbed.
	const minVisibleRangeMs = 300;
	// CapCut-style zoom-out: show several× the project so the media strip can
	// shrink well below the timeline width with empty track after it.
	const maxVisibleRangeMs =
		totalMs > 0
			? Math.max(totalMs * 4, totalMs + 180_000, 10_000)
			: Math.max(defaultItemDurationMs * 10, 10_000);

	return {
		minItemDurationMs,
		defaultItemDurationMs,
		minVisibleRangeMs,
		maxVisibleRangeMs,
	};
}

/**
 * Opening view of the timeline. CapCut does NOT stretch the clip to fill the bar —
 * the media sits on the left and empty track continues after it.
 */
export function createInitialRange(
	totalMs: number,
	options?: { maxVisibleRangeMs?: number },
): Range {
	if (totalMs <= 0) {
		return { start: 0, end: FALLBACK_RANGE_MS };
	}

	const maxVisible = options?.maxVisibleRangeMs;
	const ceiling =
		Number.isFinite(maxVisible) && (maxVisible as number) > 0
			? (maxVisible as number)
			: totalMs * 4;

	// ~2.5× media so a ~14 min clip opens like CapCut (~35 min ruler, empty track after).
	// Short clips still get padding without blowing past the zoom-out ceiling.
	const paddedEnd = Math.min(ceiling, Math.max(totalMs * 2.5, totalMs * 1.25));
	return { start: 0, end: paddedEnd };
}

export function normalizeWheelDeltaToPixels(delta: number, deltaMode: number) {
	if (deltaMode === 1) {
		return delta * 16;
	}

	if (deltaMode === 2) {
		return delta * 240;
	}

	return delta;
}

export function formatTimeLabel(milliseconds: number, intervalMs: number) {
	const totalSeconds = milliseconds / 1000;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const fractionalDigits = intervalMs < 250 ? 2 : intervalMs < 1000 ? 1 : 0;

	if (hours > 0) {
		const minutesString = minutes.toString().padStart(2, "0");
		const secondsString = Math.floor(seconds).toString().padStart(2, "0");
		return `${hours}:${minutesString}:${secondsString}`;
	}

	if (fractionalDigits > 0) {
		const secondsWithFraction = seconds.toFixed(fractionalDigits);
		const [wholeSeconds, fraction] = secondsWithFraction.split(".");
		return `${minutes}:${wholeSeconds.padStart(2, "0")}.${fraction}`;
	}

	return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
}

export function formatPlayheadTime(ms: number): string {
	const s = ms / 1000;
	const min = Math.floor(s / 60);
	const sec = s % 60;
	if (min > 0) return `${min}:${sec.toFixed(1).padStart(4, "0")}`;
	return `${sec.toFixed(1)}s`;
}
