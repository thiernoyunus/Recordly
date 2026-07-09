import { useCallback, useMemo } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import { DEFAULT_BROLL_IMAGE_DURATION_MS, inferBRollMediaKind } from "../../../types";
import type { TimelineBrollRegion } from "../../core/timelineTypes";
import { resolveAudioPlacement } from "../utils/timelineAudioPlacement";
import { timelineNotifications } from "../utils/timelineNotifications";

interface MediaFilePickerResult {
	success: boolean;
	path?: string;
}

interface TimelineBrollActionsDeps {
	openFilePicker: () => Promise<MediaFilePickerResult | null | undefined>;
	probeMediaDurationMs: (mediaPath: string) => Promise<number>;
	reportError: (title: string, description: string) => void;
}

interface UseTimelineBrollActionsParams {
	timeline: {
		videoDuration: number;
		totalMs: number;
		currentTimeMs: number;
	};
	regions: {
		broll: TimelineBrollRegion[];
	};
	onBrollAdded?: (
		span: { start: number; end: number },
		mediaPath: string,
		trackIndex?: number,
	) => void;
	deps?: Partial<TimelineBrollActionsDeps>;
}

async function defaultOpenFilePicker(): Promise<MediaFilePickerResult | null | undefined> {
	return window.electronAPI.openMediaFilePicker();
}

async function defaultProbeMediaDurationMs(mediaPath: string): Promise<number> {
	if (inferBRollMediaKind(mediaPath) === "image") {
		return DEFAULT_BROLL_IMAGE_DURATION_MS;
	}

	const resolved = await resolveMediaElementSource(mediaPath);
	return new Promise<number>((resolve) => {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.muted = true;
		const cleanup = () => {
			video.removeAttribute("src");
			video.load();
			resolved.revoke();
		};

		video.addEventListener(
			"loadedmetadata",
			() => {
				const durationMs = Number.isFinite(video.duration)
					? Math.round(video.duration * 1000)
					: 0;
				resolve(durationMs > 0 ? durationMs : 0);
				cleanup();
			},
			{ once: true },
		);
		video.addEventListener(
			"error",
			() => {
				resolve(0);
				cleanup();
			},
			{ once: true },
		);
		video.src = resolved.src;
	});
}

function buildTimelineBrollActionsDeps(
	overrides?: Partial<TimelineBrollActionsDeps>,
): TimelineBrollActionsDeps {
	return {
		openFilePicker: overrides?.openFilePicker ?? defaultOpenFilePicker,
		probeMediaDurationMs: overrides?.probeMediaDurationMs ?? defaultProbeMediaDurationMs,
		reportError: overrides?.reportError ?? timelineNotifications.error,
	};
}

export function useTimelineBrollActions({
	timeline,
	regions,
	onBrollAdded,
	deps: depsOverrides,
}: UseTimelineBrollActionsParams) {
	const { videoDuration, totalMs, currentTimeMs } = timeline;
	const { broll: brollRegions } = regions;
	const deps = useMemo(() => buildTimelineBrollActionsDeps(depsOverrides), [depsOverrides]);

	const handleAddBroll = useCallback(
		async (preferredTrackIndex?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onBrollAdded) {
				return;
			}

			const result = await deps.openFilePicker();
			if (!result?.success || !result.path) {
				return;
			}

			const mediaPath = result.path;
			const mediaDurationMs = await deps.probeMediaDurationMs(mediaPath);
			if (mediaDurationMs <= 0) {
				deps.reportError(
					"Could not read media file",
					"The selected file may be corrupted or in an unsupported format.",
				);
				return;
			}

			const startPos = Math.max(0, Math.min(currentTimeMs, totalMs));
			if (totalMs - startPos <= 0) {
				deps.reportError(
					"Cannot place B-roll here",
					"There is no remaining space at the current playhead position.",
				);
				return;
			}

			// Reuse audio placement so overlapping B-roll stacks on a new track.
			const placement = resolveAudioPlacement({
				audioRegions: brollRegions,
				startPos,
				totalMs,
				audioDurationMs: mediaDurationMs,
				preferredTrackIndex,
			});
			if (!placement) {
				deps.reportError(
					"Cannot place B-roll here",
					"B-roll already exists at this location or not enough space available.",
				);
				return;
			}

			onBrollAdded(
				{ start: startPos, end: startPos + placement.durationMs },
				mediaPath,
				placement.trackIndex,
			);
		},
		[videoDuration, totalMs, onBrollAdded, deps, currentTimeMs, brollRegions],
	);

	return { handleAddBroll };
}
