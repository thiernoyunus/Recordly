import { describe, expect, it } from "vitest";
import { computeCoverContainDrawRect, resolveBRollTargetRect } from "./brollLayout";

describe("resolveBRollTargetRect", () => {
	const stage = { stageWidth: 1080, stageHeight: 1920 };
	const screenRect = { x: 0, y: 0, width: 1080, height: 1152 };
	const maskRect = { x: 40, y: 40, width: 1000, height: 1840 };

	it("returns the full stage for full placement", () => {
		expect(
			resolveBRollTargetRect({
				placement: "full",
				...stage,
				screenRect,
				maskRect,
			}),
		).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
	});

	it("uses the screen band for screen placement when present", () => {
		expect(
			resolveBRollTargetRect({
				placement: "screen",
				...stage,
				screenRect,
				maskRect,
			}),
		).toEqual(screenRect);
	});

	it("falls back to maskRect when screen band is missing", () => {
		expect(
			resolveBRollTargetRect({
				placement: "screen",
				...stage,
				screenRect: null,
				maskRect,
			}),
		).toEqual(maskRect);
	});

	it("falls back to full stage when both screen and mask are missing (camera-only)", () => {
		expect(
			resolveBRollTargetRect({
				placement: "screen",
				...stage,
				screenRect: null,
				maskRect: null,
			}),
		).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
	});
});

describe("computeCoverContainDrawRect", () => {
	const dest = { x: 10, y: 20, width: 200, height: 100 };

	it("cover crops a wider source horizontally", () => {
		// 400x100 source into 200x100 dest → cover crops width to 200 of 400
		const draw = computeCoverContainDrawRect(400, 100, dest, "cover");
		expect(draw.dx).toBe(10);
		expect(draw.dy).toBe(20);
		expect(draw.dWidth).toBe(200);
		expect(draw.dHeight).toBe(100);
		expect(draw.sWidth).toBe(200);
		expect(draw.sHeight).toBe(100);
		expect(draw.sx).toBe(100);
		expect(draw.sy).toBe(0);
	});

	it("contain letterboxes a wider source", () => {
		const draw = computeCoverContainDrawRect(400, 100, dest, "contain");
		expect(draw.dWidth).toBe(200);
		expect(draw.dHeight).toBe(50);
		expect(draw.dx).toBe(10);
		expect(draw.dy).toBe(45);
		expect(draw.sx).toBe(0);
		expect(draw.sy).toBe(0);
		expect(draw.sWidth).toBe(400);
		expect(draw.sHeight).toBe(100);
	});

	it("handles zero-size dest without throwing", () => {
		const draw = computeCoverContainDrawRect(
			100,
			100,
			{ x: 0, y: 0, width: 0, height: 0 },
			"cover",
		);
		expect(draw.dWidth).toBe(0);
		expect(draw.dHeight).toBe(0);
	});
});
