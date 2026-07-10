import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
	clampTimelinePanelHeight,
	saveTimelinePanelHeight,
} from "./timelinePanelPrefs";

interface TimelineResizeHandleProps {
	heightPx: number;
	onHeightChange: (heightPx: number) => void;
	className?: string;
}

/**
 * Thin drag strip above the timeline — pull up for more track space,
 * pull down for a bigger preview (CapCut / Screen Studio feel).
 */
export default function TimelineResizeHandle({
	heightPx,
	onHeightChange,
	className,
}: TimelineResizeHandleProps) {
	const [isDragging, setIsDragging] = useState(false);
	const dragStartYRef = useRef(0);
	const dragStartHeightRef = useRef(heightPx);

	const onPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.currentTarget.setPointerCapture(event.pointerId);
			dragStartYRef.current = event.clientY;
			dragStartHeightRef.current = heightPx;
			setIsDragging(true);
		},
		[heightPx],
	);

	useEffect(() => {
		if (!isDragging) return;

		const onPointerMove = (event: PointerEvent) => {
			// Dragging the handle upward grows the timeline (screen Y decreases).
			const delta = dragStartYRef.current - event.clientY;
			const next = clampTimelinePanelHeight(dragStartHeightRef.current + delta);
			onHeightChange(next);
		};

		const onPointerUp = () => {
			setIsDragging(false);
			saveTimelinePanelHeight(heightPx);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
		document.body.style.cursor = "ns-resize";
		document.body.style.userSelect = "none";

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, [heightPx, isDragging, onHeightChange]);

	// Persist final height when drag ends (heightPx may lag one frame behind).
	useEffect(() => {
		if (isDragging) return;
		saveTimelinePanelHeight(heightPx);
	}, [isDragging, heightPx]);

	return (
		<div
			role="separator"
			aria-orientation="horizontal"
			aria-label="Resize timeline"
			aria-valuenow={heightPx}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onKeyDown={(event) => {
				const step = event.shiftKey ? 24 : 12;
				if (event.key === "ArrowUp") {
					event.preventDefault();
					const next = clampTimelinePanelHeight(heightPx + step);
					onHeightChange(next);
					saveTimelinePanelHeight(next);
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					const next = clampTimelinePanelHeight(heightPx - step);
					onHeightChange(next);
					saveTimelinePanelHeight(next);
				}
			}}
			className={cn(
				"group relative z-20 flex h-3 w-full flex-shrink-0 cursor-ns-resize items-center justify-center",
				"border-t border-foreground/[0.06] bg-editor-header/90 backdrop-blur-sm",
				"transition-colors hover:bg-editor-surface-alt",
				isDragging && "bg-editor-surface-alt",
				className,
			)}
		>
			{/* Grab pill — CapCut-style subtle control */}
			<div
				className={cn(
					"h-1 w-10 rounded-full bg-foreground/15 transition-all",
					"group-hover:w-12 group-hover:bg-[#2563EB]/70",
					isDragging && "w-14 bg-[#2563EB]",
				)}
			/>
			{/* Full-width hit target glow while dragging */}
			<div
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 h-px",
					isDragging ? "bg-[#2563EB]/80" : "bg-transparent group-hover:bg-[#2563EB]/35",
				)}
			/>
		</div>
	);
}
