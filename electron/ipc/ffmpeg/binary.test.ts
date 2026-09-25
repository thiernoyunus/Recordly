import { beforeEach, describe, expect, it, vi } from "vitest";

const { existsSyncMock, spawnSyncMock } = vi.hoisted(() => ({
	existsSyncMock: vi.fn(),
	spawnSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({ spawnSync: spawnSyncMock }));
vi.mock("node:fs", () => ({ existsSync: existsSyncMock }));
vi.mock("node:module", () => ({
	createRequire: () => (moduleName: string) => {
		if (moduleName === "ffmpeg-static") return "/bundled/darwin/x64/ffmpeg";
		if (moduleName === "ffprobe-static") return { path: "/bundled/darwin/x64/ffprobe" };
		throw new Error(`Unexpected module: ${moduleName}`);
	},
}));
vi.mock("electron", () => ({ app: { isPackaged: false } }));

describe.skipIf(process.platform !== "darwin")("FFmpeg binary architecture selection", () => {
	let hostArchitecture: "arm64" | "x64";
	let failingBinaryPaths: Set<string>;

	beforeEach(() => {
		vi.resetModules();
		hostArchitecture = "arm64";
		failingBinaryPaths = new Set();
		existsSyncMock.mockReset();
		existsSyncMock.mockReturnValue(true);
		spawnSyncMock.mockReset();
		spawnSyncMock.mockImplementation((command: string, args: string[]) => {
			if (command === "/usr/sbin/sysctl") {
				return { status: 0, stdout: hostArchitecture === "arm64" ? "1\n" : "0\n" };
			}
			if (command === "/usr/bin/file") {
				const binaryPath = args.at(-1) ?? "";
				return {
					status: 0,
					stdout: binaryPath.startsWith("/opt/homebrew/")
						? "Mach-O arm64"
						: "Mach-O x86_64",
				};
			}
			if (command === "which") {
				const binaryName = args.at(-1) ?? "ffmpeg";
				const brokenCandidate = `/opt/homebrew/bin/${binaryName}-broken`;
				const candidates = failingBinaryPaths.has(brokenCandidate)
					? [brokenCandidate, `/opt/homebrew/bin/${binaryName}`]
					: [`/usr/local/bin/${binaryName}`, `/opt/homebrew/bin/${binaryName}`];
				return { status: 0, stdout: `${candidates.join("\n")}\n` };
			}
			if (args[0] === "-version") {
				if (failingBinaryPaths.has(command)) {
					return { status: 1, stdout: "" };
				}
				return { status: 0, stdout: "FFmpeg version" };
			}
			return { status: 1, stdout: "" };
		});
	});

	it("uses the Intel video tools on Intel Macs", async () => {
		hostArchitecture = "x64";
		const { getFfmpegBinaryPath, getFfprobeBinaryPath, loadFfmpegStatic, loadFfprobeStatic } =
			await import("./binary");
		const bundledFfmpeg = loadFfmpegStatic();
		const bundledFfprobe = loadFfprobeStatic();

		expect(bundledFfmpeg).toBeTruthy();
		expect(bundledFfprobe).toBeTruthy();
		expect(getFfmpegBinaryPath()).toBe(bundledFfmpeg);
		expect(getFfprobeBinaryPath()).toBe(bundledFfprobe);
	});

	it("skips Intel video tools on Apple silicon and uses the ARM system copies", async () => {
		const { getFfmpegBinaryPath, getFfprobeBinaryPath, loadFfmpegStatic, loadFfprobeStatic } =
			await import("./binary");
		const bundledBinaries = [loadFfmpegStatic(), loadFfprobeStatic()].filter(
			(binaryPath): binaryPath is string => Boolean(binaryPath),
		);

		expect(getFfmpegBinaryPath()).toBe("/opt/homebrew/bin/ffmpeg");
		expect(getFfprobeBinaryPath()).toBe("/opt/homebrew/bin/ffprobe");
		expect(spawnSyncMock).toHaveBeenCalledWith("which", ["-a", "ffmpeg"], expect.any(Object));
		expect(spawnSyncMock).toHaveBeenCalledWith("which", ["-a", "ffprobe"], expect.any(Object));
		expect(
			spawnSyncMock.mock.calls
				.filter(([, args]) => args[0] === "-version")
				.map(([binaryPath]) => binaryPath),
		).not.toEqual(expect.arrayContaining(bundledBinaries));
	});

	it("continues to later PATH candidates when an earlier binary cannot run", async () => {
		failingBinaryPaths.add("/opt/homebrew/bin/ffmpeg-broken");
		failingBinaryPaths.add("/opt/homebrew/bin/ffprobe-broken");
		const { getFfmpegBinaryPath, getFfprobeBinaryPath } = await import("./binary");

		expect(getFfmpegBinaryPath()).toBe("/opt/homebrew/bin/ffmpeg");
		expect(getFfprobeBinaryPath()).toBe("/opt/homebrew/bin/ffprobe");
		expect(spawnSyncMock).toHaveBeenCalledWith(
			"/opt/homebrew/bin/ffmpeg-broken",
			["-version"],
			expect.any(Object),
		);
		expect(spawnSyncMock).toHaveBeenCalledWith(
			"/opt/homebrew/bin/ffprobe-broken",
			["-version"],
			expect.any(Object),
		);
	});
});

describe("Windows FFmpeg binary selection", () => {
	it("uses Windows executable lookup for the system fallback", async () => {
		const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
		vi.resetModules();
		Object.defineProperty(process, "platform", { value: "win32" });
		existsSyncMock.mockReset();
		existsSyncMock.mockImplementation(
			(binaryPath: string) => !binaryPath.startsWith("/bundled/"),
		);
		spawnSyncMock.mockReset();
		spawnSyncMock.mockImplementation((command: string, args: string[]) => {
			if (command === "where") {
				return { status: 0, stdout: `C:\\Recordly\\tools\\${args[0]}.exe\r\n` };
			}
			if (args[0] === "-version") {
				return { status: 0, stdout: "FFmpeg version" };
			}
			return { status: 1, stdout: "" };
		});

		try {
			const { getFfmpegBinaryPath, getFfprobeBinaryPath } = await import("./binary");

			expect(getFfmpegBinaryPath()).toBe("C:\\Recordly\\tools\\ffmpeg.exe");
			expect(getFfprobeBinaryPath()).toBe("C:\\Recordly\\tools\\ffprobe.exe");
			expect(spawnSyncMock).toHaveBeenCalledWith("where", ["ffmpeg"], expect.any(Object));
			expect(spawnSyncMock).toHaveBeenCalledWith("where", ["ffprobe"], expect.any(Object));
		} finally {
			if (originalPlatform) {
				Object.defineProperty(process, "platform", originalPlatform);
			}
			vi.resetModules();
		}
	});
});
