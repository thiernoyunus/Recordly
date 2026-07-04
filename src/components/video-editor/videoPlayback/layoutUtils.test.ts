import { describe, expect, it } from "vitest";

import { ADVANCED_VERTICAL_PADDING_MAX, DEFAULT_SCENE_LAYOUT } from "../types";
import {
	computePaddedLayout,
	computeSceneBandRects,
	getSceneLayoutCameraAspect,
	getSceneLayoutScreenFocus,
	scalePreviewBorderRadius,
} from "./layoutUtils";

const BASE_LAYOUT_PARAMS = {
	width: 1000,
	height: 1000,
	cropRegion: { x: 0, y: 0, width: 1, height: 1 },
	videoWidth: 1000,
	videoHeight: 1000,
};

describe("getSceneLayoutCameraAspect", () => {
	it("returns stage aspect for camera mode, band aspect for split, null otherwise", () => {
		const stage = 9 / 16;
		expect(
			getSceneLayoutCameraAspect(
				{ mode: "camera", splitRatio: 0.4, cameraOnTop: false },
				stage,
			),
		).toBe(stage);
		expect(
			getSceneLayoutCameraAspect(
				{ mode: "split", splitRatio: 0.4, cameraOnTop: false },
				stage,
			),
		).toBeCloseTo(stage / 0.4);
		// splitRatio clamps like computeSceneBandRects
		expect(
			getSceneLayoutCameraAspect(
				{ mode: "split", splitRatio: 0.05, cameraOnTop: false },
				stage,
			),
		).toBeCloseTo(stage / 0.2);
		expect(
			getSceneLayoutCameraAspect(
				{ mode: "default", splitRatio: 0.4, cameraOnTop: false },
				stage,
			),
		).toBeNull();
		expect(
			getSceneLayoutCameraAspect(
				{ mode: "screen", splitRatio: 0.4, cameraOnTop: false },
				stage,
			),
		).toBeNull();
	});
});

describe("computeSceneBandRects", () => {
	it("places split camera band on the bottom by default", () => {
		expect(
			computeSceneBandRects(
				{ mode: "split", splitRatio: 0.4, cameraOnTop: false },
				1000,
				800,
			),
		).toEqual({
			screenRect: { x: 0, y: 0, width: 1000, height: 480 },
			cameraRect: { x: 0, y: 480, width: 1000, height: 320 },
		});
	});

	it("mirrors split bands when the camera is on top", () => {
		expect(
			computeSceneBandRects({ mode: "split", splitRatio: 0.4, cameraOnTop: true }, 1000, 800),
		).toEqual({
			cameraRect: { x: 0, y: 0, width: 1000, height: 320 },
			screenRect: { x: 0, y: 320, width: 1000, height: 480 },
		});
	});

	it("clamps split ratio", () => {
		expect(
			computeSceneBandRects(
				{ mode: "split", splitRatio: 0.95, cameraOnTop: false },
				1000,
				800,
			).cameraRect,
		).toEqual({ x: 0, y: 160, width: 1000, height: 640 });
	});
});

