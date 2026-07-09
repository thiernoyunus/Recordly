import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { RECORDINGS_DIR } from "../appPaths";
import { AUTO_RECORDING_PREFIX, RECORDINGS_SETTINGS_FILE } from "./constants";
import {
	approvedLocalReadPaths,
	customRecordingsDir,
	recordingsDirLoaded,
	setCustomRecordingsDir,
	setRecordingsDirLoaded,
} from "./state";

const nodeRequire = createRequire(import.meta.url);

export function getScreen() {
	if (!app.isReady()) {
		throw new Error(
			"getScreen() called before app is ready. Ensure all screen access happens after app.whenReady().",
		);
	}
	return nodeRequire("electron").screen as typeof import("electron").screen;
}

export function normalizePath(filePath: string) {
	return path.resolve(filePath);
}

export function normalizeVideoSourcePath(videoPath?: string | null): string | null {
	if (typeof videoPath !== "string") {
		return null;
	}

	const trimmed = videoPath.trim();
	if (!trimmed) {
		return null;
	}

	if (/^file:\/\//i.test(trimmed)) {
		try {
			return fileURLToPath(trimmed);
		} catch {
			// Fall through and keep best-effort string path below.
		}
	}

	return trimmed;
}

export function stripJsonByteOrderMark(content: string) {
	return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function parseJsonWithByteOrderMark<T = unknown>(content: string): T {
	return JSON.parse(stripJsonByteOrderMark(content)) as T;
}

export function parseWindowId(sourceId?: string) {
	if (!sourceId) return null;
	const match = sourceId.match(/^window:(\d+)/);
	return match ? Number.parseInt(match[1], 10) : null;
}

export function getTelemetryPathForVideo(videoPath: string) {
	return `${videoPath}.cursor.json`;
}

export function isAutoRecordingPath(filePath: string) {
	return path.basename(filePath).startsWith(AUTO_RECORDING_PREFIX);
}

export async function moveFileWithOverwrite(sourcePath: string, destinationPath: string) {
	await fs.mkdir(path.dirname(destinationPath), { recursive: true });
	await fs.rm(destinationPath, { force: true });

	try {
		await fs.rename(sourcePath, destinationPath);
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code !== "EXDEV") {
			throw error;
		}

		await fs.copyFile(sourcePath, destinationPath);
		await fs.unlink(sourcePath);
	}
}

async function loadRecordingsDirectorySetting() {
	if (recordingsDirLoaded) {
		return;
	}

	setRecordingsDirLoaded(true);

	try {
		const content = await fs.readFile(RECORDINGS_SETTINGS_FILE, "utf-8");
		const parsed = parseJsonWithByteOrderMark<{ recordingsDir?: unknown }>(content);
		if (typeof parsed.recordingsDir === "string" && parsed.recordingsDir.trim()) {
			setCustomRecordingsDir(path.resolve(parsed.recordingsDir));
		}
	} catch {
		setCustomRecordingsDir(null);
	}
}

export async function getRecordingsDir() {
	await loadRecordingsDirectorySetting();
	const targetDir = customRecordingsDir ?? RECORDINGS_DIR;
	await fs.mkdir(targetDir, { recursive: true });
	return targetDir;
}

export type MacPrivacyPane = "screen" | "accessibility" | "microphone" | "camera";

/**
 * Deep-link URLs for macOS Privacy panes.
 * Prefer the modern Settings app URLs (Ventura+), keep legacy System Preferences
 * URLs as fallbacks for older macOS.
 */
export function getMacPrivacySettingsUrls(pane: MacPrivacyPane): string[] {
	const modernExtension =
		"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension";
	const legacySecurity = "x-apple.systempreferences:com.apple.preference.security";

	switch (pane) {
		case "screen":
			return [
				`${modernExtension}?Privacy_ScreenCapture`,
				`${legacySecurity}?Privacy_ScreenCapture`,
			];
		case "microphone":
			return [
				`${modernExtension}?Privacy_Microphone`,
				`${legacySecurity}?Privacy_Microphone`,
			];
		case "camera":
			return [`${modernExtension}?Privacy_Camera`, `${legacySecurity}?Privacy_Camera`];
		case "accessibility":
			return [
				`${modernExtension}?Privacy_Accessibility`,
				`${legacySecurity}?Privacy_Accessibility`,
			];
		default:
			return [`${modernExtension}?Privacy_ScreenCapture`];
	}
}

export function getMacPrivacySettingsUrl(pane: MacPrivacyPane): string {
	return getMacPrivacySettingsUrls(pane)[0];
}

/**
 * Open the right Privacy pane. Tries modern Settings URLs first, then legacy.
 * Uses `open` so deep links resolve even when shell.openExternal is picky.
 */
export async function openMacPrivacySettings(pane: MacPrivacyPane): Promise<void> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFileAsync = promisify(execFile);
	const { shell } = await import("electron");

	const urls = getMacPrivacySettingsUrls(pane);
	let lastError: unknown;

	for (const url of urls) {
		try {
			await execFileAsync("open", [url], { timeout: 5000 });
			return;
		} catch (error) {
			lastError = error;
			try {
				await shell.openExternal(url);
				return;
			} catch (shellError) {
				lastError = shellError;
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error(`Failed to open macOS privacy settings for ${pane}`);
}

export function approveUserPath(filePath: string | null | undefined): void {
	if (!filePath) return;
	try {
		approvedLocalReadPaths.add(path.resolve(filePath));
	} catch {
		// Ignore invalid paths; later reads will surface the underlying error.
	}
}
