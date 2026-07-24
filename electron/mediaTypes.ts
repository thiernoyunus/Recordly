import path from "node:path";

export const MEDIA_CONTENT_TYPES: Record<string, string> = {
	".mp4": "video/mp4",
	".webm": "video/webm",
	".mov": "video/quicktime",
	".mkv": "video/x-matroska",
	".avi": "video/x-msvideo",
	".wav": "audio/wav",
	// The mac recorder writes its mic/system sidecars as .m4a. Leaving it out
	// made the media server refuse to serve them, so preview had no audio at
	// all while export — which reads the files straight off disk — was fine.
	".m4a": "audio/mp4",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
};

export function getMediaContentType(filePath: string): string {
	return MEDIA_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function isSupportedLocalMediaPath(filePath: string): boolean {
	return path.extname(filePath).toLowerCase() in MEDIA_CONTENT_TYPES;
}