describe("computePaddedLayout", () => {
	it("allows advanced bottom padding to pin the video to the top edge", () => {
		const layout = computePaddedLayout({
			...BASE_LAYOUT_PARAMS,
			padding: {
				top: 0,
				bottom: ADVANCED_VERTICAL_PADDING_MAX,
				left: 0,
				right: 0,
				linked: false,
			},
		});

		expect(layout.centerOffsetY).toBeCloseTo(0);
	});

	it("allows advanced top padding to pin the video to the bottom edge", () => {
		const layout = computePaddedLayout({
			...BASE_LAYOUT_PARAMS,
			padding: {
				top: ADVANCED_VERTICAL_PADDING_MAX,
				bottom: 0,
				left: 0,
				right: 0,
				linked: false,
			},
		});

		expect(layout.centerOffsetY + layout.croppedDisplayHeight).toBeCloseTo(
			BASE_LAYOUT_PARAMS.height,
		);
	});

	it("preserves linked padding centering behavior", () => {
		const layout = computePaddedLayout({
			...BASE_LAYOUT_PARAMS,
			padding: { top: 20, bottom: 20, left: 20, right: 20, linked: true },
		});

		expect(layout.centerOffsetY).toBeCloseTo(40);
		expect(layout.centerOffsetY + layout.croppedDisplayHeight).toBeCloseTo(960);
	});

	it("covers a content rect while using the rect as the mask box", () => {
		const layout = computePaddedLayout({
			width: 1000,
			height: 800,
			padding: 50,
			frameInsets: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
			cropRegion: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
			videoWidth: 1000,
			videoHeight: 800,
			contentRect: { x: 100, y: 50, width: 400, height: 300 },
			fitMode: "cover",
		});

		expect(layout.scale).toBeCloseTo(0.75);
		expect(layout.centerOffsetX).toBe(100);
		expect(layout.centerOffsetY).toBe(50);
		expect(layout.croppedDisplayWidth).toBe(400);
		expect(layout.croppedDisplayHeight).toBe(300);
		// cover overflows horizontally: 800*0.75=600 wide in a 400 band, centered → contentX=0, minus crop offset 0.1*750
		expect(layout.spriteX).toBeCloseTo(-75);
		expect(layout.spriteY).toBeCloseTo(-70);
	});

	it("moves cover overflow to the requested screen focus", () => {
		const params = {
			width: 1000,
			height: 800,
			padding: 50,
			frameInsets: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
			cropRegion: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
			videoWidth: 1000,
			videoHeight: 800,
			contentRect: { x: 100, y: 50, width: 400, height: 300 },
			fitMode: "cover" as const,
		};

		const left = computePaddedLayout({ ...params, contentFocus: { x: 0, y: 0.5 } });
		const center = computePaddedLayout({ ...params, contentFocus: { x: 0.5, y: 0.5 } });
		const right = computePaddedLayout({ ...params, contentFocus: { x: 1, y: 0.5 } });
		const oldCentered = computePaddedLayout(params);

		expect(left.spriteX).toBeCloseTo(25);
		expect(right.spriteX).toBeCloseTo(-175);
		expect(center).toEqual(oldCentered);
		expect(center.spriteX).toBeCloseTo(-75);
	});

	it("keeps a non-overflowing cover axis centered regardless of focus", () => {
		const params = {
			width: 1000,
			height: 800,
			padding: 50,
			cropRegion: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
			videoWidth: 1000,
			videoHeight: 800,
			contentRect: { x: 100, y: 50, width: 600, height: 200 },
			fitMode: "cover" as const,
		};

		const top = computePaddedLayout({ ...params, contentFocus: { x: 0, y: 0 } });
		const bottom = computePaddedLayout({ ...params, contentFocus: { x: 1, y: 1 } });
		const centered = computePaddedLayout({ ...params, contentFocus: { x: 0.5, y: 0.5 } });

		expect(top.spriteX).toBeCloseTo(centered.spriteX);
		expect(bottom.spriteX).toBeCloseTo(centered.spriteX);
		expect(top.spriteY).toBeCloseTo(-70);
		expect(bottom.spriteY).toBeCloseTo(-170);
	});

	it("keeps existing behavior when no content rect is provided", () => {
		const layout = computePaddedLayout({
			width: 1000,
			height: 800,
			padding: 10,
			cropRegion: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
			videoWidth: 1000,
			videoHeight: 800,
		});

		expect(layout).toMatchObject({
			scale: 1.2,
			centerOffsetX: 20,
			centerOffsetY: 160,
			spriteX: -100,
			spriteY: -32,
			fullFrameDisplayW: 960,
			fullFrameDisplayH: 480,
			fullVideoDisplayWidth: 1200,
			fullVideoDisplayHeight: 960,
			croppedDisplayWidth: 960,
			croppedDisplayHeight: 480,
			cropStartX: 100,
			cropStartY: 160,
		});
	});
});

describe("getSceneLayoutScreenFocus", () => {
	it("defaults missing focus to center and clamps saved focus", () => {
		expect(getSceneLayoutScreenFocus(DEFAULT_SCENE_LAYOUT)).toEqual({ x: 0.5, y: 0.5 });
		expect(
			getSceneLayoutScreenFocus({
				...DEFAULT_SCENE_LAYOUT,
				screenFocusX: -1,
				screenFocusY: 2,
			}),
		).toEqual({ x: 0, y: 1 });
	});
});

describe("scalePreviewBorderRadius", () => {
	it("matches export scaling against the logical preview size", () => {
		expect(scalePreviewBorderRadius(1920, 1080, 16)).toBeCloseTo(16, 6);
		expect(scalePreviewBorderRadius(960, 540, 16)).toBeCloseTo(8, 6);
		expect(scalePreviewBorderRadius(1440, 810, 16)).toBeCloseTo(12, 6);
	});

	it("clamps invalid or empty preview sizes to zero", () => {
		expect(scalePreviewBorderRadius(0, 540, 16)).toBe(0);
		expect(scalePreviewBorderRadius(960, 0, 16)).toBe(0);
		expect(scalePreviewBorderRadius(960, 540, -8)).toBe(0);
	});
});
