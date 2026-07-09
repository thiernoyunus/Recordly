import { describe, expect, it } from "vitest";
import { buildNativeH264StreamExportArgs } from "./nativeVideoExport";

describe("buildNativeH264StreamExportArgs", () => {
	it("builds a robust Annex B pipe-to-MP4 copy command", () => {
		const args = buildNativeH264StreamExportArgs({
			frameRate: 30,
			outputPath: "/tmp/out.mp4",
		});

		expect(args).toContain("-f");
		expect(args).toContain("h264");
		expect(args).toContain("pipe:0");
		expect(args).toContain("-c:v");
		expect(args).toContain("copy");
		expect(args).toContain("-framerate");
		expect(args).toContain("30");
		expect(args).toContain("+genpts+discardcorrupt");
		expect(args[args.length - 1]).toBe("/tmp/out.mp4");
	});

	it("falls back to 30fps when frame rate is invalid", () => {
		const args = buildNativeH264StreamExportArgs({
			frameRate: Number.NaN,
			outputPath: "/tmp/out.mp4",
		});
		expect(args).toContain("30");
	});
});
