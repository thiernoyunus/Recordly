# Vertical Reels Plan — one YouTube recording → 9:16 social reel

**Goal:** Record a normal YouTube video in Recordly (screen + camera) once, then switch the
same project to 9:16 and get creator-style vertical layouts — no second recording.

Reference style (from the example video + Codex ad screenshots):
- Split screen: camera fills a band at the bottom (or top), screen content fills the rest.
- The screen content is a **cropped slice** blown up to fill the width — never the whole
  desktop shrunk down.
- The layout changes per beat: just camera → split → screen-heavy, every few seconds.

## Why build inside Recordly's existing 9:16 mode

Almost everything already exists:
- Aspect ratios incl. 9:16 (`src/utils/aspectRatioUtils.ts`).
- Camera overlay with free position, size, crop, roundness (`types.ts` WebcamOverlaySettings,
  `webcamOverlay.ts`).
- Manual zoom segments with a draggable focus point (`types.ts` ZoomRegion, focusUtils.ts).
- Preview and the main exporter share the same layout math (`videoPlayback/layoutUtils.ts`
  `computePaddedLayout`, reused by `lib/exporter/frameRenderer.ts`) — build it once, both match.

What's missing: the screen video is always "shrink to fit, center" (no bands), the camera was
designed as a small bubble (not a half-frame fill), and layouts can't change over time.

## Phases

### Phase 1 — Vertical layout presets (DONE — user-verified in app July 4, 2026)
Follow-up fixes shipped the same night: camera-band stretch (inner cover-crop now shaped
by the band via getSceneLayoutCameraAspect, not the bubble sliders), webcam recording
corruption (preview + recorder now request matching 1080p constraints — Chromium shares
one capture per camera and mismatched square/16:9 requests corrupted frames on this
device), and webcam capture upgraded to 1920x1080 ideal @ 12 Mbps.

A "Layout" choice for the project: `bubble` (today's behavior), `split`, `camera` (camera-only
full frame), `screen` (screen-only). Split adds:
- `splitRatio` — where the dividing line sits (camera band height as a fraction).
- `cameraOnTop` — flip which band the camera occupies.
- Screen band renders **cover** (fill the band, crop overflow) instead of contain.
- Camera band renders cover as well (center-crop the webcam to the band).

Data model: one new `layout` object on the project state, persisted + migrated in
`projectPersistence.ts` like every other field.

Render changes:
- `computePaddedLayout` (or a thin wrapper) learns an optional content rect (the band) and a
  cover fit mode. Preview (PixiJS sprite + mask in `VideoPlayback.tsx`) and the WebCodecs
  exporter (`frameRenderer.ts`) both go through it, so export parity is free.
- Camera band = existing webcam overlay driven to band-sized dimensions with cover-crop.
- Native/GPU export path (`nativeStaticLayoutGeometry.ts` etc.): if wiring it is non-trivial,
  vertical-layout projects quietly fall back to the standard exporter for now.

UI: a small Layout section in the settings sidebar (visible when the frame is taller than
wide), with the 4 presets, a split-position slider, and a flip button.

### Phase 2 — Layout segments on the timeline (BUILT July 4, 2026 — awaiting user test)
LayoutRegion { id, startMs, endMs, layout } + getLayoutAtTime (types.ts), persisted like
zoomRegions, resolved per-frame in preview and all exporters (hard cut at boundaries).
Timeline: teal "layout" track mirroring the zoom track (useTimelineLayoutActions, add via
Add Layer dropdown, drag/resize/select/delete, overlap-clamped), sidebar edits the selected
segment via the shared SceneLayoutControls. Track appears when portrait or regions exist.
All 330 editor tests pass, typecheck/lint clean, no new i18n errors. Not yet committed.
Skipped (add if wanted): keyboard shortcut for add-layout, animated transitions between
layouts (currently hard cut).

### Phase 3 — Framing the screen slice (BUILT July 4, 2026 — awaiting user test)
screenFocusX/Y (0-1, optional, 0.5-centered default) on SceneLayoutSettings — every layout
segment carries its own framing for free. computePaddedLayout cover mode takes contentFocus;
drag-to-pan on the preview's screen band (paused, grab cursor, content follows pointer 1:1;
manual-zoom selection takes priority; segment selected → edits that segment, no segments →
edits project layout; ambiguous → no-op). "Reset framing" button in SceneLayoutControls.
Zoom clamp inside bands verified fine (depth-only clamp, ignores stage size). 333 tests
pass, tsc clean, i18n check now FULLY passes (locale drift from the captions merge fixed
along the way). Not committed.

### Phase 4 — Polish
Drag the camera directly on the preview (today: sliders/preset grid only), circle-shape
one-click preset, export parity checks across encoder backends, GIF export dims if needed.

## Working notes
- State is plain `useState` in `VideoEditor.tsx` (6600+ lines), prop-drilled — new state
  follows the same pattern, no store.
- Any new persisted field must go through the normalize/migrate code in
  `projectPersistence.ts` (~lines 360–1050) so old projects still open.
- Preview camera = DOM overlay; exported camera = Canvas2D in `frameRenderer.ts`; both use
  `webcamOverlay.ts` geometry helpers — keep geometry changes in the shared helpers.
