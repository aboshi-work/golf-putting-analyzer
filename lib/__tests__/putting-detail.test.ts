import { describe, expect, it } from "vitest";
import { buildHole, holeToEntry } from "../putting";

describe("詳しい記録（外れた方向・タッチ・メンタル・乗せたショットの距離）", () => {
  const entry = {
    holeNumber: 3,
    puttFor: "birdie" as const,
    totalPutts: 2,
    approachYards: 135,
    putts: [
      { meters: 8, lineUD: "up_down" as const, lineLR: "left_right" as const, missLength: "short" as const, missedDirection: 2 as const, touch: 2 as const, mental: 4 as const },
      { meters: 1.2, lineUD: "flat" as const, lineLR: "straight" as const, missedDirection: 5 as const, touch: 3 as const, mental: 1 as const },
    ],
  };

  it("保存用の HoleData に入り、乗せたショットの距離は 1st の distPrev に入る", () => {
    const hole = buildHole(entry);
    expect(hole.putts[0]).toMatchObject({ distPrev: 135, missedDirection: 2, touch: 2, mental: 4, lineUD: "up_down", lineLR: "left_right" });
    // 2打目はカップイン → 外れた方向は消す（タッチ・メンタルは残す）
    expect(hole.putts[1]).toMatchObject({ distPrev: null, missedDirection: null, touch: 3, mental: 1, cupIn: true });
  });

  it("入力フォームの形に戻しても失われない", () => {
    const back = holeToEntry(buildHole(entry));
    expect(back.approachYards).toBe(135);
    expect(back.putts[0]).toMatchObject({ missedDirection: 2, touch: 2, mental: 4 });
    expect(back.putts[1]).toMatchObject({ missedDirection: null, touch: 3, mental: 1 });
  });
});
