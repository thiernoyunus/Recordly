import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import type { BRollRegion, SceneLayoutSettings } from "../types";
import { getBRollAtTime, getLayoutAtTime } from "../types";
import { resolveBRollTargetRect } from "./brollLayout";
import { computeSceneBandRects, type LayoutRect } from "./layoutUtils";

interface BrollPreviewOverlayProps {
	regions: BRollRegion[];
	currentTimeSec: number;
	isPlaying: boolean;
	layout: SceneLayoutSettings;
	layoutRegions?: Array<{
		id: string;
		startMs: number;
		endMs: number;
		layout: SceneLayoutSettings;
	}>;
	stageWidth: number;
	stageHeight: number;
	maskRect?: LayoutRect | null;
	/** When true, full placement sits under captions; screen placement also under webcam band. */
	zIndex?: number;
}

/**
 * DOM overlay for B-roll preview — absolute children clipped to target rects
 * with object-fit cover/contain. Video B-roll is always muted.
 */
export function BrollPreviewOverlay({
	regions,
	currentTimeSec,
	isPlaying,
	layout,
	layoutRegions,
	stageWidth,
	stageHeight,
	maskRect = null,
	zIndex = 2,
}: BrollPreviewOverlayProps) {
	const timeMs = Math.round(currentTimeSec * 1000);
	const active = useMemo(() => getBRollAtTime(regions, timeMs), [regions, timeMs]);
	const activeLayout = useMemo(
		() => getLayoutAtTime(layoutRegions, layout, timeMs),
		[layoutRegions, layout, timeMs],
	);
	const screenRect = useMemo(() => {
		if (stageWidth <= 0 || stageHeight <= 0) {
			return null;
		}
		return computeSceneBandRects(activeLayout, stageWidth, stageHeight).screenRect;
	}, [activeLayout, stageWidth, stageHeight]);

	if (active.length === 0 || stageWidth <= 0 || stageHeight <= 0) {
		return null;
	}

	return (
		<div className="pointer-events-none absolute inset-0" style={{ zIndex }}>
			{active.map((region) => {
				const target = resolveBRollTargetRect({
					placement: region.placement,
					stageWidth,
					stageHeight,
					screenRect,
					maskRect,
				});
				// Full-frame B-roll intentionally covers the camera bubble (above webcam z-index 3).
				// Screen-only B-roll stays under the camera band (default zIndex).
				const itemZ = region.placement === "full" ? zIndex + 2 : zIndex;
				return (
					<div key={region.id} style={{ zIndex: itemZ, position: "absolute", inset: 0 }}>
						<BrollPreviewItem
							region={region}
							target={target}
							timeMs={timeMs}
							isPlaying={isPlaying}
						/>
					</div>
				);
			})}
		</div>
	);
}

function BrollPreviewItem({
	region,
	target,
	timeMs,
	isPlaying,
}: {
	region: BRollRegion;
	target: LayoutRect;
	timeMs: number;
	isPlaying: boolean;
}) {
	const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
	const [src, setSrc] = useState<string | null>(null);
	const revokeRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let cancelled = false;
		revokeRef.current?.();
		revokeRef.current = null;
		setSrc(null);

		void (async () => {
			try {
				const resolved = await resolveMediaElementSource(region.mediaPath);
				if (cancelled) {
					resolved.revoke();
					return;
				}
				revokeRef.current = resolved.revoke;
				setSrc(resolved.src);
			} catch {
				if (!cancelled) {
					setSrc(null);
				}
			}
		})();

		return () => {
			cancelled = true;
			revokeRef.current?.();
			revokeRef.current = null;
		};
	}, [region.mediaPath]);

	useEffect(() => {
		if (region.mediaKind !== "video") {
			return;
		}
		const video = mediaRef.current as HTMLVideoElement | null;
		if (!video || !src) {
			return;
		}
		video.muted = true;
		const localSec = Math.max(0, (timeMs - region.startMs) / 1000);
		if (Math.abs(video.currentTime - localSec) > 0.12) {
			try {
				video.currentTime = localSec;
			} catch {
				// ignore seek races while metadata is still loading
			}
		}
		if (isPlaying) {
			void video.play().catch(() => undefined);
		} else {
			video.pause();
		}
	}, [region.mediaKind, region.startMs, timeMs, isPlaying, src]);

	if (!src || target.width <= 0 || target.height <= 0) {
		return null;
	}

	const commonStyle: CSSProperties = {
		position: "absolute",
		left: target.x,
		top: target.y,
		width: target.width,
		height: target.height,
		opacity: Math.max(0, Math.min(1, region.opacity ?? 1)),
		objectFit: region.fitMode === "contain" ? "contain" : "cover",
		pointerEvents: "none",
	};

	if (region.mediaKind === "image") {
		return (
			<img
				ref={(node) => {
					mediaRef.current = node;
				}}
				src={src}
				alt=""
				style={commonStyle}
				draggable={false}
			/>
		);
	}

	return (
		<video
			ref={(node) => {
				mediaRef.current = node;
			}}
			src={src}
			style={commonStyle}
			muted
			playsInline
			preload="auto"
			aria-hidden="true"
		/>
	);
}
