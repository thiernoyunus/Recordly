import type { Span } from "dnd-timeline";
import { useCallback, useMemo } from "react";
import type {
	AnnotationRegion,
	AudioRegion,
	BRollRegion,
	CaptionCue,
	ClipRegion,
	LayoutRegion,
	SpeedRegion,
	TrimRegion,
	ZoomRegion,
} from "../../types";
import {
	getAnnotationTrackIndex,
	getAudioTrackIndex,
	getBrollTrackIndex,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
	isBrollTrackRowId,
} from "../core/rows";
import { spansOverlap } from "../core/spans";
import type { TimelineRenderItem } from "../core/timelineTypes";
import { buildAllRegionSpans, buildTimelineItems, resolveDropRowId } from "../model/timelineModel";

interface UseTimelineDndBindingsParams {
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	clipRegions: ClipRegion[];
	annotationRegions: AnnotationRegion[];
	speedRegions: SpeedRegion[];
	audioRegions: AudioRegion[];
	brollRegions?: BRollRegion[];
	captionCues: CaptionCue[];
	layoutRegions?: LayoutRegion[];
	onZoomSpanChange: (id: string, span: Span) => void;
	onTrimSpanChange?: (id: string, span: Span) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onSpeedSpanChange?: (id: string, span: Span) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onBrollSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onCaptionSpanChange?: (id: string, span: Span) => void;
	onLayoutSpanChange?: (id: string, span: Span) => void;
}

type TimelineItemKind =
	| "zoom"
	| "trim"
	| "clip"
	| "annotation"
	| "speed"
	| "audio"
	| "broll"
	| "caption"
	| "layout"
	| null;

