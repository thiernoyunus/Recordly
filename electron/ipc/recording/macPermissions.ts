import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app, desktopCapturer, systemPreferences } from "electron";
import { ensureNativeCaptureHelperBinary } from "../paths/binaries";

const execFileAsync = promisify(execFile);

export type MacMediaPermissionStatus =
	| "not-determined"
	| "granted"
	| "denied"
	| "restricted"
	| "unknown";

export type MacPermissionSnapshot = {
	screen: MacMediaPermissionStatus;
	microphone: MacMediaPermissionStatus;
	camera: MacMediaPermissionStatus;
	accessibilityTrusted: boolean;
	/** What the user should look for in System Settings. */
	settingsLabel: string;
	isPackaged: boolean;
};

export type EnsureMacPermissionsResult = {
	success: boolean;
	screen: MacMediaPermissionStatus;
	microphone: MacMediaPermissionStatus;
	camera: MacMediaPermissionStatus;
	accessibilityTrusted: boolean;
	/** True when we actively prompted / registered with TCC this call. */
	requested: boolean;
	settingsLabel: string;
	isPackaged: boolean;
	missing: Array<"screen" | "microphone" | "camera" | "accessibility">;
	message?: string;
};

function asMediaStatus(value: string | undefined): MacMediaPermissionStatus {
	switch (value) {
		case "not-determined":
		case "granted":
		case "denied":
		case "restricted":
		case "unknown":
			return value;
		default:
			return "unknown";
	}
}

/**
 * Name that appears in macOS Privacy lists for this process.
 * Dev (`npm run dev`) shows as Electron; packaged builds show as Recordly.
 */
export function getMacPrivacySettingsLabel(): string {
	if (process.platform !== "darwin") {
		return app?.getName?.() || "Recordly";
	}

	try {
		if (app.isPackaged) {
			return app.getName() || "Recordly";
		}
	} catch {
		// app may be unavailable in unit tests
	}

	// Unpackaged Electron loads as Electron.app / Electron Helper.
	return "Electron";
}

export function readMacPermissionSnapshot(): MacPermissionSnapshot {
	if (process.platform !== "darwin") {
		return {
			screen: "granted",
			microphone: "granted",
			camera: "granted",
			accessibilityTrusted: true,
			settingsLabel: "Recordly",
			isPackaged: true,
		};
	}

	let screen: MacMediaPermissionStatus = "unknown";
	let microphone: MacMediaPermissionStatus = "unknown";
	let camera: MacMediaPermissionStatus = "unknown";
	let accessibilityTrusted = false;

	try {
		screen = asMediaStatus(systemPreferences.getMediaAccessStatus("screen"));
	} catch {
		screen = "unknown";
	}

	try {
		microphone = asMediaStatus(systemPreferences.getMediaAccessStatus("microphone"));
	} catch {
		microphone = "unknown";
	}

	try {
		camera = asMediaStatus(systemPreferences.getMediaAccessStatus("camera"));
	} catch {
		camera = "unknown";
	}

	try {
		accessibilityTrusted = systemPreferences.isTrustedAccessibilityClient(false);
	} catch {
		accessibilityTrusted = false;
	}

	let isPackaged = false;
	try {
		isPackaged = Boolean(app.isPackaged);
	} catch {
		isPackaged = false;
	}

	return {
		screen,
		microphone,
		camera,
		accessibilityTrusted,
		settingsLabel: getMacPrivacySettingsLabel(),
		isPackaged,
	};
}

/**
 * Register this process with TCC for screen recording.
 *
 * Opening System Settings alone does NOT add the app to the list. macOS only
 * shows an entry after CGRequestScreenCaptureAccess / a real capture attempt.
 */
async function triggerScreenRecordingTccRegistration(): Promise<void> {
	// 1) Electron-level capture probe — attributes to the main app / Electron.
	try {
		await Promise.race([
			desktopCapturer.getSources({
				types: ["screen"],
				thumbnailSize: { width: 1, height: 1 },
				fetchWindowIcons: false,
			}),
			new Promise<null>((resolve) => {
				setTimeout(() => resolve(null), 4000);
			}),
		]);
	} catch {
		// Expected when permission is not yet granted.
	}

	// 2) Native CGRequestScreenCaptureAccess via the capture helper.
	//    This is the reliable way to create the Privacy list entry.
	try {
		const helperPath = await ensureNativeCaptureHelperBinary();
		await execFileAsync(helperPath, ["--request-permissions"], {
			timeout: 15000,
			encoding: "utf8",
		});
	} catch {
		// Helper may exit non-zero when still denied; registration may still
		// have happened. Fall through and re-read status.
	}
}

async function requestMicrophoneAccess(): Promise<boolean> {
	if (process.platform !== "darwin") {
		return true;
	}

	try {
		const status = systemPreferences.getMediaAccessStatus("microphone");
		if (status === "granted") {
			return true;
		}
		// Only ask when still undecided — re-prompting after deny is useless.
		if (status === "not-determined" || status === "unknown") {
			return await systemPreferences.askForMediaAccess("microphone");
		}
		return false;
	} catch (error) {
		console.error("[permissions] Failed to request microphone access:", error);
		return false;
	}
}

