import { useTimelineContext } from "dnd-timeline";
import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { formatPlayheadTime } from "../../core/time";

interface PlaybackCursorProps {
	currentTimeMs: number;
	videoDurationMs: number;
	onSeek?: (time: number) => void;
	timelineRef: RefObject<HTMLDivElement>;
	keyframes?: { id: string; time: number }[];
	isLoading?: boolean;
}

/**
 * CapCut-style playhead: thin brand-blue needle + diamond head + time chip while dragging.
 * Uses transform for smoother scrubbing (less layout thrash than left/right updates).
 */
export default function PlaybackCursor({
	currentTimeMs,
	videoDurationMs,
	onSeek,
	timelineRef,
	keyframes = [],
	isLoading = false,
}: PlaybackCursorProps) {
	const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!timelineRef.current || !onSeek) return;
			const rect = timelineRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;
			const relativeMs = pixelsToValue(clickX);
			let absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));

			const snapThresholdMs = 150;
			const nearbyKeyframe = keyframes.find(
				(kf) =>
					Math.abs(kf.time - absoluteMs) <= snapThresholdMs &&
					kf.time >= range.start &&
					kf.time <= range.end,
			);
			if (nearbyKeyframe) absoluteMs = nearbyKeyframe.time;

			onSeek(absoluteMs / 1000);
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			document.body.style.cursor = "";
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "ew-resize";

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
		};
	}, [
		isDragging,
		onSeek,
		timelineRef,
		sidebarWidth,
		range.start,
		range.end,
		videoDurationMs,
		pixelsToValue,
		keyframes,
	]);

	if (videoDurationMs <= 0 || currentTimeMs < 0) return null;
	const clampedTime = Math.min(currentTimeMs, videoDurationMs);
	if (clampedTime < range.start || clampedTime > range.end) return null;

	const offset = valueToPixels(clampedTime - range.start);
	const translate =
		direction === "rtl" ? `translateX(-${offset}px)` : `translateX(${offset}px)`;

	return (
		<div
			className="pointer-events-none absolute inset-y-0 z-50"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
				[sideProperty]: 0,
				width: 0,
			}}
		>
			<div
				className="pointer-events-auto absolute top-0 bottom-0"
				style={{
					[sideProperty]: 0,
					transform: translate,
					willChange: "transform",
				}}
				onMouseDown={(e) => {
					e.stopPropagation();
					setIsDragging(true);
				}}
			>
				{/* Wide invisible hit target for easy grab */}
				<div className="absolute top-0 bottom-0 left-1/2 w-4 -translate-x-1/2 cursor-ew-resize" />

				{/* Needle */}
				<div
					className={cn(
						"absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2",
						"bg-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.55)]",
						isDragging && "w-[2.5px] shadow-[0_0_16px_rgba(37,99,235,0.75)]",
					)}
				/>

				{/* CapCut-style head: inverted teardrop / diamond */}
				<div
					className={cn(
						"absolute -top-0.5 left-1/2 z-10 -translate-x-1/2 cursor-ew-resize",
						"transition-transform duration-100",
						isDragging && "scale-110",
					)}
				>
					<div className="relative flex flex-col items-center">
						<div className="h-3.5 w-3.5 rotate-45 rounded-[3px] border border-white/25 bg-[#2563EB] shadow-[0_2px_8px_rgba(37,99,235,0.55)]" />
						<div className="-mt-1 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#2563EB]" />
					</div>
				</div>

				{/* Time chip while scrubbing / loading */}
				<div
					className={cn(
						"absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-foreground/10 bg-black/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/95 shadow-lg pointer-events-none transition-opacity",
						isDragging || isLoading ? "opacity-100" : "opacity-0",
					)}
				>
					<div className="flex items-center">
						{formatPlayheadTime(clampedTime)
							.split("")
							.map((char, i) => (
								<span
									key={i}
									className={cn(
										"leading-5 whitespace-pre",
										isLoading &&
											"bg-gradient-to-r from-white/40 via-white to-white/40 bg-clip-text text-transparent animate-text-shimmer",
									)}
									style={
										isLoading
											? {
													animationDelay: `${i * 0.05}s`,
													animationDuration: "2.5s",
												}
											: undefined
									}
								>
									{char}
								</span>
							))}
					</div>
				</div>
			</div>
		</div>
	);
}
