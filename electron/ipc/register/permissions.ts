import { ipcMain, shell } from "electron";
import {
	ensureMacRecordingPermissions,
	readMacPermissionSnapshot,
} from "../recording/macPermissions";
import { getMacPrivacySettingsUrl, openMacPrivacySettings } from "../utils";

export function registerPermissionHandlers() {
	ipcMain.handle("open-external-url", async (_, url: string) => {
		try {
			// Security: only allow http/https URLs to prevent file:// or custom protocol abuse
			const parsed = new URL(url);
			if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
				return { success: false, error: `Blocked non-HTTP URL: ${parsed.protocol}` };
			}
			await shell.openExternal(url);
			return { success: true };
		} catch (error) {
			console.error("Failed to open URL:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("get-accessibility-permission-status", () => {
		if (process.platform !== "darwin") {
			return { success: true, trusted: true, prompted: false };
		}

		const snapshot = readMacPermissionSnapshot();
		return {
			success: true,
			trusted: snapshot.accessibilityTrusted,
			prompted: false,
			settingsLabel: snapshot.settingsLabel,
			isPackaged: snapshot.isPackaged,
		};
	});

	ipcMain.handle("request-accessibility-permission", async () => {
		if (process.platform !== "darwin") {
			return { success: true, trusted: true, prompted: false };
		}

		const result = await ensureMacRecordingPermissions({
			requireMicrophone: false,
			requireCamera: false,
			requireAccessibility: true,
		});

		return {
			success: true,
			trusted: result.accessibilityTrusted,
			prompted: result.requested,
			settingsLabel: result.settingsLabel,
			isPackaged: result.isPackaged,
			message: result.message,
		};
	});

	ipcMain.handle("get-screen-recording-permission-status", () => {
		if (process.platform !== "darwin") {
			return { success: true, status: "granted" };
		}

		try {
			const snapshot = readMacPermissionSnapshot();
			return {
				success: true,
				status: snapshot.screen,
				settingsLabel: snapshot.settingsLabel,
				isPackaged: snapshot.isPackaged,
			};
		} catch (error) {
			console.error("Failed to get screen recording permission status:", error);
			return { success: false, status: "unknown", error: String(error) };
		}
	});

	/**
	 * Actively register + request screen/mic/accessibility so the app appears
	 * in System Settings. Opening Settings without this leaves an empty list.
	 */
	ipcMain.handle(
		"ensure-mac-recording-permissions",
		async (
			_,
			options?: {
				requireMicrophone?: boolean;
				requireCamera?: boolean;
				requireAccessibility?: boolean;
			},
		) => {
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

			try {
				return await ensureMacRecordingPermissions(options);
			} catch (error) {
				console.error("Failed to ensure mac recording permissions:", error);
				const snapshot = readMacPermissionSnapshot();
				return {
					success: false,
					screen: snapshot.screen,
					microphone: snapshot.microphone,
					camera: snapshot.camera,
					accessibilityTrusted: snapshot.accessibilityTrusted,
					requested: false,
					settingsLabel: snapshot.settingsLabel,
					isPackaged: snapshot.isPackaged,
					missing: ["screen"] as Array<
						"screen" | "microphone" | "camera" | "accessibility"
					>,
					error: String(error),
					message:
						"Could not request recording permissions. Open System Settings → Privacy & Security and enable Screen Recording, Microphone, and Accessibility for this app.",
				};
			}
		},
	);

	ipcMain.handle("get-mac-permission-snapshot", () => {
		if (process.platform !== "darwin") {
			return {
				success: true,
				screen: "granted",
				microphone: "granted",
				camera: "granted",
				accessibilityTrusted: true,
				settingsLabel: "Recordly",
				isPackaged: true,
			};
		}

		try {
			const snapshot = readMacPermissionSnapshot();
			return { success: true, ...snapshot };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("request-microphone-permission", async () => {
		if (process.platform !== "darwin") {
			return { success: true, granted: true, status: "granted" };
		}

		const result = await ensureMacRecordingPermissions({
			requireMicrophone: true,
			requireCamera: false,
			requireAccessibility: false,
		});

		return {
			success: true,
			granted: result.microphone === "granted",
			status: result.microphone,
			settingsLabel: result.settingsLabel,
			isPackaged: result.isPackaged,
			message: result.message,
		};
	});

	ipcMain.handle("open-screen-recording-preferences", async () => {
		if (process.platform !== "darwin") {
			return { success: true };
		}

		try {
			await openMacPrivacySettings("screen");
			return { success: true };
		} catch (error) {
			console.error("Failed to open Screen Recording preferences:", error);
			// Fallback to legacy URL helper
			try {
				await shell.openExternal(getMacPrivacySettingsUrl("screen"));
				return { success: true };
			} catch (fallbackError) {
				return { success: false, error: String(fallbackError ?? error) };
			}
		}
	});

	ipcMain.handle("open-microphone-preferences", async () => {
		if (process.platform !== "darwin") {
			return { success: true };
		}

		try {
			await openMacPrivacySettings("microphone");
			return { success: true };
		} catch (error) {
			console.error("Failed to open Microphone preferences:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("open-accessibility-preferences", async () => {
		if (process.platform !== "darwin") {
			return { success: true };
		}

		try {
			await openMacPrivacySettings("accessibility");
			return { success: true };
		} catch (error) {
			console.error("Failed to open Accessibility preferences:", error);
			try {
				await shell.openExternal(getMacPrivacySettingsUrl("accessibility"));
				return { success: true };
			} catch (fallbackError) {
				return { success: false, error: String(fallbackError ?? error) };
			}
		}
	});
}