async function requestCameraAccess(): Promise<boolean> {
	if (process.platform !== "darwin") {
		return true;
	}

	try {
		const status = systemPreferences.getMediaAccessStatus("camera");
		if (status === "granted") {
			return true;
		}
		if (status === "not-determined" || status === "unknown") {
			return await systemPreferences.askForMediaAccess("camera");
		}
		return false;
	} catch (error) {
		console.error("[permissions] Failed to request camera access:", error);
		return false;
	}
}

function requestAccessibilityAccess(): boolean {
	if (process.platform !== "darwin") {
		return true;
	}

	try {
		// Passing true shows the system prompt and adds the app to the list.
		return systemPreferences.isTrustedAccessibilityClient(true);
	} catch (error) {
		console.error("[permissions] Failed to request accessibility access:", error);
		return false;
	}
}

export function collectMissingPermissions(
	snapshot: Pick<
		MacPermissionSnapshot,
		"screen" | "microphone" | "camera" | "accessibilityTrusted"
	>,
	options: {
		requireMicrophone?: boolean;
		requireCamera?: boolean;
		requireAccessibility?: boolean;
	} = {},
): Array<"screen" | "microphone" | "camera" | "accessibility"> {
	const {
		requireMicrophone = true,
		requireCamera = false,
		requireAccessibility = true,
	} = options;
	const missing: Array<"screen" | "microphone" | "camera" | "accessibility"> = [];

	if (snapshot.screen !== "granted") {
		missing.push("screen");
	}
	if (requireMicrophone && snapshot.microphone !== "granted") {
		missing.push("microphone");
	}
	if (requireCamera && snapshot.camera !== "granted") {
		missing.push("camera");
	}
	if (requireAccessibility && !snapshot.accessibilityTrusted) {
		missing.push("accessibility");
	}

	return missing;
}

export function buildMacPermissionsGuidance(result: EnsureMacPermissionsResult): string {
	const label = result.settingsLabel;
	const lines: string[] = [];

	if (result.missing.includes("screen")) {
		lines.push(
			`Screen Recording: System Settings → Privacy & Security → Screen Recording (or "Screen & System Audio Recording"). Turn ON "${label}".`,
		);
	}
	if (result.missing.includes("microphone")) {
		lines.push(
			`Microphone: System Settings → Privacy & Security → Microphone. Turn ON "${label}".`,
		);
	}
	if (result.missing.includes("camera")) {
		lines.push(`Camera: System Settings → Privacy & Security → Camera. Turn ON "${label}".`);
	}
	if (result.missing.includes("accessibility")) {
		lines.push(
			`Accessibility: System Settings → Privacy & Security → Accessibility. Turn ON "${label}".`,
		);
	}

	if (!result.isPackaged) {
		lines.push(
			'You are running a development build. Look for "Electron" in the lists — not "Recordly".',
		);
	}

	lines.push(
		`After toggling permissions ON, fully quit ${label} (Cmd+Q) and open it again so macOS applies the change.`,
	);

	return lines.join("\n\n");
}

/**
 * Actively request every permission Recordly needs for recording.
 * Always tries to register with TCC first so the app appears in System Settings.
 */
export async function ensureMacRecordingPermissions(
	options: {
		requireMicrophone?: boolean;
		requireCamera?: boolean;
		requireAccessibility?: boolean;
	} = {},
): Promise<EnsureMacPermissionsResult> {
	const requireMicrophone = options.requireMicrophone ?? true;
	const requireCamera = options.requireCamera ?? false;
	const requireAccessibility = options.requireAccessibility ?? true;

	if (process.platform !== "darwin") {
		return {
			success: true,
			screen: "granted",
			microphone: "granted",
			camera: "granted",
			accessibilityTrusted: true,
			requested: false,
			settingsLabel: "Recordly",
			isPackaged: true,
			missing: [],
		};
	}

	const before = readMacPermissionSnapshot();
	let requested = false;

	// Always try to register screen capture with TCC when not already granted.
	// This is what makes the app appear in System Settings.
	if (before.screen !== "granted") {
		requested = true;
		await triggerScreenRecordingTccRegistration();
	}

	// Soft-request mic/camera even when not required, so Privacy list entries exist.
	// Hard "missing" still depends on require* flags below.
	if (before.microphone !== "granted") {
		requested = true;
		await requestMicrophoneAccess();
	}

	if (before.camera !== "granted" && (requireCamera || before.camera === "not-determined")) {
		requested = true;
		await requestCameraAccess();
	}

	let accessibilityTrusted = before.accessibilityTrusted;
	if (!accessibilityTrusted) {
		// Always prompt once so the Accessibility list entry is created.
		requested = true;
		accessibilityTrusted = requestAccessibilityAccess();
	}

	const after = readMacPermissionSnapshot();
	// Accessibility may have flipped via the prompt above; re-read can lag one tick.
	if (requireAccessibility && accessibilityTrusted) {
		after.accessibilityTrusted = true;
	}

	const missing = collectMissingPermissions(after, {
		requireMicrophone,
		requireCamera,
		requireAccessibility,
	});

	const result: EnsureMacPermissionsResult = {
		success: missing.length === 0,
		screen: after.screen,
		microphone: after.microphone,
		camera: after.camera,
		accessibilityTrusted: after.accessibilityTrusted,
		requested,
		settingsLabel: after.settingsLabel,
		isPackaged: after.isPackaged,
		missing,
	};

	if (!result.success) {
		result.message = buildMacPermissionsGuidance(result);
	}

	return result;
}
