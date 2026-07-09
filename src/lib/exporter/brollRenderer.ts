import type { BRollRegion } from "@/components/video-editor/types";
import { getBRollAtTime } from "@/components/video-editor/types";
import {
	computeCoverContainDrawRect,
	resolveBRollTargetRect,
} from "@/components/video-editor/videoPlayback/brollLayout";
import type { LayoutRect } from "@/components/video-editor/videoPlayback/layoutUtils";
import { resolveMediaElementSource } from "./localMediaSource";

type PreloadedBrollMedia =
	| { kind: "image"; path: string; element: HTMLImageElement; revoke: () => void }
	| {
			kind: "video";
			path: string;
			element: HTMLVideoElement;
			revoke: () => void;
	  };

export class BrollMediaCache {
	private mediaByPath = new Map<string, PreloadedBrollMedia>();

	async preload(regions: BRollRegion[] | undefined): Promise<void> {
		if (!regions || regions.length === 0) {
			return;
		}

		const uniquePaths = Array.from(
			new Set(regions.map((region) => region.mediaPath).filter(Boolean)),
		);
		await Promise.all(
			uniquePaths.map(async (mediaPath) => {
				if (this.mediaByPath.has(mediaPath)) {
					return;
				}
				const region = regions.find((entry) => entry.mediaPath === mediaPath);
				if (!region) {
					return;
				}
				try {
					const loaded = await this.loadMedia(mediaPath, region.mediaKind);
					this.mediaByPath.set(mediaPath, loaded);
				} catch (error) {
					console.warn(
						"[brollRenderer] Failed to preload B-roll media:",
						mediaPath,
						error,
					);
				}
			}),
		);
	}

	private async loadMedia(
		mediaPath: string,
		mediaKind: BRollRegion["mediaKind"],
	): Promise<PreloadedBrollMedia> {
		const resolved = await resolveMediaElementSource(mediaPath);

		if (mediaKind === "image") {
			const image = new Image();
			image.decoding = "async";
			await new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = () =>
					reject(new Error(`Failed to load B-roll image: ${mediaPath}`));
				image.src = resolved.src;
			});
			return { kind: "image", path: mediaPath, element: image, revoke: resolved.revoke };
		}

		const video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.preload = "auto";
		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error(`Failed to load B-roll video: ${mediaPath}`));
			video.src = resolved.src;
		});
		return { kind: "video", path: mediaPath, element: video, revoke: resolved.revoke };
	}

	get(mediaPath: string): PreloadedBrollMedia | null {
		return this.mediaByPath.get(mediaPath) ?? null;
	}

	dispose(): void {
		for (const media of this.mediaByPath.values()) {
			if (media.kind === "video") {
				media.element.pause();
				media.element.removeAttribute("src");
				media.element.load();
			}
			media.revoke();
		}
		this.mediaByPath.clear();
	}
}

async function seekVideoElement(video: HTMLVideoElement, timeSec: number): Promise<void> {
	if (!Number.isFinite(timeSec) || timeSec < 0) {
		return;
	}
	const duration = Number.isFinite(video.duration) ? video.duration : timeSec;
	const clamped = Math.max(0, Math.min(timeSec, Math.max(0, duration - 0.001)));
	if (Math.abs(video.currentTime - clamped) < 0.02) {
		return;
	}
	await new Promise<void>((resolve) => {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const onSeeked = () => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
			video.removeEventListener("seeked", onSeeked);
			resolve();
		};
		video.addEventListener("seeked", onSeeked);
		try {
			video.currentTime = clamped;
		} catch {
			video.removeEventListener("seeked", onSeeked);
			resolve();
			return;
		}
		// Safety timeout if seek never fires.
		timeoutId = setTimeout(() => {
			video.removeEventListener("seeked", onSeeked);
			resolve();
		}, 250);
	});
}

/**
 * Draw active B-roll regions for the current export frame.
 * Call after the screen video (and webcam if already drawn) so full placement
 * can cover the camera band intentionally; annotations/captions should still
 * be drawn after this so text stays on top when possible.
 */
export async function drawBRollRegions(
	ctx: CanvasRenderingContext2D,
	regions: BRollRegion[] | undefined,
	timeMs: number,
	stageW: number,
	stageH: number,
	screenRect: LayoutRect | null,
	maskRect: LayoutRect | null | undefined,
	mediaCache: BrollMediaCache,
): Promise<void> {
	const active = getBRollAtTime(regions, timeMs);
	if (active.length === 0) {
		return;
	}

	for (const region of active) {
		const media = mediaCache.get(region.mediaPath);
		if (!media) {
			continue;
		}

		const dest = resolveBRollTargetRect({
			placement: region.placement,
			stageWidth: stageW,
			stageHeight: stageH,
			screenRect,
			maskRect,
		});
		if (dest.width <= 0 || dest.height <= 0) {
			continue;
		}

		let srcW = 0;
		let srcH = 0;
		let source: CanvasImageSource | null = null;

		if (media.kind === "image") {
			srcW = media.element.naturalWidth || media.element.width;
			srcH = media.element.naturalHeight || media.element.height;
			source = media.element;
		} else {
			media.element.muted = true;
			const localSec = Math.max(0, (timeMs - region.startMs) / 1000);
			await seekVideoElement(media.element, localSec);
			srcW = media.element.videoWidth;
			srcH = media.element.videoHeight;
			source = media.element;
		}

		if (!source || srcW <= 0 || srcH <= 0) {
			continue;
		}

		const draw = computeCoverContainDrawRect(srcW, srcH, dest, region.fitMode);
		ctx.save();
		ctx.globalAlpha = Math.max(0, Math.min(1, region.opacity ?? 1));
		ctx.beginPath();
		ctx.rect(dest.x, dest.y, dest.width, dest.height);
		ctx.clip();
		// Solid plate so Contain letterboxing does not show the live screen under the B-roll.
		ctx.fillStyle = "#000000";
		ctx.fillRect(dest.x, dest.y, dest.width, dest.height);
		ctx.drawImage(
			source,
			draw.sx,
			draw.sy,
			draw.sWidth,
			draw.sHeight,
			draw.dx,
			draw.dy,
			draw.dWidth,
			draw.dHeight,
		);
		ctx.restore();
	}
}
