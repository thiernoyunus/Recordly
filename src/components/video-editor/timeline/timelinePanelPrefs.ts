/** Persist + clamp the resizable timeline panel height (CapCut-style). */

export const TIMELINE_PANEL_HEIGHT_KEY = "recordly.timelinePanelHeightPx";
export const DEFAULT_TIMELINE_PANEL_HEIGHT_PX = 248;
export const MIN_TIMELINE_PANEL_HEIGHT_PX = 148;
export const MAX_TIMELINE_PANEL_HEIGHT_RATIO = 0.62;

export function clampTimelinePanelHeight(
	heightPx: number,
	viewportHeightPx: number = typeof window !== "undefined" ? window.innerHeight : 900,
): number {
	if (!Number.isFinite(heightPx)) {
		return DEFAULT_TIMELINE_PANEL_HEIGHT_PX;
	}
	const maxPx = Math.max(
		MIN_TIMELINE_PANEL_HEIGHT_PX,
		Math.round(viewportHeightPx * MAX_TIMELINE_PANEL_HEIGHT_RATIO),
	);
	return Math.min(maxPx, Math.max(MIN_TIMELINE_PANEL_HEIGHT_PX, Math.round(heightPx)));
}

export function loadTimelinePanelHeight(): number {
	try {
		const raw = localStorage.getItem(TIMELINE_PANEL_HEIGHT_KEY);
		if (raw == null) return DEFAULT_TIMELINE_PANEL_HEIGHT_PX;
		const parsed = Number(raw);
		return clampTimelinePanelHeight(parsed);
	} catch {
		return DEFAULT_TIMELINE_PANEL_HEIGHT_PX;
	}
}

export function saveTimelinePanelHeight(heightPx: number): void {
	try {
		localStorage.setItem(
			TIMELINE_PANEL_HEIGHT_KEY,
			String(clampTimelinePanelHeight(heightPx)),
		);
	} catch {
		// ignore quota / private mode
	}
}
