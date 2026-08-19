const catalogUrl = "https://foundryvtt.com/packages/dice-vfx";
const manifestUrl = "https://r2.foundryvtt.com/packages-public/dice-vfx/module.json";

const [catalog, manifest] = await Promise.all([
  fetch(catalogUrl, { signal: AbortSignal.timeout(15_000) }),
  fetch(manifestUrl, { signal: AbortSignal.timeout(15_000) }),
]);
const data = await manifest.json();
console.log(JSON.stringify({
  catalog: { url: catalogUrl, status: catalog.status },
  manifest: {
    url: manifestUrl,
    status: manifest.status,
    contentType: manifest.headers.get("content-type"),
    id: data.id,
    version: data.version,
    protected: data.protected,
    hasDownload: Object.hasOwn(data, "download"),
    download: data.download ?? null,
    manifest: data.manifest,
  },
}));
