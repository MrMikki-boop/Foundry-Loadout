import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const output = new URL("../out/", import.meta.url);

test("Pages export has entry documents and bypasses Jekyll", async () => {
  await Promise.all([
    access(new URL("index.html", output)),
    access(new URL("404.html", output)),
    access(new URL(".nojekyll", output)),
  ]);
});

test("Pages HTML uses the repository base path and existing assets", async () => {
  const html = await readFile(new URL("index.html", output), "utf8");
  assert.match(html, /\/Foundry-Loadout\/_next\/static\/css\//);
  assert.match(html, /\/Foundry-Loadout\/_next\/static\/chunks\//);
  assert.match(html, /\/Foundry-Loadout\/favicon\.svg/);
  assert.doesNotMatch(html, /(?:href|src)="\/_next\//);
  assert.doesNotMatch(html, /(?:href|src)="\/favicon\.svg"/);
});
