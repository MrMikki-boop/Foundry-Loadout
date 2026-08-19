const tracks = [
  {
    module: "Russian Translation",
    major: 13,
    manifest: "https://github.com/phenomen/foundry-vtt-ru/releases/download/release-v13/module.json",
    catalog: "https://foundryvtt.com/packages/ru-ru",
    release: "https://github.com/phenomen/foundry-vtt-ru/releases/tag/release-v13",
  },
  {
    module: "Russian Translation",
    major: 14,
    manifest: "https://github.com/phenomen/foundry-vtt-ru/releases/download/release-v14/module.json",
    catalog: "https://foundryvtt.com/packages/ru-ru",
    release: "https://github.com/phenomen/foundry-vtt-ru/releases/tag/release-v14",
  },
  {
    module: "Dice Tray",
    major: 13,
    manifest: "https://github.com/mclemente/fvtt-dice-tray/releases/download/3.5.5/module.json",
    catalog: "https://foundryvtt.com/packages/dice-calculator",
    release: "https://github.com/mclemente/fvtt-dice-tray/releases/tag/3.5.5",
  },
  {
    module: "Dice Tray",
    major: 14,
    manifest: "https://github.com/mclemente/fvtt-dice-tray/releases/download/3.7.2/module.json",
    catalog: "https://foundryvtt.com/packages/dice-calculator",
    release: "https://github.com/mclemente/fvtt-dice-tray/releases/tag/3.7.2",
  },
  {
    module: "Dynamic Active Effects",
    major: 13,
    manifest: "https://gitlab.com/tposney/dae/-/releases/v13.0.29/downloads/module.json",
    catalog: "https://foundryvtt.com/packages/dae",
    release: "https://gitlab.com/tposney/dae/-/releases/v13.0.29",
  },
  {
    module: "Dynamic Active Effects",
    major: 14,
    manifest: "https://gitlab.com/tposney/dae/-/releases/v14.0.12/downloads/module.json",
    catalog: "https://foundryvtt.com/packages/dae",
    release: "https://gitlab.com/tposney/dae/-/releases/v14.0.12",
  },
];

async function get(url, json = false) {
  const started = performance.now();
  const response = await fetch(url, {
    headers: { "user-agent": "Foundry-Loadout-stage-3-spike" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  return {
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    bytes: Buffer.byteLength(body),
    elapsedMs: Math.round(performance.now() - started),
    data: json ? JSON.parse(body) : null,
  };
}

for (const track of tracks) {
  const [manifest, catalog, release] = await Promise.all([
    get(track.manifest, true),
    get(track.catalog),
    get(track.release),
  ]);
  const data = manifest.data;
  console.log(JSON.stringify({
    module: track.module,
    major: track.major,
    evidence: {
      manifest: { url: track.manifest, ...manifest, data: undefined },
      catalog: { url: track.catalog, status: catalog.status, elapsedMs: catalog.elapsedMs },
      release: { url: track.release, status: release.status, elapsedMs: release.elapsedMs },
    },
    fields: {
      id: data.id,
      title: data.title,
      version: data.version,
      compatibility: data.compatibility,
      manifest: data.manifest,
      download: data.download,
    },
  }));
}