export function useTimelineDndBindings({
	zoomRegions,
	trimRegions,
	clipRegions,
	annotationRegions,
	speedRegions,
	audioRegions,
	brollRegions = [],
	captionCues,
	layoutRegions = [],
	onZoomSpanChange,
	onTrimSpanChange,
	onClipSpanChange,
	onAnnotationSpanChange,
	onSpeedSpanChange,
	onAudioSpanChange,
	onBrollSpanChange,
	onCaptionSpanChange,
	onLayoutSpanChange,
}: UseTimelineDndBindingsParams) {
	const resolveItemKind = useCallback(
		(id: string): TimelineItemKind => {
			if (zoomRegions.some((r) => r.id === id)) return "zoom";
			if (trimRegions.some((r) => r.id === id)) return "trim";
			if (clipRegions.some((r) => r.id === id)) return "clip";
			if (annotationRegions.some((r) => r.id === id)) return "annotation";
			if (speedRegions.some((r) => r.id === id)) return "speed";
			if (audioRegions.some((r) => r.id === id)) return "audio";
			if (brollRegions.some((r) => r.id === id)) return "broll";
			if (captionCues.some((c) => c.id === id)) return "caption";
			if (layoutRegions.some((r) => r.id === id)) return "layout";
			return null;
		},
		[
			zoomRegions,
			trimRegions,
			clipRegions,
			annotationRegions,
			speedRegions,
			audioRegions,
			brollRegions,
			captionCues,
			layoutRegions,
		],
	);

	const resolveTrackIndex = useCallback(
		(kind: "annotation" | "audio" | "broll", id: string, rowId?: string): number => {
			if (kind === "annotation") {
				return rowId && isAnnotationTrackRowId(rowId)
					? getAnnotationTrackIndex(rowId)
					: (annotationRegions.find((region) => region.id === id)?.trackIndex ?? 0);
			}
			if (kind === "broll") {
				return rowId && isBrollTrackRowId(rowId)
					? getBrollTrackIndex(rowId)
					: (brollRegions.find((region) => region.id === id)?.trackIndex ?? 0);
			}
			return rowId && isAudioTrackRowId(rowId)
				? getAudioTrackIndex(rowId)
				: (audioRegions.find((region) => region.id === id)?.trackIndex ?? 0);
		},
		[annotationRegions, audioRegions, brollRegions],
	);

	const hasOverlap = useCallback(
		(newSpan: Span, excludeId?: string, rowId?: string): boolean => {
			if (!excludeId) return false;
			const itemKind = resolveItemKind(excludeId);

			if (itemKind === "annotation") return false;

			const checkOverlap = (regions: { id: string; startMs: number; endMs: number }[]) =>
				regions.some((region) => {
					if (region.id === excludeId) return false;
					return spansOverlap(newSpan, { start: region.startMs, end: region.endMs });
				});

			if (itemKind === "zoom") return checkOverlap(zoomRegions);
			if (itemKind === "trim") return checkOverlap(trimRegions);
			if (itemKind === "clip") return checkOverlap(clipRegions);
			if (itemKind === "speed") return checkOverlap(speedRegions);
			// Captions share a single lane and must never overlap, so validate a dragged or
			// resized caption against the other cues just like the other timeline items.
			if (itemKind === "caption") return checkOverlap(captionCues);
			// Layout regions share a single lane like zoom regions and must never overlap.
			if (itemKind === "layout") return checkOverlap(layoutRegions);

			if (itemKind === "audio") {
				const activeTrackIndex = resolveTrackIndex("audio", excludeId, rowId);
				return checkOverlap(
					audioRegions.filter((region) => (region.trackIndex ?? 0) === activeTrackIndex),
				);
			}

			if (itemKind === "broll") {
				const activeTrackIndex = resolveTrackIndex("broll", excludeId, rowId);
				return checkOverlap(
					brollRegions.filter((region) => (region.trackIndex ?? 0) === activeTrackIndex),
				);
			}

			return false;
		},
		[
			resolveItemKind,
			resolveTrackIndex,
			zoomRegions,
			trimRegions,
			clipRegions,
			audioRegions,
			brollRegions,
			speedRegions,
			captionCues,
			layoutRegions,
		],
	);

	const timelineItems = useMemo<TimelineRenderItem[]>(
		() =>
			buildTimelineItems({
				zoomRegions,
				clipRegions,
				annotationRegions,
				audioRegions,
				brollRegions,
				captionCues,
				layoutRegions,
			}),
		[
			zoomRegions,
			clipRegions,
			annotationRegions,
			audioRegions,
			brollRegions,
			captionCues,
			layoutRegions,
		],
	);

	const allRegionSpans = useMemo(
		() =>
			buildAllRegionSpans({
				zoomRegions,
				clipRegions,
				audioRegions,
				brollRegions,
				layoutRegions,
			}),
		[zoomRegions, clipRegions, audioRegions, brollRegions, layoutRegions],
	);

	const getResolvedDropRowId = useCallback(
		(id: string, proposedRowId: string) => resolveDropRowId(id, proposedRowId, timelineItems),
		[timelineItems],
	);

	const handleItemSpanChange = useCallback(
		(id: string, span: Span, rowId?: string) => {
			const itemKind = resolveItemKind(id);
			if (itemKind === "zoom") {
				onZoomSpanChange(id, span);
			} else if (itemKind === "trim") {
				onTrimSpanChange?.(id, span);
			} else if (itemKind === "clip") {
				onClipSpanChange?.(id, span);
			} else if (itemKind === "annotation") {
				const nextTrackIndex = resolveTrackIndex("annotation", id, rowId);
				onAnnotationSpanChange?.(id, span, nextTrackIndex);
			} else if (itemKind === "speed") {
				onSpeedSpanChange?.(id, span);
			} else if (itemKind === "audio") {
				const nextTrackIndex = resolveTrackIndex("audio", id, rowId);
				onAudioSpanChange?.(id, span, nextTrackIndex);
			} else if (itemKind === "broll") {
				const nextTrackIndex = resolveTrackIndex("broll", id, rowId);
				onBrollSpanChange?.(id, span, nextTrackIndex);
			} else if (itemKind === "caption") {
				onCaptionSpanChange?.(id, span);
			} else if (itemKind === "layout") {
				onLayoutSpanChange?.(id, span);
			}
		},
		[
			resolveItemKind,
			resolveTrackIndex,
			onZoomSpanChange,
			onTrimSpanChange,
			onClipSpanChange,
			onAnnotationSpanChange,
			onSpeedSpanChange,
			onAudioSpanChange,
			onBrollSpanChange,
			onCaptionSpanChange,
			onLayoutSpanChange,
		],
	);

	return {
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
	};
}
