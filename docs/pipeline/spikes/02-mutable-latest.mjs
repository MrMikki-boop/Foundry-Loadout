const urls = [
  ["latest", "https://github.com/mclemente/fvtt-dice-tray/releases/latest/download/module.json"],
  ["pinned-v13", "https://github.com/mclemente/fvtt-dice-tray/releases/download/3.5.5/module.json"],
  ["pinned-v14", "https://github.com/mclemente/fvtt-dice-tray/releases/download/3.7.2/module.json"],
];

for (const [kind, url] of urls) {
  const started = performance.now();
  const response = await fetch(url, {
    headers: { "user-agent": "Foundry-Loadout-stage-3-spike" },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  console.log(JSON.stringify({
    kind,
    requestedUrl: url,
    status: response.status,
    finalUrl: response.url,
    elapsedMs: Math.round(performance.now() - started),
    version: data.version,
    compatibility: data.compatibility,
    manifest: data.manifest,
    download: data.download,
  }));
}
