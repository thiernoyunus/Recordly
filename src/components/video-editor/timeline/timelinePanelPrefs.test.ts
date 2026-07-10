import { describe, expect, it } from "vitest";
import {
	clampTimelinePanelHeight,
	DEFAULT_TIMELINE_PANEL_HEIGHT_PX,
	MIN_TIMELINE_PANEL_HEIGHT_PX,
} from "./timelinePanelPrefs";

describe("timelinePanelPrefs", () => {
	it("clamps below minimum", () => {
		expect(clampTimelinePanelHeight(20, 1000)).toBe(MIN_TIMELINE_PANEL_HEIGHT_PX);
	});

	it("clamps above max ratio of viewport", () => {
		const viewport = 1000;
		const max = Math.round(viewport * 0.62);
		expect(clampTimelinePanelHeight(900, viewport)).toBe(max);
	});

	it("passes through valid heights", () => {
		expect(clampTimelinePanelHeight(260, 1000)).toBe(260);
	});

	it("falls back for non-finite input", () => {
		expect(clampTimelinePanelHeight(Number.NaN, 1000)).toBe(DEFAULT_TIMELINE_PANEL_HEIGHT_PX);
	});
});
