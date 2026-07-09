export type DeleteSelectionTarget =
	| "keyframe"
	| "zoom"
	| "clip"
	| "annotation"
	| "audio"
	| "broll"
	| "caption"
	| "layout"
	| "none";

interface ResolveDeleteSelectionTargetParams {
	selectAllBlocksActive: boolean;
	selectedKeyframeId: string | null;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	selectedBrollId?: string | null;
	selectedCaptionId?: string | null;
	selectedLayoutId?: string | null;
}

export function resolveDeleteSelectionTarget({
	selectAllBlocksActive,
	selectedKeyframeId,
	selectedZoomId,
	selectedClipId,
	selectedAnnotationId,
	selectedAudioId,
	selectedBrollId,
	selectedCaptionId,
	selectedLayoutId,
}: ResolveDeleteSelectionTargetParams): DeleteSelectionTarget {
	if (selectAllBlocksActive) return "zoom";
	if (selectedKeyframeId) return "keyframe";
	if (selectedZoomId) return "zoom";
	if (selectedClipId) return "clip";
	if (selectedAnnotationId) return "annotation";
	if (selectedAudioId) return "audio";
	if (selectedBrollId) return "broll";
	if (selectedCaptionId) return "caption";
	if (selectedLayoutId) return "layout";
	return "none";
}
