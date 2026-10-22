// Fungsi Vercel untuk leaderboard (PRD-7). GET ?mode=: 50 teratas. POST: kirim skor (diputar ulang).
// Penyimpanan: Upstash Redis lewat REST API, dibuat dari dashboard Vercel (Storage). Variabel lingkungan
// diisi otomatis oleh integrasi: KV_REST_API_URL dan KV_REST_API_TOKEN (atau UPSTASH_REDIS_REST_*).
// Tanpa variabel itu, leaderboard melapor `enabled: false` dan game tetap berjalan seperti biasa.
import { BOARD_MODES, submit, top, type BoardMode, type Store } from "../src/server/leaderboard.ts";

const URL_ = process.env["KV_REST_API_URL"] ?? process.env["UPSTASH_REDIS_REST_URL"];
const TOKEN = process.env["KV_REST_API_TOKEN"] ?? process.env["UPSTASH_REDIS_REST_TOKEN"];

const store: Store | null =
  URL_ && TOKEN
    ? async (cmd) => {
        const res = await fetch(URL_, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(cmd),
        });
        const j = (await res.json()) as { result?: unknown; error?: string };
        if (j.error) throw new Error(j.error);
        return j.result;
      }
    : null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "GET") {
        const mode = url.searchParams.get("mode") as BoardMode;
        if (!BOARD_MODES.includes(mode)) return json({ error: "bad_request" }, 400);
        if (!store) return json({ enabled: false, entries: [] });
        return json({ enabled: true, entries: await top(store, mode) });
      }
      if (request.method === "POST") {
        if (!store) return json({ error: "disabled" }, 503);
        const text = await request.text();
        if (text.length > 600_000) return json({ error: "bad_request" }, 413);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          return json({ error: "bad_request" }, 400);
        }
        const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
        const r = await submit(store, body, ip, new Date());
        return r.ok ? json(r) : json({ error: r.error }, r.status);
      }
      return json({ error: "method" }, 405);
    } catch {
      return json({ error: "server" }, 500);
    }
  },
};
