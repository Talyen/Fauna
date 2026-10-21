import { expect, it } from "vitest";
import { clampBounds, minimumOuterSize } from "../../desktop/display.cjs";

it("reserves a 1280 by 720 renderer viewport plus the actual native window frame", () => {
  const minimum = minimumOuterSize({
    getBounds: () => ({ width: 1300, height: 780 }),
    getContentBounds: () => ({ width: 1280, height: 720 }),
  });
  expect(minimum).toEqual({ width: 1300, height: 780 });
  expect(
    clampBounds(
      { x: 100, y: 100, width: 900, height: 700 },
      [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }],
      minimum,
    ),
  ).toEqual({ x: 100, y: 100, width: 1300, height: 780 });
});
it("keeps unsupported small work areas reachable instead of forcing an oversized window", () => {
  expect(
    clampBounds({ x: 5000, y: 9000, width: 1440, height: 1000 }, [
      { workArea: { x: 0, y: 0, width: 1024, height: 600 } },
    ]),
  ).toEqual({ x: 0, y: 0, width: 1024, height: 600 });
});
