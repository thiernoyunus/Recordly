/**
 * Helpers for H.264 bitstreams produced by WebCodecs VideoEncoder and consumed
 * by FFmpeg's raw H.264 demuxer (`-f h264 -i pipe:0`).
 *
 * WebCodecs can emit either Annex B (start-code delimited) or AVCC
 * (length-prefixed) NAL units. FFmpeg's raw H.264 demuxer only accepts Annex B.
 * If we feed AVCC, FFmpeg dies immediately and Node reports the follow-on write
 * as `write EPIPE` — hiding the real cause.
 */

const START_CODE_3 = [0x00, 0x00, 0x01] as const;
const START_CODE_4 = [0x00, 0x00, 0x00, 0x01] as const;

export function hasAnnexBStartCode(data: Uint8Array, offset = 0): boolean {
	if (offset + 3 > data.byteLength) {
		return false;
	}

	if (
		data[offset] === START_CODE_3[0] &&
		data[offset + 1] === START_CODE_3[1] &&
		data[offset + 2] === START_CODE_3[2]
	) {
		return true;
	}

	if (offset + 4 > data.byteLength) {
		return false;
	}

	return (
		data[offset] === START_CODE_4[0] &&
		data[offset + 1] === START_CODE_4[1] &&
		data[offset + 2] === START_CODE_4[2] &&
		data[offset + 3] === START_CODE_4[3]
	);
}

export function looksLikeAnnexB(data: Uint8Array): boolean {
	return data.byteLength >= 3 && hasAnnexBStartCode(data, 0);
}

/**
 * Convert length-prefixed (AVCC) NAL units to Annex B by inserting start codes.
 * Returns null when the buffer cannot be parsed as AVCC (so callers can fall back).
 */
export function convertAvccToAnnexB(data: Uint8Array): Uint8Array | null {
	if (data.byteLength < 4 || looksLikeAnnexB(data)) {
		return null;
	}

	const parts: Uint8Array[] = [];
	let offset = 0;
	let nalCount = 0;

	while (offset + 4 <= data.byteLength) {
		const nalLength =
			((data[offset] << 24) |
				(data[offset + 1] << 16) |
				(data[offset + 2] << 8) |
				data[offset + 3]) >>>
			0;
		offset += 4;

		if (nalLength === 0 || offset + nalLength > data.byteLength) {
			return null;
		}

		const startCode = new Uint8Array(START_CODE_4);
		const nal = data.subarray(offset, offset + nalLength);
		parts.push(startCode, nal);
		offset += nalLength;
		nalCount += 1;
	}

	// Trailing bytes mean this wasn't clean AVCC.
	if (offset !== data.byteLength || nalCount === 0) {
		return null;
	}

	const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const output = new Uint8Array(totalLength);
	let writeOffset = 0;
	for (const part of parts) {
		output.set(part, writeOffset);
		writeOffset += part.byteLength;
	}
	return output;
}

/**
 * Ensure the chunk is Annex B. Passes through already-Annex-B data; converts AVCC
 * when possible; otherwise returns the original buffer unchanged.
 */
export function ensureAnnexBChunk(data: Uint8Array): {
	data: Uint8Array;
	format: "annexb" | "avcc-converted" | "unknown";
} {
	if (looksLikeAnnexB(data)) {
		return { data, format: "annexb" };
	}

	const converted = convertAvccToAnnexB(data);
	if (converted) {
		return { data: converted, format: "avcc-converted" };
	}

	return { data, format: "unknown" };
}
