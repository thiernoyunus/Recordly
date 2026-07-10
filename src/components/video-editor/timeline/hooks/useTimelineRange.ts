import type { Range } from "dnd-timeline";
import { useCallback, useEffect, useMemo, useState, type RefObject, type WheelEvent } from "react";
import { createInitialRange, normalizeWheelDeltaToPixels } from "../core/time";
import { clampRange } from "../dnd/engine";

interface UseTimelineRangeParams {
	totalMs: number;
	timelineContainerRef: RefObject<HTMLDivElement>;
	minVisibleRangeMs?: number;
	maxVisibleRangeMs?: number;
}

export interface TimelineWheelPanDeltaInput {
	deltaX: number;
	deltaY: number;
	deltaMode: number;
	shiftKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	canScrollVertically?: boolean;
}

export function resolveTimelineWheelPanDeltaPx({
	deltaX,
	deltaY,
	deltaMode,
	shiftKey = false,
	ctrlKey = false,
	metaKey = false,
	canScrollVertically = true,
}: TimelineWheelPanDeltaInput) {
	if ((ctrlKey || metaKey) && !shiftKey) {
		return 0;
	}

	if (Math.abs(deltaX) > 0) {
		return normalizeWheelDeltaToPixels(deltaX, deltaMode);
	}

	if ((shiftKey || !canScrollVertically) && Math.abs(deltaY) > 0) {
		return normalizeWheelDeltaToPixels(deltaY, deltaMode);
	}

	return 0;
}

export function useTimelineRange({
	totalMs,
	timelineContainerRef,
	minVisibleRangeMs = 300,
	maxVisibleRangeMs,
}: UseTimelineRangeParams) {
	const resolvedMaxVisible =
		maxVisibleRangeMs ?? (totalMs > 0 ? totalMs * 4 : undefined);

	const [range, setRange] = useState<Range>(() =>
		createInitialRange(totalMs, { maxVisibleRangeMs: resolvedMaxVisible }),
	);

	const rangeClampConfig = useMemo(
		() => ({
			totalMs,
			minVisibleRangeMs,
			maxVisibleRangeMs: resolvedMaxVisible,
		}),
		[minVisibleRangeMs, resolvedMaxVisible, totalMs],
	);

	useEffect(() => {
		// Re-open with CapCut-style padding whenever the project duration changes.
		setRange(createInitialRange(totalMs, { maxVisibleRangeMs: resolvedMaxVisible }));
	}, [resolvedMaxVisible, totalMs]);

	const clampedRange = useMemo<Range>(
		() => clampRange(range, rangeClampConfig),
		[range, rangeClampConfig],
	);

	const panTimelineRange = useCallback(
		(deltaMs: number) => {
			if (!Number.isFinite(deltaMs) || deltaMs === 0 || totalMs <= 0) {
				return;
			}

			setRange((previous) => {
				const normalized = clampRange(previous, rangeClampConfig);
				const visibleSpan = Math.max(1, normalized.end - normalized.start);
				// When zoomed out past the media, maxStart is 0 (content pinned left).
				const maxStart = Math.max(0, totalMs - Math.min(visibleSpan, totalMs));
				const nextStart = Math.max(0, Math.min(normalized.start + deltaMs, maxStart));
				return clampRange(
					{ start: nextStart, end: nextStart + visibleSpan },
					rangeClampConfig,
				);
			});
		},
		[rangeClampConfig, totalMs],
	);

	const handleTimelineWheel = useCallback(
		(event: WheelEvent<HTMLDivElement>) => {
			if (((event.ctrlKey || event.metaKey) && !event.shiftKey) || totalMs <= 0) {
				return;
			}

			const container = timelineContainerRef.current;
			const horizontalDeltaPx = resolveTimelineWheelPanDeltaPx({
				deltaX: event.deltaX,
				deltaY: event.deltaY,
				deltaMode: event.deltaMode,
				shiftKey: event.shiftKey,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				canScrollVertically: container
					? container.scrollHeight > container.clientHeight + 1
					: true,
			});

			if (horizontalDeltaPx === 0) {
				return;
			}

			const containerWidth = container?.clientWidth ?? 0;
			const visibleRangeMs = clampedRange.end - clampedRange.start;
			if (containerWidth <= 0 || visibleRangeMs <= 0) {
				return;
			}

			event.preventDefault();
			const deltaMs = (horizontalDeltaPx / containerWidth) * visibleRangeMs;
			panTimelineRange(deltaMs);
		},
		[clampedRange.end, clampedRange.start, panTimelineRange, timelineContainerRef, totalMs],
	);

	return {
		range,
		setRange,
		clampedRange,
		handleTimelineWheel,
	};
}
