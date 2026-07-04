import type { Span } from "dnd-timeline";
import { useCallback, useMemo } from "react";
import type { LayoutRegion } from "../../../types";
import { timelineNotifications } from "../utils/timelineNotifications";

// Default length of a layout region added manually from the timeline.
export const DEFAULT_LAYOUT_REGION_DURATION_MS = 4000;
// Below this, there's too little room to bother placing a region at all.
const MIN_LAYOUT_REGION_DURATION_MS = 250;

interface UseTimelineLayoutActionsParams {
	timeline: {
		videoDuration: number;
		totalMs: number;
		currentTimeMs: number;
	};
	regions: {
		layout: LayoutRegion[];
		clip: { startMs: number; endMs: number }[];
	};
	onLayoutAdded?: (span: Span) => void;
}

export function useTimelineLayoutActions({
	timeline,
	regions,
	onLayoutAdded,
}: UseTimelineLayoutActionsParams) {
	const { videoDuration, totalMs, currentTimeMs } = timeline;
	const { layout: layoutRegions, clip: clipRegions } = regions;
	const defaultRegionDurationMs = useMemo(
		() => Math.min(DEFAULT_LAYOUT_REGION_DURATION_MS, totalMs),
		[totalMs],
	);

	// Room available for a new region starting at startPos before it would
	// overlap the next layout region or run past the active clip's end.
	// Returns null when startPos sits inside an existing region (no room at all).
	const availableDurationAtMs = useCallback(
		(startMs: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return null;
			}

			const startPos = Math.max(0, Math.min(startMs, totalMs));
			const activeClip =
				clipRegions.length === 0
					? { startMs: 0, endMs: totalMs }
					: clipRegions.find((clip) => startPos >= clip.startMs && startPos < clip.endMs);
			if (!activeClip) {
				return null;
			}

			const sorted = [...layoutRegions].sort((a, b) => a.startMs - b.startMs);
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping) {
				return null;
			}

			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNextClipEdge = activeClip.endMs - startPos;
			const gapToNextRegion = nextRegion ? nextRegion.startMs - startPos : gapToNextClipEdge;
			return Math.min(gapToNextClipEdge, gapToNextRegion);
		},
		[videoDuration, totalMs, clipRegions, layoutRegions],
	);

	const canPlaceLayoutAtMs = useCallback(
		(startMs: number) => {
			const available = availableDurationAtMs(startMs);
			return available !== null && available >= MIN_LAYOUT_REGION_DURATION_MS;
		},
		[availableDurationAtMs],
	);

	const addLayoutAtMs = useCallback(
		(startMs: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const startPos = Math.max(0, Math.min(startMs, totalMs));
			const available = availableDurationAtMs(startPos);
			if (available === null || available < MIN_LAYOUT_REGION_DURATION_MS) {
				timelineNotifications.error(
					"Cannot place layout region here",
					"A layout region already exists at the playhead, or there's no room left in this clip.",
				);
				return;
			}

			// Shrink to whatever room is actually there instead of refusing —
			// the user can always resize afterward.
			const duration = Math.min(defaultDuration, available);
			onLayoutAdded?.({ start: startPos, end: startPos + duration });
		},
		[videoDuration, totalMs, defaultRegionDurationMs, availableDurationAtMs, onLayoutAdded],
	);

	const handleAddLayout = useCallback(() => {
		if (!videoDuration || videoDuration === 0 || totalMs === 0) {
			return;
		}

		addLayoutAtMs(currentTimeMs);
	}, [videoDuration, totalMs, currentTimeMs, addLayoutAtMs]);

	return {
		defaultRegionDurationMs,
		canPlaceLayoutAtMs,
		addLayoutAtMs,
		handleAddLayout,
	};
}
