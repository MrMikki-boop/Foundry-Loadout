import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../out/", import.meta.url)));
const basePath = "/Foundry-Loadout/";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const relative = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname.slice(1);
  const requested = resolve(root, relative || "index.html");
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end("Bad request");
    return;
  }
  const info = await stat(requested).catch(() => null);
  if (!info?.isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": contentTypes[extname(requested)] ?? "application/octet-stream" });
  createReadStream(requested).pipe(response);
}).listen(4174, "127.0.0.1", () => {
  console.log("GitHub Pages preview: http://127.0.0.1:4174/Foundry-Loadout/");
});
