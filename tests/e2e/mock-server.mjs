// Minimal static mock-Gmail server for Playwright E2E. Serves the synthetic
// SPA page and a health endpoint on 127.0.0.1:4173. No real Gmail, no real
// data — only reserved test domains (spec §59.1).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.MOCK_GMAIL_PORT ?? 4173);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === "/" || url.pathname === "/mock-gmail.html") {
    const html = await readFile(join(root, "mock-gmail.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock-gmail listening on http://127.0.0.1:${port}`);
});
