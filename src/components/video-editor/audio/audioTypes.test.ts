import { describe, expect, it } from "vitest";
import {
	clampSourceAudioVolume,
	resolveSourceAudioTrackGain,
	SOURCE_AUDIO_NORMALIZE_GAIN,
	SOURCE_AUDIO_VOLUME_MAX,
} from "./audioTypes";

describe("clampSourceAudioVolume", () => {
	it("clamps into 0..200%", () => {
		expect(clampSourceAudioVolume(-1)).toBe(0);
		expect(clampSourceAudioVolume(0.5)).toBe(0.5);
		expect(clampSourceAudioVolume(1)).toBe(1);
		expect(clampSourceAudioVolume(SOURCE_AUDIO_VOLUME_MAX)).toBe(SOURCE_AUDIO_VOLUME_MAX);
		expect(clampSourceAudioVolume(5)).toBe(SOURCE_AUDIO_VOLUME_MAX);
		expect(clampSourceAudioVolume(Number.NaN)).toBe(1);
		expect(clampSourceAudioVolume(undefined)).toBe(1);
	});
});

describe("resolveSourceAudioTrackGain", () => {
	it("applies normalize boost without exceeding max", () => {
		expect(resolveSourceAudioTrackGain({ volume: 1, normalize: false })).toBe(1);
		expect(resolveSourceAudioTrackGain({ volume: 1, normalize: true })).toBeCloseTo(
			SOURCE_AUDIO_NORMALIZE_GAIN,
			5,
		);
		expect(resolveSourceAudioTrackGain({ volume: 2, normalize: true })).toBe(
			SOURCE_AUDIO_VOLUME_MAX,
		);
		expect(resolveSourceAudioTrackGain({ volume: 1.5, normalize: false })).toBe(1.5);
	});
});
