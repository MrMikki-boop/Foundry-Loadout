import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? filesUnder(url) : [url];
  }))).flat();
}

test("build emits a self-contained static Pages artifact", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");
  assert.match(html, /\.\/assets\/[^"']+\.js/);
  assert.match(html, /\.\/assets\/[^"']+\.css/);
  assert.doesNotMatch(html, /_next|vinext|cloudflare/i);
  await stat(new URL("favicon.svg", outputRoot));
});

test("static artifact stays deliberately small", async () => {
  const files = await filesUnder(outputRoot);
  const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
  assert.ok(sizes.reduce((sum, size) => sum + size, 0) < 300_000);
});
