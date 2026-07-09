#!/usr/bin/env node
/**
 * Keep Vite's prebundle cache (node_modules/.vite) healthy.
 *
 * Why this exists:
 * Electron + Vite often leave a half-updated optimize-deps cache after branch
 * switches, interrupted dev servers, or concurrent Vite processes. The renderer
 * then requests chunks like `chunk-XXXX.js?v=oldhash` that no longer exist and
 * the UI fails to load. This script detects a broken cache and deletes it so the
 * next `vite` start rebuilds cleanly.
 *
 * Usage:
 *   node scripts/ensure-vite-cache.mjs           # validate; clear if broken
 *   node scripts/ensure-vite-cache.mjs --force   # always clear
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const viteCacheDir = path.join(root, "node_modules", ".vite");
const depsDir = path.join(viteCacheDir, "deps");
const metadataPath = path.join(depsDir, "_metadata.json");
const stampPath = path.join(viteCacheDir, "recordly-cache-stamp.json");
const force = process.argv.includes("--force");

function log(message) {
	console.log(`[ensure-vite-cache] ${message}`);
}

function readText(filePath) {
	try {
		return readFileSync(filePath, "utf8");
	} catch {
		return null;
	}
}

function hashFile(filePath) {
	const contents = readText(filePath);
	if (contents == null) {
		return null;
	}
	return createHash("sha1").update(contents).digest("hex").slice(0, 16);
}

function clearViteCache(reason) {
	if (!existsSync(viteCacheDir)) {
		log(`No cache to clear (${reason}).`);
		return;
	}
	rmSync(viteCacheDir, { recursive: true, force: true });
	log(`Cleared node_modules/.vite (${reason}). Vite will rebuild on next start.`);
}

function collectReferencedFiles(metadata) {
	const files = new Set();

	// optimized map: { "react": { file: "react.js", ... }, ... }
	const optimized = metadata?.optimized;
	if (optimized && typeof optimized === "object") {
		for (const entry of Object.values(optimized)) {
			if (entry && typeof entry === "object" && typeof entry.file === "string") {
				files.add(entry.file);
			}
			if (entry && typeof entry === "object" && Array.isArray(entry.imports)) {
				for (const imp of entry.imports) {
					if (typeof imp === "string") {
						files.add(imp);
					}
				}
			}
			if (entry && typeof entry === "object" && Array.isArray(entry.chunks)) {
				for (const chunk of entry.chunks) {
					if (typeof chunk === "string") {
						files.add(chunk);
					}
				}
			}
		}
	}

	// chunks map (vite 5): { "chunk-ABC.js": { file: "chunk-ABC.js", ... } }
	const chunks = metadata?.chunks;
	if (chunks && typeof chunks === "object") {
		for (const [key, entry] of Object.entries(chunks)) {
			if (typeof key === "string" && key.endsWith(".js")) {
				files.add(key);
			}
			if (entry && typeof entry === "object" && typeof entry.file === "string") {
				files.add(entry.file);
			}
		}
	}

	// depInfo / browserHash only — no file paths
	return [...files];
}

function validateDepsCache() {
	if (!existsSync(metadataPath)) {
		// Fresh install / first run — nothing to validate.
		return { ok: true, reason: "no-metadata" };
	}

	let metadata;
	try {
		metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
	} catch (error) {
		return { ok: false, reason: `invalid-metadata: ${String(error)}` };
	}

	const referenced = collectReferencedFiles(metadata);
	const missing = [];
	for (const relative of referenced) {
		const absolute = path.join(depsDir, relative);
		if (!existsSync(absolute)) {
			missing.push(relative);
		}
	}

	if (missing.length > 0) {
		const preview = missing.slice(0, 5).join(", ");
		const more = missing.length > 5 ? ` (+${missing.length - 5} more)` : "";
		return {
			ok: false,
			reason: `missing-deps: ${preview}${more}`,
		};
	}

	return { ok: true, reason: "healthy" };
}

function lockfileChanged() {
	const lockHash =
		hashFile(path.join(root, "package-lock.json")) ??
		hashFile(path.join(root, "pnpm-lock.yaml")) ??
		hashFile(path.join(root, "yarn.lock"));
	const pkgHash = hashFile(path.join(root, "package.json"));
	const stampRaw = readText(stampPath);
	let previous = null;
	if (stampRaw) {
		try {
			previous = JSON.parse(stampRaw);
		} catch {
			previous = null;
		}
	}

	const next = {
		packageJson: pkgHash,
		lockfile: lockHash,
		updatedAt: new Date().toISOString(),
	};

	if (
		previous &&
		previous.packageJson === next.packageJson &&
		previous.lockfile === next.lockfile
	) {
		return { changed: false, next };
	}

	return { changed: Boolean(previous), next, previous };
}

function writeStamp(stamp) {
	try {
		// Ensure parent exists (after clear it may not)
		const dir = path.dirname(stampPath);
		if (!existsSync(dir)) {
			// stamp is under .vite which may have been deleted — recreate lightly
			writeFileSync(
				path.join(root, "node_modules", ".vite-recordly-stamp.json"),
				JSON.stringify(stamp, null, 2),
			);
			return;
		}
		writeFileSync(stampPath, JSON.stringify(stamp, null, 2));
	} catch {
		// Non-fatal: validation still ran.
	}
}

// Prefer a stamp outside .vite so force-clears still remember lockfile hashes.
const durableStampPath = path.join(root, "node_modules", ".vite-recordly-stamp.json");

function readDurableStamp() {
	const raw = readText(durableStampPath) ?? readText(stampPath);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function writeDurableStamp(stamp) {
	try {
		writeFileSync(durableStampPath, JSON.stringify(stamp, null, 2));
	} catch {
		// ignore
	}
}

function main() {
	if (force) {
		clearViteCache("forced");
		const lock = lockfileChanged();
		writeDurableStamp(lock.next);
		return;
	}

	const previous = readDurableStamp();
	const lockHash =
		hashFile(path.join(root, "package-lock.json")) ??
		hashFile(path.join(root, "pnpm-lock.yaml")) ??
		hashFile(path.join(root, "yarn.lock"));
	const pkgHash = hashFile(path.join(root, "package.json"));
	const nextStamp = {
		packageJson: pkgHash,
		lockfile: lockHash,
		updatedAt: new Date().toISOString(),
	};

	if (
		previous &&
		(previous.packageJson !== nextStamp.packageJson || previous.lockfile !== nextStamp.lockfile)
	) {
		clearViteCache("package.json or lockfile changed");
		writeDurableStamp(nextStamp);
		return;
	}

	const validation = validateDepsCache();
	if (!validation.ok) {
		clearViteCache(validation.reason);
		writeDurableStamp(nextStamp);
		return;
	}

	writeDurableStamp(nextStamp);
	if (validation.reason === "no-metadata") {
		log("No Vite dep cache yet — Vite will create one on start.");
	} else {
		log("Vite dep cache looks healthy.");
	}
}

main();
