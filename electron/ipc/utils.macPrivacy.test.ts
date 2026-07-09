import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		getPath: () => "/tmp/recordly-test",
		isPackaged: false,
		getName: () => "Recordly",
	},
	shell: {
		openExternal: vi.fn(async () => undefined),
	},
}));

import { getMacPrivacySettingsUrl, getMacPrivacySettingsUrls } from "./utils";

describe("getMacPrivacySettingsUrls", () => {
	it("prefers modern Settings URLs for screen recording", () => {
		const urls = getMacPrivacySettingsUrls("screen");
		expect(urls[0]).toContain("PrivacySecurity.extension");
		expect(urls[0]).toContain("Privacy_ScreenCapture");
		expect(urls.some((url) => url.includes("preference.security"))).toBe(true);
	});

	it("covers microphone, camera, and accessibility panes", () => {
		expect(getMacPrivacySettingsUrl("microphone")).toContain("Privacy_Microphone");
		expect(getMacPrivacySettingsUrl("camera")).toContain("Privacy_Camera");
		expect(getMacPrivacySettingsUrl("accessibility")).toContain("Privacy_Accessibility");
	});
});
