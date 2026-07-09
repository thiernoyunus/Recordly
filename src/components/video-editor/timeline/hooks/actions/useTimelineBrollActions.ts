import { useCallback, useMemo } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import { DEFAULT_BROLL_IMAGE_DURATION_MS, inferBRollMediaKind } from "../../../types";
import type { TimelineBrollRegion } from "../../core/timelineTypes";
import { resolveAudioPlacement } from "../utils/timelineAudioPlacement";
import { timelineNotifications } from "../utils/timelineNotifications";

interface MediaFilePickerResult {
	success: boolean;
	path?: string;
	canceled?: boolean;
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
	const picker = window.electronAPI?.openMediaFilePicker;
	if (typeof picker !== "function") {
		throw new Error(
			"Media file picker is not available. Restart Recordly (fully quit with Cmd+Q, then run npm run dev again).",
		);
	}
	return picker();
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
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const cleanup = () => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
				timeoutId = undefined;
			}
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
		timeoutId = setTimeout(() => {
			resolve(0);
			cleanup();
		}, 10_000);
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
			if (!onBrollAdded) {
				deps.reportError(
					"Cannot add B-roll",
					"The editor is not ready to add B-roll yet. Open a recording in the editor and try again.",
				);
				return;
			}

			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				deps.reportError(
					"Cannot add B-roll",
					"Load a video recording first, then add B-roll on the timeline.",
				);
				return;
			}

			try {
				const result = await deps.openFilePicker();
				if (result?.canceled) {
					return;
				}
				if (!result?.success || !result.path) {
					if (result && result.success === false && !result.canceled) {
						deps.reportError(
							"Could not open file picker",
							"Recordly could not open the file chooser. Fully quit the app and restart it.",
						);
					}
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
						"There is no remaining space at the current playhead position. Move the playhead earlier and try again.",
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
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[broll] Failed to add B-roll:", error);
				deps.reportError("Could not add B-roll", message);
			}
		},
		[videoDuration, totalMs, onBrollAdded, deps, currentTimeMs, brollRegions],
	);

	return { handleAddBroll };
}
