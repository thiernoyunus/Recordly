import { describe, expect, it } from "vitest";
import { deriveNextId } from "./projectPersistence";

import {
	type BRollRegion,
	extendAutoFullTrackClip,
	findClipAtTimelineTime,
	getBRollAtTime,
	getLayoutAtTime,
	getTimelineDurationMs,
	inferBRollMediaKind,
	mapSourceTimeToTimelineTime,
	mapTimelineTimeToSourceTime,
	trimsToClips,
} from "./types";

describe("getLayoutAtTime", () => {
	const baseLayout = { mode: "default", splitRatio: 0.4, cameraOnTop: false } as const;
	const splitLayout = { mode: "split", splitRatio: 0.3, cameraOnTop: true } as const;
	const cameraLayout = { mode: "camera", splitRatio: 0.4, cameraOnTop: false } as const;
	const regions = [
		{ id: "layout-1", startMs: 100, endMs: 200, layout: splitLayout },
		{ id: "layout-2", startMs: 300, endMs: 400, layout: cameraLayout },
	];

	it("returns the matching region layout inside a region", () => {
		expect(getLayoutAtTime(regions, baseLayout, 150)).toBe(splitLayout);
	});

	it("treats starts as inclusive and ends as exclusive", () => {
		expect(getLayoutAtTime(regions, baseLayout, 100)).toBe(splitLayout);
		expect(getLayoutAtTime(regions, baseLayout, 200)).toBe(baseLayout);
	});

	it("falls back to the base layout between regions", () => {
		expect(getLayoutAtTime(regions, baseLayout, 250)).toBe(baseLayout);
	});

	it("falls back to the base layout for empty or missing regions", () => {
		expect(getLayoutAtTime([], baseLayout, 150)).toBe(baseLayout);
		expect(getLayoutAtTime(undefined, baseLayout, 150)).toBe(baseLayout);
	});
});

describe("inferBRollMediaKind", () => {
	it("classifies common image extensions as image", () => {
		expect(inferBRollMediaKind("/tmp/shot.PNG")).toBe("image");
		expect(inferBRollMediaKind("C:\\media\\photo.jpeg")).toBe("image");
		expect(inferBRollMediaKind("clip.webp")).toBe("image");
	});

	it("treats everything else as video", () => {
		expect(inferBRollMediaKind("/tmp/clip.mp4")).toBe("video");
		expect(inferBRollMediaKind("broll.mov")).toBe("video");
		expect(inferBRollMediaKind("no-extension")).toBe("video");
	});
});

describe("getBRollAtTime", () => {
	const regions: BRollRegion[] = [
		{
			id: "b1",
			startMs: 0,
			endMs: 3000,
			mediaPath: "/a.png",
			mediaKind: "image",
			placement: "full",
			fitMode: "cover",
			opacity: 1,
			trackIndex: 1,
		},
		{
			id: "b2",
			startMs: 1000,
			endMs: 4000,
			mediaPath: "/b.mp4",
			mediaKind: "video",
			placement: "screen",
			fitMode: "contain",
			opacity: 0.8,
			trackIndex: 0,
		},
	];

	it("returns active regions sorted by trackIndex", () => {
		const active = getBRollAtTime(regions, 1500);
		expect(active.map((r) => r.id)).toEqual(["b2", "b1"]);
	});

	it("treats end as exclusive", () => {
		expect(getBRollAtTime(regions, 3000).map((r) => r.id)).toEqual(["b2"]);
		expect(getBRollAtTime(regions, 4000)).toEqual([]);
	});

	it("returns empty for missing regions", () => {
		expect(getBRollAtTime(undefined, 100)).toEqual([]);
		expect(getBRollAtTime([], 100)).toEqual([]);
	});
});

