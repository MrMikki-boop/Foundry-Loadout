import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const clientRoot = new URL("../dist/client/", import.meta.url);
const outputRoot = new URL("../out/", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);

function normalizeBasePath(value) {
  const clean = `/${value ?? "Foundry-Loadout"}/`.replaceAll(/\/{2,}/g, "/");
  return clean === "//" ? "/" : clean;
}

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "Foundry-Loadout";
const basePath = normalizeBasePath(process.env.PAGES_BASE_PATH ?? repositoryName);

workerUrl.searchParams.set("export", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request("https://pages-export.invalid/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) throw new Error(`pages-export:http:${response.status}`);

const html = (await response.text())
  .replaceAll('="/_next/', `="${basePath}_next/`)
  .replaceAll('="/favicon.svg"', `="${basePath}favicon.svg"`)
  .replaceAll('\\"/_next/', `\\"${basePath}_next/`)
  .replaceAll('\\"/favicon.svg\\"', `\\"${basePath}favicon.svg\\"`);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(clientRoot, outputRoot, { recursive: true });
await writeFile(new URL("index.html", outputRoot), html, "utf8");
await writeFile(new URL("404.html", outputRoot), html, "utf8");
await writeFile(new URL(".nojekyll", outputRoot), "", "utf8");

const localAssetPattern = /(?:href|src)="([^"]+)"/g;
for (const [, assetUrl] of html.matchAll(localAssetPattern)) {
  if (!assetUrl.startsWith(basePath)) continue;
  const relativePath = assetUrl.slice(basePath.length).split(/[?#]/, 1)[0];
  if (!relativePath) continue;
  const asset = new URL(relativePath, outputRoot);
  const info = await stat(asset).catch(() => null);
  if (!info?.isFile()) throw new Error(`pages-export:missing-asset:${relativePath}`);
}

const packageJson = JSON.parse(await readFile(new URL("package.json", projectRoot), "utf8"));
console.log(`GitHub Pages artifact: out/ | base ${basePath} | ${packageJson.name}@${packageJson.version}`);
