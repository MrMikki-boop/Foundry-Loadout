import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeUrl,
  assertPublicDns,
  buildValidationPlan,
  fetchManifest,
  isBlockedAddress,
  readLimited,
  validateTrack,
} from "../scripts/manifest-validator.mjs";

const manifestUrl = "https://github.com/example/module.json";
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function response({ status = 200, headers = {}, chunks = ["{}"] } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    body: (async function* body() {
      for (const chunk of chunks) yield Buffer.from(chunk);
    })(),
  };
}

function options(fetchFn, overrides = {}) {
  return {
    allowedInitialUrls: new Set([manifestUrl]),
    allowedRedirectHosts: new Set(["github.com"]),
    fetchFn,
    lookupFn: publicLookup,
    ...overrides,
  };
}

test("special-use IPv4 addresses rejected by the SSRF guard", () => {
  for (const address of ["10.0.0.1", "192.88.99.1", "240.0.0.1", "255.255.255.255"]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress("93.184.216.34"), false);
});

test("special-use IPv6 addresses rejected by the SSRF guard", () => {
  for (const address of ["::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002::1"]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
});

test("DNS answers resolving to private space are rejected", async () => {
  await assert.rejects(
    assertPublicDns("github.com", { lookupFn: async () => [{ address: "169.254.169.254", family: 4 }] }),
    /dns:private-or-reserved/,
  );
});

test("redirects cannot leave the hostname allowlist", async () => {
  await assert.rejects(
    fetchManifest(manifestUrl, options(async () => response({ status: 302, headers: { location: "https://evil.example/module.json" } }))),
    /redirect:host-not-allowed/,
  );
});

test("pinned raw GitHub manifests stay inside the exact host allowlist", () => {
  const pinned = "https://raw.githubusercontent.com/ironmonk108/monks-tokenbar/13.02/module.json";
  assert.doesNotThrow(() => assertSafeUrl(pinned));
  assert.throws(() => assertSafeUrl("https://raw.githubusercontent.example/module.json"), /redirect:host-not-allowed/);
});

test("redirect limit is enforced", async () => {
  let calls = 0;
  await assert.rejects(
    fetchManifest(manifestUrl, options(async () => {
      calls += 1;
      return response({ status: 302, headers: { location: `${manifestUrl}?hop=${calls}` } });
    }, { limits: { maxRedirects: 1 } })),
    /redirect:too-many/,
  );
  assert.equal(calls, 2);
});

test("unexpected Content-Type is rejected before JSON parsing", async () => {
  await assert.rejects(
    fetchManifest(manifestUrl, options(async () => response({ headers: { "content-type": "text/html" } }))),
    /content-type:text\/html/,
  );
});

test("declared and streamed response sizes are bounded", async (t) => {
  await t.test("declared size", async () => {
    await assert.rejects(
      readLimited(response({ headers: { "content-length": "5" }, chunks: ["{}"] }), { maxResponseBytes: 4 }),
      /size:limit/,
    );
  });
  await t.test("streamed size", async () => {
    await assert.rejects(
      readLimited(response({ chunks: ["123", "45"] }), { maxResponseBytes: 4 }),
      /size:limit/,
    );
  });
});

test("a stalled hop ends with the validator timeout code", async () => {
  const stalledFetch = async (_url, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(resolve, 1_000);
    signal.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(signal.reason);
    }, { once: true });
  });
  await assert.rejects(
    fetchManifest(manifestUrl, options(stalledFetch, { limits: { timeoutPerHopMs: 10 } })),
    /timeout:hop/,
  );
});

test("validateTrack returns the documented manifest snapshot", async () => {
  const entry = {
    id: "example",
  };
  const track = {
    foundryMajor: 14,
    moduleVersion: "1.2.3",
    installManifestUrl: manifestUrl,
    relationships: { systems: ["dnd5e"], required: ["lib-wrapper"], recommended: ["socketlib"] },
  };
  const data = {
    id: "example",
    title: "Example",
    version: "1.2.3",
    compatibility: { minimum: "13", verified: "14" },
    manifest: manifestUrl,
    download: "https://github.com/example/module.zip",
    relationships: {
      systems: [{ id: "dnd5e" }],
      requires: [{ id: "lib-wrapper" }],
      recommends: [{ id: "socketlib" }],
    },
  };
  const snapshot = await validateTrack(entry, track, options(async () => response({
    headers: { "content-type": "application/json" },
    chunks: [JSON.stringify(data)],
  })));

  assert.equal(snapshot.finalUrl, manifestUrl);
  assert.equal(snapshot.id, "example");
  assert.deepEqual(snapshot.systems, ["dnd5e"]);
  assert.deepEqual(snapshot.requiredDependencies, ["lib-wrapper"]);
  assert.deepEqual(snapshot.recommendedDependencies, ["socketlib"]);
});

