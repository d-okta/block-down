// Alat uji (bukan bagian aplikasi): sajikan dist/ dan jalankan api/leaderboard.ts dengan Redis tiruan di
// memori, untuk menguji leaderboard di browser tanpa Upstash. Jalankan setelah npm run build:
//   node tests/tools/dev-server.ts [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 4174);
const kv = new Map<string, string>();
const z = new Map<string, Map<string, number>>();
const h = new Map<string, Map<string, string>>();
const zs = (k: string) => z.get(k) ?? (z.set(k, new Map()), z.get(k)!);
const sorted = (k: string, rev: boolean) => [...zs(k)].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1]) || a[0].localeCompare(b[0]));
function redis(cmd: string[]): unknown {
  const [c, ...a] = cmd.map(String);
  switch (c!.toUpperCase()) {
    case "INCR": { const v = Number(kv.get(a[0]!) ?? 0) + 1; kv.set(a[0]!, String(v)); return v; }
    case "EXPIRE": return 1;
    case "SET": if (a[2] === "NX" && kv.has(a[0]!)) return null; kv.set(a[0]!, a[1]!); return "OK";
    case "GET": return kv.get(a[0]!) ?? null;
    case "ZADD": { const [key, flag, , score, member] = a; const s = Number(score); const cur = zs(key!).get(member!); if (cur === undefined || (flag === "GT" ? s > cur : s < cur)) { zs(key!).set(member!, s); return 1; } return 0; }
    case "ZSCORE": return zs(a[0]!).has(a[1]!) ? String(zs(a[0]!).get(a[1]!)) : null;
    case "ZRANK": case "ZREVRANK": return sorted(a[0]!, c === "ZREVRANK").findIndex(([m]) => m === a[1]);
    case "ZRANGE": return sorted(a[0]!, a.includes("REV")).slice(Number(a[1]), Number(a[2]) + 1).flatMap(([m, s]) => [m, String(s)]);
    case "HSET": { const m = h.get(a[0]!) ?? (h.set(a[0]!, new Map()), h.get(a[0]!)!); m.set(a[1]!, a[2]!); return 1; }
    case "HMGET": return a.slice(1).map((f) => h.get(a[0]!)?.get(f) ?? null);
  }
  return null;
}
// Fungsi asli membaca KV_REST_API_URL saat dimuat: arahkan ke Redis tiruan di server ini.
process.env["KV_REST_API_URL"] = `http://localhost:${port}/__redis`;
process.env["KV_REST_API_TOKEN"] = "uji";
const api = (await import("../../api/leaderboard.ts")).default;

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".webmanifest": "application/manifest+json", ".map": "application/json" };
createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  if (url.pathname === "/__redis") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ result: redis(JSON.parse(body.toString())) }));
    return;
  }
  if (url.pathname === "/api/leaderboard") {
    const init: RequestInit = { method: req.method ?? "GET", headers: { "x-forwarded-for": "127.0.0.1", "content-type": "application/json" } };
    if (req.method === "POST") init.body = body;
    const r = await api.fetch(new Request(url, init));
    res.statusCode = r.status;
    res.setHeader("Content-Type", "application/json");
    res.end(await r.text());
    return;
  }
  const path = normalize(join("dist", url.pathname === "/" ? "index.html" : url.pathname));
  try {
    const data = await readFile(path);
    res.setHeader("Content-Type", TYPES[extname(path)] ?? "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end();
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
