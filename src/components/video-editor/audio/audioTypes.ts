import type { AudioPeaksData } from "../timeline/core/timelineTypes";

export type SourceAudioTrackId = "mixed" | "system" | "mic" | (string & {});

export interface SourceAudioTrackSetting {
	volume: number;
	normalize: boolean;
}

export type SourceAudioTrackSettings = Record<string, SourceAudioTrackSetting>;

export interface SourceAudioTrackMetaItem {
	id: SourceAudioTrackId;
	label: string;
}

export type SourceAudioTrackMeta = SourceAudioTrackMetaItem[];

export interface SourceAudioTrackWithPeaks extends SourceAudioTrackMetaItem {
	peaks: AudioPeaksData;
}

export const SOURCE_AUDIO_FALLBACK_TOAST_ID = "source-audio-fallback-error";
export const SOURCE_AUDIO_NORMALIZE_GAIN = 1.35;
/** Max linear gain for mic / system source tracks (200%). HTML media elements
 *  only go to 1.0; preview uses Web Audio so boost above 100% is audible. */
export const SOURCE_AUDIO_VOLUME_MAX = 2;
export const SOURCE_AUDIO_VOLUME_DEFAULT = 1;

export function clampSourceAudioVolume(volume: number | null | undefined): number {
	if (typeof volume !== "number" || !Number.isFinite(volume)) {
		return SOURCE_AUDIO_VOLUME_DEFAULT;
	}
	return Math.max(0, Math.min(SOURCE_AUDIO_VOLUME_MAX, volume));
}

export function resolveSourceAudioTrackGain(settings?: SourceAudioTrackSetting | null): number {
	const volume = clampSourceAudioVolume(settings?.volume);
	const normalizeGain = settings?.normalize ? SOURCE_AUDIO_NORMALIZE_GAIN : 1;
	return clampSourceAudioVolume(volume * normalizeGain);
}
