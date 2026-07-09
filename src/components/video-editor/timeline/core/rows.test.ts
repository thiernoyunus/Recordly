import { describe, expect, it } from "vitest";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	getBrollTrackIndex,
	getBrollTrackRowId,
	isBrollTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "./rows";

describe("timeline core/rows", () => {
	it("builds and parses annotation rows", () => {
		expect(getAnnotationTrackRowId(2.9)).toBe("row-annotation-2");
		expect(getAnnotationTrackRowId(-5)).toBe("row-annotation-0");
		expect(getAnnotationTrackIndex("row-annotation-4")).toBe(4);
		expect(getAnnotationTrackIndex("row-annotation")).toBe(0);
		expect(isAnnotationTrackRowId("row-annotation")).toBe(true);
		expect(isAnnotationTrackRowId("row-annotation-1")).toBe(true);
	});

	it("handles invalid annotation row IDs safely", () => {
		expect(getAnnotationTrackIndex("row-annotation-foo")).toBe(0);
		expect(getAnnotationTrackIndex("other")).toBe(0);
		expect(isAnnotationTrackRowId("row-audio-1")).toBe(false);
	});

	it("builds and parses audio rows", () => {
		expect(getAudioTrackRowId(1.2)).toBe("row-audio-1");
		expect(getAudioTrackRowId(-3)).toBe("row-audio-0");
		expect(getAudioTrackIndex("row-audio-3")).toBe(3);
		expect(getAudioTrackIndex("row-audio")).toBe(0);
		expect(isAudioTrackRowId("row-audio")).toBe(true);
		expect(isAudioTrackRowId("row-audio-1")).toBe(true);
	});

	it("handles invalid audio row IDs safely", () => {
		expect(getAudioTrackIndex("row-audio-foo")).toBe(0);
		expect(getAudioTrackIndex("other")).toBe(0);
		expect(isAudioTrackRowId("row-annotation-1")).toBe(false);
	});

	it("builds and parses B-roll rows", () => {
		expect(getBrollTrackRowId(2.4)).toBe("row-broll-2");
		expect(getBrollTrackRowId(-1)).toBe("row-broll-0");
		expect(getBrollTrackIndex("row-broll-5")).toBe(5);
		expect(getBrollTrackIndex("row-broll")).toBe(0);
		expect(isBrollTrackRowId("row-broll")).toBe(true);
		expect(isBrollTrackRowId("row-broll-1")).toBe(true);
		expect(isBrollTrackRowId("row-audio-1")).toBe(false);
	});
});