test("one manifest may honestly serve V13 and V14", async () => {
  const entry = { id: "shared-example" };
  const manifest = {
    id: entry.id,
    title: "Shared Example",
    version: "2.0.0",
    compatibility: { minimum: "12", verified: "14.364" },
    manifest: manifestUrl,
    download: "https://github.com/example/module.zip",
    relationships: {},
  };
  const fetchFn = async () => response({
    headers: { "content-type": "application/json" },
    chunks: [JSON.stringify(manifest)],
  });

  for (const foundryMajor of [13, 14]) {
    const track = {
      foundryMajor,
      moduleVersion: manifest.version,
      installManifestUrl: manifestUrl,
      relationships: { systems: [], required: [], recommended: [] },
    };
    await assert.doesNotReject(validateTrack(entry, track, options(fetchFn)));
  }
});

test("raw verified is evidence, not an upper compatibility bound", async () => {
  const entry = { id: "forward-compatible" };
  const track = {
    foundryMajor: 14,
    moduleVersion: "1.0.0",
    installManifestUrl: manifestUrl,
    relationships: { systems: [], required: [], recommended: [] },
  };
  const manifest = {
    id: entry.id,
    title: "Forward Compatible",
    version: track.moduleVersion,
    compatibility: { minimum: "13", verified: "13" },
    manifest: manifestUrl,
    download: "https://github.com/example/module.zip",
  };
  await assert.doesNotReject(validateTrack(entry, track, options(async () => response({
    headers: { "content-type": "application/json" },
    chunks: [JSON.stringify(manifest)],
  }))));
});

test("minimum and maximum exclude incompatible major versions", async (t) => {
  const entry = { id: "bounded-example" };
  const baseTrack = {
    moduleVersion: "1.0.0",
    installManifestUrl: manifestUrl,
    relationships: { systems: [], required: [], recommended: [] },
  };
  const baseManifest = {
    id: entry.id,
    title: "Bounded Example",
    version: baseTrack.moduleVersion,
    manifest: manifestUrl,
    download: "https://github.com/example/module.zip",
  };
  const validate = (foundryMajor, compatibility) => validateTrack(
    entry,
    { ...baseTrack, foundryMajor },
    options(async () => response({
      headers: { "content-type": "application/json" },
      chunks: [JSON.stringify({ ...baseManifest, compatibility })],
    })),
  );

  await t.test("minimum", async () => {
    await assert.rejects(validate(13, { minimum: "14", verified: "14" }), /schema:compatibility\.minimum/);
  });
  await t.test("maximum", async () => {
    await assert.rejects(validate(14, { minimum: "12", maximum: "13", verified: "13" }), /schema:compatibility\.maximum/);
  });
});

test("protected metadata never enters the install allowlist", () => {
  const installUrl = "https://github.com/example/releases/download/1.0.0/module.json";
  const metadataUrl = "https://r2.foundryvtt.com/packages-public/premium-example/module-1.0.0.json";
  const catalog = [
    {
      id: "example",
      tracks: [{
        foundryMajor: 14,
        verificationStatus: "verified",
        installManifestUrl: installUrl,
        declaredManifestUrl: "https://github.com/example/releases/latest/download/module.json",
        sources: {
          catalogUrl: "https://foundryvtt.com/packages/example",
          releaseUrl: "https://github.com/example/releases/tag/1.0.0",
          manifestUrl: installUrl,
          metadataManifestUrl: null,
        },
      }],
    },
    {
      id: "premium-example",
      tracks: [{
        foundryMajor: 14,
        verificationStatus: "personal-premium-link",
        installManifestUrl: null,
        declaredManifestUrl: null,
        sources: {
          catalogUrl: "https://foundryvtt.com/packages/premium-example",
          releaseUrl: null,
          manifestUrl: null,
          metadataManifestUrl: metadataUrl,
        },
      }],
    },
  ];

  const plan = buildValidationPlan(catalog);
  assert.equal(plan.tracks.length, 1);
  assert.deepEqual([...plan.allowedInitialUrls], [installUrl]);
  assert.equal(plan.allowedInitialUrls.has(metadataUrl), false);

  catalog[1].tracks[0].installManifestUrl = metadataUrl;
  assert.throws(() => buildValidationPlan(catalog), /schema:nonverified-public-url/);
});
