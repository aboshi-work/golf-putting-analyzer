/**
 * HTML を Microsoft Edge のヘッドレス（コマンドライン）で PNG に撮る。
 * Playwright の page.screenshot が Edge 158 で止まる（2026-11-26）ため、試し写真とお手本の生成はこちらを使う。
 * EDGE_BIN でブラウザの場所を変えられる（Chrome でも可）。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const EDGE = process.env.EDGE_BIN ?? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

export function edgeScreenshot(html: string, width: number, height: number, outPng: string): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "card-shot-"));
  const file = path.join(dir, "page.html");
  writeFileSync(file, html);
  execFileSync(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--user-data-dir=${path.join(dir, "profile")}`,
      `--window-size=${width},${height}`,
      "--virtual-time-budget=6000",
      `--screenshot=${outPng}`,
      `file://${file}`,
    ],
    { stdio: "ignore", timeout: 120000 },
  );
}
