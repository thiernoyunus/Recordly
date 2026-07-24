import { describe, expect, it, vi } from "vitest";

// Importing the shared constants pulls in electron's app for path resolution.
vi.mock("electron", () => ({
	app: { isPackaged: false, getAppPath: () => "/tmp", getPath: () => "/tmp" },
}));

import { COMPANION_AUDIO_LAYOUTS } from "./ipc/constants";
import { getMediaContentType, isSupportedLocalMediaPath } from "./mediaTypes";

describe("isSupportedLocalMediaPath", () => {
	// The media server refuses anything this rejects, so a sidecar format the
	// recorder writes but this does not know about is silent in preview while
	// export — which reads from disk — still works. That was the .m4a bug.
	const companionSuffixes = COMPANION_AUDIO_LAYOUTS.flatMap((layout) => [
		layout.systemSuffix,
		layout.micSuffix,
	]);

	it.each(companionSuffixes)("serves the %s sidecar the recorder writes", (suffix) => {
		expect(isSupportedLocalMediaPath(`/recordings/recording-123${suffix}`)).toBe(true);
	});

	it("serves the recorded video itself", () => {
		expect(isSupportedLocalMediaPath("/recordings/recording-123.mp4")).toBe(true);
	});

	it("rejects unrelated files", () => {
		expect(isSupportedLocalMediaPath("/recordings/recording-123.recordly-session.json")).toBe(
			false,
		);
	});
});

describe("getMediaContentType", () => {
	it("labels mac audio sidecars as mp4 audio", () => {
		expect(getMediaContentType("/recordings/recording-123.mic.m4a")).toBe("audio/mp4");
	});

	it("falls back to a generic type for unknown extensions", () => {
		expect(getMediaContentType("/recordings/notes.txt")).toBe("application/octet-stream");
	});
});
