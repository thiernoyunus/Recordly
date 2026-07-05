import { describe, expect, it } from "vitest";
import { getSquirclePathPoints } from "./squircle";

describe("getSquirclePathPoints", () => {
	it("with exponent 2 on a square, every point lies on the inscribed circle", () => {
		const size = 100;
		const r = size / 2;
		const points = getSquirclePathPoints({
			x: 0,
			y: 0,
			width: size,
			height: size,
			radius: r,
			exponent: 2,
		});

		expect(points.length).toBeGreaterThan(8);
		for (const p of points) {
			const dist = Math.hypot(p.x - r, p.y - r);
			expect(dist).toBeCloseTo(r, 1); // on the circle of radius r
		}
	});

	it("default squircle corners bow outside the inscribed circle", () => {
		const size = 100;
		const r = size / 2;
		const points = getSquirclePathPoints({ x: 0, y: 0, width: size, height: size, radius: r });
		// A squircle (exponent 4.5) is fuller than a circle: at least one point sits
		// measurably farther from center than the circle radius.
		const maxDist = Math.max(...points.map((p) => Math.hypot(p.x - r, p.y - r)));
		expect(maxDist).toBeGreaterThan(r + 1);
	});
});
