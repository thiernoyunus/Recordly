import { describe, expect, it } from "vitest";
import { buildResolvedAudioPlan } from "./audioRoutingEngine";

// A mac recording where the recorder baked system audio into the video and
// wrote the mic to its own sidecar. The video carries the system audio, so
// muting the system track has to silence it — in preview and in export.
const VIDEO = "/recordings/recording.mp4";
const MIC = "/recordings/recording.mic.m4a";

describe("buildResolvedAudioPlan embedded track routing", () => {
	it("silences the embedded system audio when the system track is muted", () => {
		const plan = buildResolvedAudioPlan({
			videoResource: VIDEO,
			sourceAudioFallbackPaths: [VIDEO, MIC],
			sourceTrackGainById: { system: 0, mic: 1 },
		});

		const embedded = plan.tracks.find((track) => track.kind === "embedded");
		expect(embedded).toBeDefined();
		expect(embedded?.gain).toBe(0);
	});

	it("leaves the mic audible while the system track is muted", () => {
		const plan = buildResolvedAudioPlan({
			videoResource: VIDEO,
			sourceAudioFallbackPaths: [VIDEO, MIC],
			sourceTrackGainById: { system: 0, mic: 1 },
		});

		expect(plan.tracks.find((track) => track.kind === "mic")?.gain).toBe(1);
	});

	it("uses the mixed gain for embedded audio when there is no separate mic", () => {
		const plan = buildResolvedAudioPlan({
			videoResource: VIDEO,
			sourceAudioFallbackPaths: [VIDEO],
			sourceTrackGainById: { system: 0, mixed: 1 },
		});

		expect(plan.embeddedTrackId).toBe("mixed");
		expect(plan.tracks.find((track) => track.kind === "embedded")?.gain).toBe(1);
	});
});
