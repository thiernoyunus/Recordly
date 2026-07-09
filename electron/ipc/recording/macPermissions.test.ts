import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		isPackaged: false,
		getName: () => "Recordly",
	},
	desktopCapturer: {
		getSources: vi.fn(async () => []),
	},
	systemPreferences: {
		getMediaAccessStatus: vi.fn(() => "not-determined"),
		askForMediaAccess: vi.fn(async () => false),
		isTrustedAccessibilityClient: vi.fn(() => false),
	},
}));

vi.mock("../paths/binaries", () => ({
	ensureNativeCaptureHelperBinary: vi.fn(async () => "/tmp/recordly-screencapturekit-helper"),
}));

import {
	buildMacPermissionsGuidance,
	collectMissingPermissions,
	type EnsureMacPermissionsResult,
} from "./macPermissions";

describe("collectMissingPermissions", () => {
	it("flags screen when not granted", () => {
		expect(
			collectMissingPermissions(
				{
					screen: "denied",
					microphone: "granted",
					camera: "granted",
					accessibilityTrusted: true,
				},
				{ requireMicrophone: true, requireAccessibility: true },
			),
		).toEqual(["screen"]);
	});

	it("flags microphone and accessibility when required", () => {
		expect(
			collectMissingPermissions(
				{
					screen: "granted",
					microphone: "not-determined",
					camera: "denied",
					accessibilityTrusted: false,
				},
				{ requireMicrophone: true, requireCamera: false, requireAccessibility: true },
			),
		).toEqual(["microphone", "accessibility"]);
	});

	it("can require camera as well", () => {
		expect(
			collectMissingPermissions(
				{
					screen: "granted",
					microphone: "granted",
					camera: "denied",
					accessibilityTrusted: true,
				},
				{ requireCamera: true },
			),
		).toEqual(["camera"]);
	});

	it("returns empty when everything needed is granted", () => {
		expect(
			collectMissingPermissions(
				{
					screen: "granted",
					microphone: "granted",
					camera: "denied",
					accessibilityTrusted: true,
				},
				{ requireMicrophone: true, requireCamera: false, requireAccessibility: true },
			),
		).toEqual([]);
	});
});

describe("buildMacPermissionsGuidance", () => {
	it("names Electron for unpackaged builds and lists missing panes", () => {
		const result: EnsureMacPermissionsResult = {
			success: false,
			screen: "denied",
			microphone: "denied",
			camera: "granted",
			accessibilityTrusted: false,
			requested: true,
			settingsLabel: "Electron",
			isPackaged: false,
			missing: ["screen", "microphone", "accessibility"],
		};

		const guidance = buildMacPermissionsGuidance(result);
		expect(guidance).toContain('Turn ON "Electron"');
		expect(guidance).toContain("Screen Recording");
		expect(guidance).toContain("Microphone");
		expect(guidance).toContain("Accessibility");
		expect(guidance).toContain('Look for "Electron"');
		expect(guidance).toContain("Cmd+Q");
	});

	it("names Recordly for packaged builds", () => {
		const result: EnsureMacPermissionsResult = {
			success: false,
			screen: "denied",
			microphone: "granted",
			camera: "granted",
			accessibilityTrusted: true,
			requested: true,
			settingsLabel: "Recordly",
			isPackaged: true,
			missing: ["screen"],
		};

		const guidance = buildMacPermissionsGuidance(result);
		expect(guidance).toContain('Turn ON "Recordly"');
		expect(guidance).not.toContain("development build");
	});
});