describe("extendAutoFullTrackClip", () => {
	it("extends the default full-track clip when metadata duration grows", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
				"clip-1",
				5_000,
				8_000,
			),
		).toEqual([{ id: "clip-1", startMs: 0, endMs: 8_000, speed: 1 }]);
	});

	it("does not change a clip that no longer matches the auto-created shape", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 4_000, speed: 1.5 }],
				"clip-1",
				5_000,
				8_000,
			),
		).toBeNull();
	});

	it("does not change multi-clip timelines", () => {
		expect(
			extendAutoFullTrackClip(
				[
					{ id: "clip-1", startMs: 0, endMs: 3_000, speed: 1 },
					{ id: "clip-2", startMs: 4_000, endMs: 8_000, speed: 1 },
				],
				"clip-1",
				8_000,
				10_000,
			),
		).toBeNull();
	});

	it("does not change clips when the duration does not grow", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 8_000, speed: 1 }],
				"clip-1",
				8_000,
				8_000,
			),
		).toBeNull();
	});

	it("does not change clips when the auto-created clip id is missing", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
				null,
				5_000,
				8_000,
			),
		).toBeNull();
	});

	it("does not change clips when the previous auto-created end time is missing", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
				"clip-1",
				null,
				8_000,
			),
		).toBeNull();
	});

	it("does not change clips when the reported duration shrinks", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 8_000, speed: 1 }],
				"clip-1",
				8_000,
				7_000,
			),
		).toBeNull();
	});

	it("does not change clips when the tracked clip id no longer matches", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
				"clip-2",
				5_000,
				8_000,
			),
		).toBeNull();
	});

	it("does not change clips when the clip no longer starts at zero", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 250, endMs: 5_000, speed: 1 }],
				"clip-1",
				5_000,
				8_000,
			),
		).toBeNull();
	});
});

describe("clip timeline mapping", () => {
	const clips = [
		{ id: "clip-1", startMs: 0, endMs: 4_000, speed: 1 },
		{ id: "clip-2", startMs: 6_000, endMs: 8_000, speed: 2 },
	];

	it("maps kept timeline time into source time", () => {
		expect(mapTimelineTimeToSourceTime(1_500, clips)).toBe(1_500);
		expect(mapTimelineTimeToSourceTime(7_000, clips)).toBe(8_000);
	});

	it("snaps timeline gaps to the nearest clip edge", () => {
		expect(mapTimelineTimeToSourceTime(4_300, clips)).toBe(4_000);
		expect(mapTimelineTimeToSourceTime(5_700, clips)).toBe(6_000);
	});

	it("maps kept source time back into timeline time", () => {
		expect(mapSourceTimeToTimelineTime(1_500, clips)).toBe(1_500);
		expect(mapSourceTimeToTimelineTime(8_000, clips)).toBe(7_000);
	});

	it("snaps removed source gaps to the nearest kept boundary", () => {
		expect(mapSourceTimeToTimelineTime(4_200, clips)).toBe(4_000);
		expect(mapSourceTimeToTimelineTime(5_900, clips)).toBe(6_000);
	});

	it("finds clips only inside visible kept spans", () => {
		expect(findClipAtTimelineTime(500, clips)?.id).toBe("clip-1");
		expect(findClipAtTimelineTime(5_000, clips)).toBeNull();
	});

	it("derives the next clip id after converting trim gaps into clip ids", () => {
		const clipsFromTrims = trimsToClips(
			[
				{ id: "trim-gap-1", startMs: 1_000, endMs: 2_000 },
				{ id: "trim-gap-2", startMs: 4_000, endMs: 5_000 },
			],
			6_000,
		);

		expect(clipsFromTrims.map((clip) => clip.id)).toEqual(["clip-1", "clip-2", "clip-3"]);
		expect(
			deriveNextId(
				"clip",
				clipsFromTrims.map((clip) => clip.id),
			),
		).toBe(4);
	});
});

describe("getTimelineDurationMs", () => {
	it("extends the timeline when a slow clip becomes longer than the source duration", () => {
		expect(
			getTimelineDurationMs(
				[{ id: "clip-1", startMs: 0, endMs: 20_000, speed: 0.5 }],
				10_000,
			),
		).toBe(20_000);
	});

	it("keeps the source duration when speed edits make clips shorter", () => {
		expect(
			getTimelineDurationMs([{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 2 }], 10_000),
		).toBe(10_000);
	});
});
