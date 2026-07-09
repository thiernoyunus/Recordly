import { describe, expect, it } from "vitest";
import {
	convertAvccToAnnexB,
	ensureAnnexBChunk,
	hasAnnexBStartCode,
	looksLikeAnnexB,
} from "./annexB";

describe("annexB helpers", () => {
	it("detects 3- and 4-byte start codes", () => {
		expect(hasAnnexBStartCode(new Uint8Array([0, 0, 1, 0x65]))).toBe(true);
		expect(hasAnnexBStartCode(new Uint8Array([0, 0, 0, 1, 0x65]))).toBe(true);
		expect(looksLikeAnnexB(new Uint8Array([0, 0, 0, 1, 0x67, 0x42]))).toBe(true);
		expect(looksLikeAnnexB(new Uint8Array([0, 0, 0, 8, 0x67, 0x42]))).toBe(false);
	});

	it("converts AVCC length-prefixed NALs to Annex B", () => {
		const nal = new Uint8Array([0x67, 0x42, 0x00, 0x1e]);
		const avcc = new Uint8Array(4 + nal.byteLength);
		avcc[0] = 0;
		avcc[1] = 0;
		avcc[2] = 0;
		avcc[3] = nal.byteLength;
		avcc.set(nal, 4);

		const annexB = convertAvccToAnnexB(avcc);
		expect(annexB).not.toBeNull();
		expect(looksLikeAnnexB(annexB!)).toBe(true);
		expect(Array.from(annexB!.subarray(0, 4))).toEqual([0, 0, 0, 1]);
		expect(Array.from(annexB!.subarray(4))).toEqual(Array.from(nal));
	});

	it("returns null for garbage that is not AVCC", () => {
		expect(convertAvccToAnnexB(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
	});

	it("ensureAnnexBChunk passes through Annex B and converts AVCC", () => {
		const annexB = new Uint8Array([0, 0, 0, 1, 0x65, 0x88]);
		expect(ensureAnnexBChunk(annexB).format).toBe("annexb");

		const avcc = new Uint8Array([0, 0, 0, 2, 0x65, 0x88]);
		const ensured = ensureAnnexBChunk(avcc);
		expect(ensured.format).toBe("avcc-converted");
		expect(looksLikeAnnexB(ensured.data)).toBe(true);
	});

	it("converts AVCC whose length bytes look like an Annex B start code", () => {
		// NAL length 258 = 0x00000102 → first three bytes are 00 00 01 (false Annex B).
		const largeNal = new Uint8Array(258);
		largeNal[0] = 0x65;
		const largeAvcc = new Uint8Array(4 + largeNal.byteLength);
		largeAvcc[0] = 0;
		largeAvcc[1] = 0;
		largeAvcc[2] = 1;
		largeAvcc[3] = 2;
		largeAvcc.set(largeNal, 4);

		// Old looksLikeAnnexB-first path would mis-classify this as Annex B.
		expect(looksLikeAnnexB(largeAvcc)).toBe(true);
		const ensured = ensureAnnexBChunk(largeAvcc);
		expect(ensured.format).toBe("avcc-converted");
		expect(looksLikeAnnexB(ensured.data)).toBe(true);
		expect(Array.from(ensured.data.subarray(0, 4))).toEqual([0, 0, 0, 1]);
		expect(ensured.data.byteLength).toBe(4 + largeNal.byteLength);
	});
});
