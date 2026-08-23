import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("source exposes the compact accessible catalog controls", () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<label for="catalog-search">Поиск по каталогу<\/label>/);
  assert.match(html, /<fieldset class="version-picker">/);
  assert.match(html, /<details class="filter-panel">/);
  assert.match(html, /id="result-count" aria-live="polite"/);
  assert.match(html, /id="install"/);
});

test("client keeps details progressive and provides a manual copy fallback", () => {
  assert.match(client, /<details class="module-details">/);
  assert.match(client, /Копировать manifest/);
  assert.match(client, /Скопируйте ссылку вручную/);
  assert.match(client, /input\.select\(\)/);
  assert.match(client, /CATEGORY_GROUPS/);
  assert.match(client, /visibleLimit = 12/);
  assert.match(client, /data-more/);
});

test("source has no server-framework remnants", () => {
  assert.doesNotMatch(html + client, /_next|vinext|cloudflare|react|tailwind/i);
});
