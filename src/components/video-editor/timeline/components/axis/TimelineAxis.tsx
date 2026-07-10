import { useTimelineContext } from "dnd-timeline";
import { useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { calculateAxisScale, formatTimeLabel } from "../../core/time";

interface TimelineAxisProps {
	videoDurationMs: number;
	currentTimeMs: number;
}

/**
 * CapCut / Screen Studio inspired time ruler — dense minor ticks, calm major labels.
 */
export default function TimelineAxis({ videoDurationMs, currentTimeMs }: TimelineAxisProps) {
	const { sidebarWidth, direction, range, valueToPixels } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";

	const { intervalMs } = useMemo(
		() => calculateAxisScale(range.end - range.start),
		[range.end, range.start],
	);

	const markers = useMemo(() => {
		if (intervalMs <= 0) {
			return { markers: [], minorTicks: [] as number[], intervalMs: 1000 };
		}

		// When zoomed out past the media (CapCut-style empty track), still tick
		// the full visible range — not only up to the clip end.
		const mediaEnd = videoDurationMs > 0 ? videoDurationMs : range.end;
		const axisEnd = Math.max(range.end, mediaEnd);
		const visibleStart = Math.max(0, Math.min(range.start, axisEnd));
		const visibleEnd = Math.min(range.end, axisEnd);
		const markerTimes = new Set<number>();
		const firstMarker = Math.ceil(visibleStart / intervalMs) * intervalMs;

		for (let time = firstMarker; time <= visibleEnd; time += intervalMs) {
			markerTimes.add(Math.round(time));
		}

		if (visibleStart <= axisEnd) markerTimes.add(Math.round(visibleStart));
		if (mediaEnd > 0 && mediaEnd >= range.start && mediaEnd <= range.end) {
			markerTimes.add(Math.round(mediaEnd));
		}

		const sorted = Array.from(markerTimes)
			.filter((time) => time <= axisEnd)
			.sort((a, b) => a - b);

		const minorTicks: number[] = [];
		const minorInterval = intervalMs / 5;
		for (let time = firstMarker; time <= visibleEnd; time += minorInterval) {
			const isMajor = Math.abs(time % intervalMs) < 1;
			if (!isMajor) minorTicks.push(time);
		}

		return {
			markers: sorted.map((time) => ({ time, label: formatTimeLabel(time, intervalMs) })),
			minorTicks,
			intervalMs,
		};
	}, [intervalMs, range.end, range.start, videoDurationMs]);

	return (
		<div
			className="relative h-8 flex-shrink-0 select-none overflow-hidden border-b border-foreground/[0.07] bg-editor-header"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
			}}
		>
			{/* Baseline rule */}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-foreground/[0.08]" />

			{markers.minorTicks.map((time) => {
				const offset = valueToPixels(time - range.start);
				return (
					<div
						key={`minor-${time}`}
						className="absolute bottom-0 h-2 w-px bg-foreground/[0.12]"
						style={{ [sideProperty]: `${offset}px` }}
					/>
				);
			})}

			{markers.markers.map((marker) => {
				const offset = valueToPixels(marker.time - range.start);
				const isNearPlayhead =
					Math.abs(marker.time - currentTimeMs) <
					Math.max(1, (markers.intervalMs || 1000) / 8);
				const markerStyle: CSSProperties = {
					position: "absolute",
					bottom: 0,
					height: "100%",
					display: "flex",
					flexDirection: "row",
					alignItems: "flex-end",
					[sideProperty]: `${offset}px`,
					transform: direction === "rtl" ? "translateX(50%)" : "translateX(-50%)",
				};

				return (
					<div key={marker.time} style={markerStyle}>
						<div className="flex flex-col items-center pb-0.5">
							<span
								className={cn(
									"mb-1 text-[10px] font-medium tabular-nums tracking-tight",
									isNearPlayhead ? "text-[#2563EB]" : "text-foreground/40",
								)}
							>
								{marker.label}
							</span>
							<div
								className={cn(
									"h-2.5 w-px",
									isNearPlayhead ? "bg-[#2563EB]/80" : "bg-foreground/25",
								)}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
