import { useEffect } from "react";
import type {
	AudioRegion,
	BRollRegion,
	LayoutRegion,
	SpeedRegion,
	TrimRegion,
	ZoomRegion,
} from "../../types";
import { normalizeRegionSpan } from "../core/spans";

interface UseTimelineNormalizationParams {
	totalMs: number;
	safeMinDurationMs: number;
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	speedRegions: SpeedRegion[];
	audioRegions: AudioRegion[];
	brollRegions?: BRollRegion[];
	layoutRegions?: LayoutRegion[];
	onZoomSpanChange: (id: string, span: { start: number; end: number }) => void;
	onTrimSpanChange?: (id: string, span: { start: number; end: number }) => void;
	onSpeedSpanChange?: (id: string, span: { start: number; end: number }) => void;
	onAudioSpanChange?: (id: string, span: { start: number; end: number }) => void;
	onBrollSpanChange?: (id: string, span: { start: number; end: number }) => void;
	onLayoutSpanChange?: (id: string, span: { start: number; end: number }) => void;
}

export function useTimelineNormalization({
	totalMs,
	safeMinDurationMs,
	zoomRegions,
	trimRegions,
	speedRegions,
	audioRegions,
	brollRegions = [],
	layoutRegions = [],
	onZoomSpanChange,
	onTrimSpanChange,
	onSpeedSpanChange,
	onAudioSpanChange,
	onBrollSpanChange,
	onLayoutSpanChange,
}: UseTimelineNormalizationParams) {
	useEffect(() => {
		if (totalMs === 0 || safeMinDurationMs <= 0) {
			return;
		}

		zoomRegions.forEach((region) => {
			const normalized = normalizeRegionSpan({
				startMs: region.startMs,
				endMs: region.endMs,
				totalMs,
				minDurationMs: safeMinDurationMs,
			});

			if (normalized.start !== region.startMs || normalized.end !== region.endMs) {
				onZoomSpanChange(region.id, normalized);
			}
		});

		trimRegions.forEach((region) => {
			const normalized = normalizeRegionSpan({
				startMs: region.startMs,
				endMs: region.endMs,
				totalMs,
				minDurationMs: safeMinDurationMs,
			});

			if (normalized.start !== region.startMs || normalized.end !== region.endMs) {
				onTrimSpanChange?.(region.id, normalized);
			}
		});

		speedRegions.forEach((region) => {
			const normalized = normalizeRegionSpan({
				startMs: region.startMs,
				endMs: region.endMs,
				totalMs,
				minDurationMs: safeMinDurationMs,
			});

			if (normalized.start !== region.startMs || normalized.end !== region.endMs) {
				onSpeedSpanChange?.(region.id, normalized);
			}
		});

		audioRegions.forEach((region) => {
			const normalized = normalizeRegionSpan({
				startMs: region.startMs,
				endMs: region.endMs,
				totalMs,
				minDurationMs: safeMinDurationMs,
			});

			if (normalized.start !== region.startMs || normalized.end !== region.endMs) {
				onAudioSpanChange?.(region.id, normalized);
			}
		});

		brollRegions.forEach((region) => {
			const normalized = normalizeRegionSpan({
				startMs: region.startMs,
				endMs: region.endMs,
				totalMs,
				minDurationMs: safeMinDurationMs,
			});

			if (normalized.start !== region.startMs || normalized.end !== region.endMs) {
				onBrollSpanChange?.(region.id, normalized);
			}
		});

		layoutRegions.forEach((region) => {
			const normalized = normalizeRegionSpan({
				startMs: region.startMs,
				endMs: region.endMs,
				totalMs,
				minDurationMs: safeMinDurationMs,
			});

			if (normalized.start !== region.startMs || normalized.end !== region.endMs) {
				onLayoutSpanChange?.(region.id, normalized);
			}
		});
	}, [
		totalMs,
		safeMinDurationMs,
		zoomRegions,
		trimRegions,
		speedRegions,
		audioRegions,
		brollRegions,
		layoutRegions,
		onZoomSpanChange,
		onTrimSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
		onBrollSpanChange,
		onLayoutSpanChange,
	]);
}
