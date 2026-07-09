import type { BRollFitMode, BRollPlacement } from "../types";
import type { LayoutRect } from "./layoutUtils";

/**
 * Where on the stage a B-roll clip should be drawn.
 * - full → entire stage
 * - screen → screen band if present, else padded content rect, else full stage
 *   (camera-only layouts have no screen band, so they fall through to full)
 */
export function resolveBRollTargetRect(args: {
	placement: BRollPlacement;
	stageWidth: number;
	stageHeight: number;
	screenRect: LayoutRect | null;
	maskRect?: LayoutRect | null;
}): LayoutRect {
	const { placement, stageWidth, stageHeight, screenRect, maskRect = null } = args;
	const fullStage: LayoutRect = {
		x: 0,
		y: 0,
		width: Math.max(0, stageWidth),
		height: Math.max(0, stageHeight),
	};

	if (placement !== "screen") {
		return fullStage;
	}

	if (screenRect && screenRect.width > 0 && screenRect.height > 0) {
		return { ...screenRect };
	}

	if (maskRect && maskRect.width > 0 && maskRect.height > 0) {
		return { ...maskRect };
	}

	return fullStage;
}

export interface CoverContainDrawRect {
	/** Destination rect on the canvas/stage (clipped to the target). */
	dx: number;
	dy: number;
	dWidth: number;
	dHeight: number;
	/** Source crop in source-image pixels. */
	sx: number;
	sy: number;
	sWidth: number;
	sHeight: number;
}

/**
 * Cover/contain math for drawing a source image/video into a destination rect.
 * - cover: fill dest, crop overflow (centered)
 * - contain: fit entire source inside dest (letterbox; caller can fill bg separately)
 */
export function computeCoverContainDrawRect(
	srcW: number,
	srcH: number,
	dest: LayoutRect,
	fit: BRollFitMode,
): CoverContainDrawRect {
	const safeSrcW = Math.max(1, srcW);
	const safeSrcH = Math.max(1, srcH);
	const destW = Math.max(0, dest.width);
	const destH = Math.max(0, dest.height);

	if (destW <= 0 || destH <= 0) {
		return {
			dx: dest.x,
			dy: dest.y,
			dWidth: 0,
			dHeight: 0,
			sx: 0,
			sy: 0,
			sWidth: safeSrcW,
			sHeight: safeSrcH,
		};
	}

	const srcAspect = safeSrcW / safeSrcH;
	const destAspect = destW / destH;

	if (fit === "contain") {
		let dWidth: number;
		let dHeight: number;
		if (srcAspect > destAspect) {
			dWidth = destW;
			dHeight = destW / srcAspect;
		} else {
			dHeight = destH;
			dWidth = destH * srcAspect;
		}
		return {
			dx: dest.x + (destW - dWidth) / 2,
			dy: dest.y + (destH - dHeight) / 2,
			dWidth,
			dHeight,
			sx: 0,
			sy: 0,
			sWidth: safeSrcW,
			sHeight: safeSrcH,
		};
	}

	// cover — fill dest, crop source
	let sWidth: number;
	let sHeight: number;
	if (srcAspect > destAspect) {
		sHeight = safeSrcH;
		sWidth = safeSrcH * destAspect;
	} else {
		sWidth = safeSrcW;
		sHeight = safeSrcW / destAspect;
	}
	return {
		dx: dest.x,
		dy: dest.y,
		dWidth: destW,
		dHeight: destH,
		sx: (safeSrcW - sWidth) / 2,
		sy: (safeSrcH - sHeight) / 2,
		sWidth,
		sHeight,
	};
}
