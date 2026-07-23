import { describe, expect, it } from "vitest";
import { withSourceTrackSetting } from "./useSourceAudioTrackSettings";

describe("withSourceTrackSetting", () => {
	it("mutes a track without disturbing its normalize flag", () => {
		const next = withSourceTrackSetting({ system: { volume: 1, normalize: true } }, "system", {
			volume: 0,
		});

		expect(next.system).toEqual({ volume: 0, normalize: true });
	});

	it("toggles normalize without disturbing the volume", () => {
		const next = withSourceTrackSetting({ mic: { volume: 0.5, normalize: false } }, "mic", {
			normalize: true,
		});

		expect(next.mic).toEqual({ volume: 0.5, normalize: true });
	});

	it("adds a track that has no setting yet", () => {
		const next = withSourceTrackSetting({}, "system", { volume: 0 });

		expect(next.system).toEqual({ volume: 0, normalize: false });
	});

	it("returns the same object when nothing changed, so React can skip a render", () => {
		const settings = { system: { volume: 0, normalize: false } };

		expect(withSourceTrackSetting(settings, "system", { volume: 0 })).toBe(settings);
	});

	it("leaves other tracks untouched", () => {
		const next = withSourceTrackSetting(
			{ system: { volume: 1, normalize: false }, mic: { volume: 1, normalize: false } },
			"system",
			{ volume: 0 },
		);

		expect(next.mic).toEqual({ volume: 1, normalize: false });
	});
});
