import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the Foundry V13/V14 catalog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Модули для вашей версии Foundry VTT/);
  assert.match(html, /Foundry VTT (?:<!-- -->)?14/);
  assert.match(html, /Russian Translation/);
  assert.match(html, /Dice Tray/);
  assert.match(html, /Dynamic Active Effects/);
  assert.match(html, /Manifest URL/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/i);
});

test("page includes the installation guide and unofficial disclaimer", async () => {
  const html = await (await render()).text();
  assert.match(html, /Куда вставить ссылку/);
  assert.match(html, /не связан с Foundry Gaming LLC/);
  assert.match(html, /role="status"/);
});

test("page exposes labelled search and catalog filters", async () => {
  const html = await (await render()).text();
  assert.match(html, /<label for="catalog-search">Поиск по каталогу<\/label>/);
  assert.match(html, /<label for="category-filter">Категория<\/label>/);
  assert.match(html, /<label for="license-filter">Доступ<\/label>/);
  assert.match(html, /<label for="system-filter">Игровая система<\/label>/);
  assert.match(html, /Только проверенные/);
  assert.doesNotMatch(html, /JB2A Patreon Collection/);
});

test("verified cards render complete metadata and one copy action per manifest", async () => {
  const html = await (await render()).text();
  assert.match(html, /Бесплатный/);
  assert.match(html, /Совместимость Foundry VTT из manifest/);
  assert.match(html, /minimum<\/span><strong>0\.6\.5<\/strong>/);
  assert.match(html, /verified<\/span><strong>14<\/strong>/);
  assert.match(html, /maximum<\/span><strong>не указано<\/strong>/);
  assert.match(html, /Обязательные: lib-wrapper, socketlib/);
  assert.match(html, /Рекомендуемые: (?:<!-- -->)?lib-wrapper, babele/);
  assert.match(html, /Foundry VTT предложит добавить их вместе с модулем/);
  assert.match(html, />MIT(?:<!-- -->)? <span aria-hidden="true">↗<\/span><\/a>/);
  assert.match(html, />LGPL-3\.0(?:<!-- -->)? <span aria-hidden="true">↗<\/span><\/a>/);
  assert.match(html, /Не указана автором/);
  assert.equal((html.match(/>Скопировать manifest<\/button>/g) ?? []).length, 4);
  assert.equal((html.match(/class="manifest-url"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Публичная ссылка недоступна/);
});
