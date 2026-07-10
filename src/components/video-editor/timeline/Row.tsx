import type { RowDefinition } from "dnd-timeline";
import { useRow } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { TRACK_RAIL_WIDTH_PX } from "./timelineChrome";

interface RowProps extends RowDefinition {
	children: React.ReactNode;
	label?: string;
	hint?: string;
	isEmpty?: boolean;
	labelColor?: string;
	/** Short track name for CapCut-style left rail (e.g. "Zoom", "Clip") */
	trackLabel?: string;
	/**
	 * When true, this row's rail is the single element dnd-timeline measures for
	 * `sidebarWidth` (axis/playhead/seek math). Only one row should set this.
	 */
	measureSidebar?: boolean;
	onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
	onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
	onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
	onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
	onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function Row({
	id,
	children,
	label,
	hint,
	isEmpty,
	labelColor = "rgba(255,255,255,0.45)",
	trackLabel,
	measureSidebar = false,
	onMouseEnter,
	onMouseMove,
	onMouseLeave,
	onMouseDown,
	onClick,
}: RowProps) {
	const { setNodeRef, rowWrapperStyle, rowStyle, setSidebarRef, rowSidebarStyle } = useRow({
		id,
	});
	const railText = trackLabel || label;

	return (
		<div
			className="group/row relative min-h-[34px] w-full"
			style={{
				...rowWrapperStyle,
				display: "flex",
				width: "100%",
				marginBottom: 1,
			}}
		>
			{/* CapCut-style track rail — width must match TRACK_RAIL_WIDTH_PX / sidebarWidth */}
			<div
				ref={measureSidebar ? setSidebarRef : undefined}
				className={cn(
					"relative z-[3] flex flex-shrink-0 items-center justify-center",
					"border-r border-foreground/[0.06] bg-editor-header/80",
				)}
				style={{
					...rowSidebarStyle,
					width: TRACK_RAIL_WIDTH_PX,
					minWidth: TRACK_RAIL_WIDTH_PX,
				}}
			>
				{railText ? (
					<span
						className="max-w-[44px] truncate px-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.08em]"
						style={{ color: labelColor }}
						title={railText}
					>
						{railText}
					</span>
				) : null}
			</div>

			<div
				ref={setNodeRef}
				className={cn(
					"relative min-h-[34px] flex-1 overflow-hidden",
					"bg-editor-row/40 group-hover/row:bg-editor-row/70",
					"transition-colors duration-100",
				)}
				style={rowStyle}
				onMouseEnter={onMouseEnter}
				onMouseMove={onMouseMove}
				onMouseLeave={onMouseLeave}
				onMouseDown={onMouseDown}
				onClick={onClick}
			>
				{/* Subtle lane sheen */}
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent" />
				{isEmpty && hint && (
					<div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none">
						<span className="rounded-full border border-foreground/[0.06] bg-editor-bg/40 px-2.5 py-0.5 text-[10px] font-medium text-foreground/20">
							{hint}
						</span>
					</div>
				)}
				{children}
			</div>
		</div>
	);
}
