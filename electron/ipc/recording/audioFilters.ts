// Keep native mic capture dry by default. Automatic loudness normalization
// amplified wireless-headset noise and WASAPI discontinuities during beta tests.
export const WINDOWS_NATIVE_MIC_PRE_FILTERS = ["adeclip=threshold=1"];

// Browser mic fallback uses Chromium/WebRTC voice processing, but beta tests
// showed its realtime AGC can introduce short crackle bursts on some Realtek
// and headset paths. Default to no AGC, then restore usable level offline with
// bounded speech expansion and a limiter.
export const BROWSER_MIC_SIDECAR_BASE_FILTERS = [
	"adeclip=threshold=1",
	"adeclick=w=40:o=75:t=3:b=2",
	"highpass=f=85",
	"lowpass=f=9500",
	"afftdn=nr=10:nf=-45:tn=1",
];

export const BROWSER_MIC_SIDECAR_NO_AGC_GAIN_FILTERS = [
	"speechnorm=p=0.92:e=12:c=2:r=0.0005:f=0.001",
	"alimiter=limit=0.92:level=0",
];

export const BROWSER_MIC_SIDECAR_FILTERS = [
	...BROWSER_MIC_SIDECAR_BASE_FILTERS,
	"alimiter=limit=0.92:level=0",
];

export function getBrowserMicSidecarFilters(profile?: string | null) {
	if (profile === "no-agc") {
		return [...BROWSER_MIC_SIDECAR_BASE_FILTERS, ...BROWSER_MIC_SIDECAR_NO_AGC_GAIN_FILTERS];
	}

	return BROWSER_MIC_SIDECAR_FILTERS;
}

// Native macOS mic sidecars can arrive heavily attenuated when Apple's voice
// processing is engaged during capture. We measure the file's true peak and
// apply a plain makeup gain only when it is clearly too quiet, so healthy
// recordings are never re-encoded.
export const MAC_NATIVE_MIC_BOOST_TRIGGER_PEAK_DB = -12;
export const MAC_NATIVE_MIC_BOOST_TARGET_PEAK_DB = -3;
export const MAC_NATIVE_MIC_BOOST_MAX_DB = 30;

export function parseMaxVolumeDb(ffmpegVolumedetectOutput: string): number | null {
	const match = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/.exec(ffmpegVolumedetectOutput);
	if (!match) {
		return null;
	}

	const value = Number(match[1]);
	return Number.isFinite(value) ? value : null;
}

export function computeMacNativeMicBoostDb(maxVolumeDb: number | null): number {
	if (maxVolumeDb === null || !Number.isFinite(maxVolumeDb)) {
		return 0;
	}

	if (maxVolumeDb >= MAC_NATIVE_MIC_BOOST_TRIGGER_PEAK_DB) {
		return 0;
	}

	return Math.min(MAC_NATIVE_MIC_BOOST_TARGET_PEAK_DB - maxVolumeDb, MAC_NATIVE_MIC_BOOST_MAX_DB);
}

export const RECORDING_AUDIO_SIDECAR_DEBUG_ENV = "RECORDLY_KEEP_RECORDING_AUDIO_SIDECARS"; // not used yet, because we need to have seperate audio files for system and mic for each recording

export function shouldKeepRecordingAudioSidecars(env: NodeJS.ProcessEnv = process.env) {
	const value = env[RECORDING_AUDIO_SIDECAR_DEBUG_ENV]?.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes" || value === "on";
}
