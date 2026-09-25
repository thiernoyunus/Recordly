import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { app } from "electron";

const nodeRequire = createRequire(import.meta.url);
const macBinaryCompatibilityCache = new Map<string, boolean>();
let macHostArchitecture: "arm64" | "x64" | null | undefined;

export function loadFfmpegStatic(): string | null {
	try {
		const moduleExports = nodeRequire("ffmpeg-static");
		if (typeof moduleExports === "string") {
			return moduleExports;
		}

		if (typeof moduleExports?.default === "string") {
			return moduleExports.default as string;
		}
	} catch {
		// ffmpeg-static not available; fall through to system FFmpeg
	}

	return null;
}

export function loadFfprobeStatic(): string | null {
	try {
		const moduleExports = nodeRequire("ffprobe-static");
		if (typeof moduleExports === "string") {
			return moduleExports;
		}

		if (typeof moduleExports?.path === "string") {
			return moduleExports.path as string;
		}

		if (typeof moduleExports?.default === "string") {
			return moduleExports.default as string;
		}

		if (typeof moduleExports?.default?.path === "string") {
			return moduleExports.default.path as string;
		}
	} catch {
		// ffprobe-static not available; fall through to system FFprobe
	}

	return null;
}

function getMacHostArchitecture(): "arm64" | "x64" | null {
	if (macHostArchitecture !== undefined) {
		return macHostArchitecture;
	}

	const result = spawnSync("/usr/sbin/sysctl", ["-n", "hw.optional.arm64"], {
		encoding: "utf-8",
		windowsHide: true,
	});
	const arm64Capability = result.status === 0 ? result.stdout.trim() : "";
	if (arm64Capability === "1") {
		macHostArchitecture = "arm64";
	} else if (arm64Capability === "0") {
		macHostArchitecture = "x64";
	} else {
		macHostArchitecture = /\bApple\b/.test(cpus()[0]?.model ?? "")
			? "arm64"
			: process.arch === "x64"
				? "x64"
				: null;
	}

	return macHostArchitecture;
}

function isMacBinaryCompatible(description: string, hostArchitecture: "arm64" | "x64" | null) {
	// Do not launch Intel-only helpers on Apple silicon; macOS may prompt to install Rosetta.
	return hostArchitecture === "arm64"
		? /\barm64\b/.test(description)
		: hostArchitecture === "x64" && /\bx86_64\b/.test(description);
}

function isArchitectureCompatible(binaryPath: string): boolean {
	if (process.platform !== "darwin") {
		return true;
	}

	const cached = macBinaryCompatibilityCache.get(binaryPath);
	if (cached !== undefined) {
		return cached;
	}

	const hostArchitecture = getMacHostArchitecture();
	const result = spawnSync("/usr/bin/file", ["-Lb", binaryPath], {
		encoding: "utf-8",
		windowsHide: true,
		timeout: 5000,
	});
	const description = result.status === 0 ? result.stdout : "";
	const compatible = isMacBinaryCompatible(description, hostArchitecture);
	macBinaryCompatibilityCache.set(binaryPath, compatible);
	return compatible;
}

export function resolveSystemFfmpegBinaryPath(): string | null {
	const locator = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(
		locator,
		process.platform === "darwin" ? ["-a", "ffmpeg"] : ["ffmpeg"],
		{
			encoding: "utf-8",
			windowsHide: true,
		},
	);

	if (result.status === 0) {
		const candidates = result.stdout
			.split(/\r?\n/)
			.map((line: string) => line.trim())
			.filter((line: string) => line.length > 0);

		for (const candidate of candidates) {
			if (existsSync(candidate) && isRunnableBinary(candidate)) {
				return candidate;
			}
		}
	}

	// Fallback: check common install paths directly (Electron's shell may lack full PATH)
	if (process.platform !== "win32") {
		const commonPaths = [
			"/opt/homebrew/bin/ffmpeg",
			"/usr/local/bin/ffmpeg",
			"/usr/bin/ffmpeg",
		];
		for (const p of commonPaths) {
			if (existsSync(p) && isRunnableBinary(p)) {
				return p;
			}
		}
	}

	return null;
}

export function resolveSystemFfprobeBinaryPath(): string | null {
	const locator = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(
		locator,
		process.platform === "darwin" ? ["-a", "ffprobe"] : ["ffprobe"],
		{
			encoding: "utf-8",
			windowsHide: true,
		},
	);

	if (result.status === 0) {
		const candidates = result.stdout
			.split(/\r?\n/)
			.map((line: string) => line.trim())
			.filter((line: string) => line.length > 0);

		for (const candidate of candidates) {
			if (existsSync(candidate) && isRunnableBinary(candidate)) {
				return candidate;
			}
		}
	}

	if (process.platform !== "win32") {
		const commonPaths = [
			"/opt/homebrew/bin/ffprobe",
			"/usr/local/bin/ffprobe",
			"/usr/bin/ffprobe",
		];
		for (const p of commonPaths) {
			if (existsSync(p) && isRunnableBinary(p)) {
				return p;
			}
		}
	}

	return null;
}

function isRunnableBinary(binaryPath: string): boolean {
	if (!isArchitectureCompatible(binaryPath)) {
		return false;
	}

	try {
		const result = spawnSync(binaryPath, ["-version"], {
			windowsHide: true,
			stdio: "ignore",
			timeout: 5000,
		});
		return !result.error && result.status === 0;
	} catch {
		return false;
	}
}

export function getFfmpegBinaryPath(): string {
	const ffmpegStatic = loadFfmpegStatic();
	if (ffmpegStatic && typeof ffmpegStatic === "string") {
		const bundledPath = app.isPackaged
			? ffmpegStatic.replace(/\.asar([/\\])/, ".asar.unpacked$1")
			: ffmpegStatic;

		if (existsSync(bundledPath) && isRunnableBinary(bundledPath)) {
			return bundledPath;
		}
	}

	const systemFfmpeg = resolveSystemFfmpegBinaryPath();
	if (systemFfmpeg) {
		return systemFfmpeg;
	}

	throw new Error(
		"FFmpeg binary is unavailable. Install ffmpeg-static for this platform or make ffmpeg available on PATH.",
	);
}

export function getFfprobeBinaryPath(): string {
	const ffprobeStatic = loadFfprobeStatic();
	if (ffprobeStatic && typeof ffprobeStatic === "string") {
		const bundledPath = app.isPackaged
			? ffprobeStatic.replace(/\.asar([/\\])/, ".asar.unpacked$1")
			: ffprobeStatic;

		if (existsSync(bundledPath) && isRunnableBinary(bundledPath)) {
			return bundledPath;
		}
	}

	const systemFfprobe = resolveSystemFfprobeBinaryPath();
	if (systemFfprobe) {
		return systemFfprobe;
	}

	throw new Error(
		"FFprobe binary is unavailable. Install ffprobe-static for this platform or make ffprobe available on PATH.",
	);
}
