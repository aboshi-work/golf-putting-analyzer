/**
 * Vercel の tRPC 関数（api/trpc/[...trpc].ts）を手元で単体起動し、関数が読み込み時に落ちないか確かめる（2026-09-25 の ERR_REQUIRE_ESM 調査用）。
 *   npx tsx scripts/check/vercel-local.ts  → http://localhost:3099
 */
import "dotenv/config";
import http from "node:http";
import handler from "../../api/trpc/[...trpc]";
http.createServer((req, res) => {
  handler(req, res).catch((e: unknown) => { console.error("HANDLER THREW", e); res.statusCode = 500; res.end("crash"); });
}).listen(3099, () => console.log("listening 3099"));
process.on("uncaughtException", (e) => console.error("UNCAUGHT", e));
process.on("unhandledRejection", (e) => console.error("UNHANDLED", e));
