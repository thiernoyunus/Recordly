import { describe, expect, it } from "vitest";

import { normalizeProjectEditor } from "./projectPersistence";
import { ADVANCED_VERTICAL_PADDING_MAX, DEFAULT_SCENE_LAYOUT } from "./types";

describe("normalizeProjectEditor", () => {
	it("preserves the extended advanced vertical padding range", () => {
		const editor = normalizeProjectEditor({
			padding: {
				top: 240,
				bottom: ADVANCED_VERTICAL_PADDING_MAX,
				left: 22,
				right: 22,
				linked: false,
			},
		});

		expect(editor.padding).toMatchObject({
			top: 240,
			bottom: ADVANCED_VERTICAL_PADDING_MAX,
			left: 22,
			right: 22,
			linked: false,
		});
	});

	it("keeps linked padding clamped to the original range", () => {
		const editor = normalizeProjectEditor({
			padding: {
				top: ADVANCED_VERTICAL_PADDING_MAX,
				bottom: ADVANCED_VERTICAL_PADDING_MAX,
				left: ADVANCED_VERTICAL_PADDING_MAX,
				right: ADVANCED_VERTICAL_PADDING_MAX,
				linked: true,
			},
		});

		expect(editor.padding).toMatchObject({
			top: 100,
			bottom: 100,
			left: 100,
			right: 100,
			linked: true,
		});
	});

	it("normalizes layout settings", () => {
		expect(
			normalizeProjectEditor({
				layout: "garbage" as never,
			}).layout,
		).toEqual(DEFAULT_SCENE_LAYOUT);

		expect(
			normalizeProjectEditor({
				layout: {
					mode: "split",
					splitRatio: 0.65,
					cameraOnTop: true,
					screenFocusX: 0.25,
					screenFocusY: 0.75,
				},
			}).layout,
		).toEqual({
			mode: "split",
			splitRatio: 0.65,
			cameraOnTop: true,
			screenFocusX: 0.25,
			screenFocusY: 0.75,
		});

		expect(
			normalizeProjectEditor({
				layout: {
					mode: "screen",
					splitRatio: 0.65,
					cameraOnTop: false,
					screenFocusX: -1,
					screenFocusY: 2,
				},
			}).layout,
		).toEqual({
			mode: "screen",
			splitRatio: 0.65,
			cameraOnTop: false,
			screenFocusX: 0,
			screenFocusY: 1,
		});

		expect(
			normalizeProjectEditor({
				layout: {
					mode: "screen",
					splitRatio: 0.65,
					cameraOnTop: false,
					screenFocusX: Number.NaN,
					screenFocusY: "bad",
				} as never,
			}).layout,
		).toEqual({ mode: "screen", splitRatio: 0.65, cameraOnTop: false });
	});

	it("normalizes layout regions", () => {
		const editor = normalizeProjectEditor({
			layoutRegions: [
				{
					id: "layout-1",
					startMs: 10.4,
					endMs: 20.6,
					layout: {
						mode: "split",
						splitRatio: 0.95,
						cameraOnTop: true,
						screenFocusX: -1,
						screenFocusY: 0.75,
					},
				},
				{
					id: "layout-2",
					startMs: 30,
					endMs: 40,
					layout: {
						mode: "garbage",
						splitRatio: 0.1,
						cameraOnTop: 0,
						screenFocusX: 0.25,
						screenFocusY: Number.NaN,
					} as never,
				},
				{ id: "", startMs: 50, endMs: 40, layout: DEFAULT_SCENE_LAYOUT },
				{ startMs: 50, endMs: 60, layout: DEFAULT_SCENE_LAYOUT } as never,
				{ id: "bad-time", startMs: Number.NaN, endMs: 60, layout: DEFAULT_SCENE_LAYOUT },
			],
		});

		expect(editor.layoutRegions).toEqual([
			{
				id: "layout-1",
				startMs: 10,
				endMs: 21,
				layout: {
					mode: "split",
					splitRatio: 0.8,
					cameraOnTop: true,
					screenFocusX: 0,
					screenFocusY: 0.75,
				},
			},
			{
				id: "layout-2",
				startMs: 30,
				endMs: 40,
				layout: {
					mode: "default",
					splitRatio: 0.2,
					cameraOnTop: false,
					screenFocusX: 0.25,
				},
			},
		]);
	});
});
