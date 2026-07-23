import React, { useCallback, useMemo } from "react";
import {
	resolveSourceAudioTrackGain,
	type SourceAudioTrackSettings,
} from "@/components/video-editor/audio/audioTypes";
import { getSourceTrackIdFromPath, type SourceTrackId } from "@/lib/exporter/audioRoutingEngine";
import { useSourceAudioTrackSettings } from "./useSourceAudioTrackSettings";

interface UseClipAudioSettingsControllerParams {
	selectedClipId: string | null;
	activeClipId: string | null;
	/** Which track the video's own audio stream belongs to, per the routing policy. */
	embeddedTrackId: SourceTrackId;
	sourceAudioTrackSettingsByClip: Record<string, SourceAudioTrackSettings>;
	setSourceAudioTrackSettingsByClip: React.Dispatch<
		React.SetStateAction<Record<string, SourceAudioTrackSettings>>
	>;
	defaultSourceAudioTrackSettings: SourceAudioTrackSettings;
	setDefaultSourceAudioTrackSettings: React.Dispatch<
		React.SetStateAction<SourceAudioTrackSettings>
	>;
}

export function useClipAudioSettingsController({
	selectedClipId,
	activeClipId,
	embeddedTrackId,
	sourceAudioTrackSettingsByClip,
	setSourceAudioTrackSettingsByClip,
	defaultSourceAudioTrackSettings,
	setDefaultSourceAudioTrackSettings,
}: UseClipAudioSettingsControllerParams) {
	const {
		sourceAudioTrackMeta,
		activeSourceAudioTrackSettings,
		selectedClipSourceAudioTrackSettings,
		getSourceAudioTrackSettingsForClip,
		onSourceAudioTracksMetaChange,
		onSelectedClipSourceAudioTrackVolumeChange,
		onSelectedClipSourceAudioTrackNormalizeChange,
	} = useSourceAudioTrackSettings({
		selectedClipId,
		activeClipId,
		sourceAudioTrackSettingsByClip,
		setSourceAudioTrackSettingsByClip,
		defaultSourceAudioTrackSettings,
		setDefaultSourceAudioTrackSettings,
	});

	const previewSourceAudioTrackSettings = useMemo(
		() =>
			activeClipId ? activeSourceAudioTrackSettings : selectedClipSourceAudioTrackSettings,
		[activeClipId, activeSourceAudioTrackSettings, selectedClipSourceAudioTrackSettings],
	);

	const embeddedSourcePreviewGain = useMemo(() => {
		const settings = previewSourceAudioTrackSettings[embeddedTrackId] ?? {
			volume: 1,
			normalize: false,
		};
		return resolveSourceAudioTrackGain(settings);
	}, [embeddedTrackId, previewSourceAudioTrackSettings]);

	const getSourceTrackPreviewGain = useCallback(
		(audioPath: string) => {
			const trackId = getSourceTrackIdFromPath(audioPath);
			const settings = previewSourceAudioTrackSettings[trackId] ?? {
				volume: 1,
				normalize: false,
			};
			return resolveSourceAudioTrackGain(settings);
		},
		[previewSourceAudioTrackSettings],
	);

	return {
		sourceAudioTrackMeta,
		activeSourceAudioTrackSettings,
		selectedClipSourceAudioTrackSettings,
		getSourceAudioTrackSettingsForClip,
		onSourceAudioTracksMetaChange,
		onSelectedClipSourceAudioTrackVolumeChange,
		onSelectedClipSourceAudioTrackNormalizeChange,
		embeddedSourcePreviewGain,
		getSourceTrackPreviewGain,
	};
}
