import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import catalog from "../data/modules.json" with { type: "json" };

const LIMITS = { timeoutPerHopMs: 8_000, maxRedirects: 3, maxResponseBytes: 262_144 };
const acceptedTypes = new Set(["application/json", "text/json", "text/plain", "application/octet-stream"]);
const redirectHosts = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "gitlab.com",
  "release-assets.gitlab-static.net",
  "storage.googleapis.com",
]);
const allTracks = catalog.flatMap((entry) => entry.tracks.map((track) => ({ entry, track })));
const tracks = allTracks.filter(({ track }) => track.verificationStatus === "verified");
const initialUrls = new Set(tracks.map(({ track }) => track.installManifestUrl).filter(Boolean));

for (const { entry, track } of allTracks) {
  if (track.verificationStatus !== "verified" && track.installManifestUrl !== null) {
    throw new Error(`schema:nonverified-public-url (${entry.id} V${track.foundryMajor})`);
  }
}

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4],
]) blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32],
]) blocked.addSubnet(network, prefix, "ipv6");

function fail(code, detail = "") {
  throw new Error(detail ? `${code} (${detail})` : code);
}

function assertSafeUrl(url) {
  if (url.protocol !== "https:") fail("scheme:not-https");
  if (url.username || url.password) fail("url:credentials");
  if (!redirectHosts.has(url.hostname)) fail("redirect:host-not-allowed", url.hostname);
}

async function assertPublicDns(hostname) {
  if (isIP(hostname)) {
    const family = isIP(hostname) === 4 ? "ipv4" : "ipv6";
    if (blocked.check(hostname, family)) fail("dns:private-or-reserved", hostname);
    return;
  }
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length) fail("dns:no-address", hostname);
  for (const answer of answers) {
    const family = answer.family === 4 ? "ipv4" : "ipv6";
    if (blocked.check(answer.address, family)) fail("dns:private-or-reserved", answer.address);
  }
}

async function readLimited(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LIMITS.maxResponseBytes) fail("size:limit");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > LIMITS.maxResponseBytes) fail("size:limit");
    chunks.push(chunk);
  }
  return { bytes, text: Buffer.concat(chunks).toString("utf8") };
}

async function fetchManifest(input) {
  if (!initialUrls.has(input)) fail("allowlist:initial-url");
  let current = new URL(input);
  for (let redirects = 0; redirects <= LIMITS.maxRedirects; redirects += 1) {
    assertSafeUrl(current);
    await assertPublicDns(current.hostname);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "Foundry-Loadout-manifest-validator/0.1" },
      signal: AbortSignal.timeout(LIMITS.timeoutPerHopMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) fail("redirect:no-location");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) fail(`http:${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!acceptedTypes.has(contentType)) fail("content-type", contentType || "missing");
    const body = await readLimited(response);
    let data;
    try { data = JSON.parse(body.text); } catch { fail("json:invalid"); }
    return { data, bytes: body.bytes, finalUrl: current.href, contentType };
  }
  fail("redirect:too-many");
}

function majorOf(value) {
  const match = String(value ?? "").match(/^\d+/);
  return match ? Number(match[0]) : null;
}

function publicUrl(value) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.href;
}

function validateSchema(entry, track, snapshot) {
  const data = snapshot.data;
  if (data.id !== entry.id) fail("schema:id", `${data.id} != ${entry.id}`);
  if (typeof data.title !== "string" || !data.title.trim()) fail("schema:title");
  if (data.version !== track.moduleVersion) fail("schema:version", `${data.version} != ${track.moduleVersion}`);
  if (typeof data.manifest !== "string" || !data.manifest.startsWith("https://")) fail("schema:manifest");
  if (typeof data.download !== "string" || !data.download.startsWith("https://")) fail("schema:download");

  const compatibility = data.compatibility ?? {};
  const minimum = majorOf(compatibility.minimum);
  const maximum = majorOf(compatibility.maximum);
  const verified = majorOf(compatibility.verified);
  if (minimum === null || minimum > track.foundryMajor) fail("schema:compatibility.minimum");
  if (maximum !== null && maximum < track.foundryMajor) fail("schema:compatibility.maximum");
  if (verified !== track.foundryMajor) fail("schema:compatibility.verified");

  const relationshipIds = (kind) => (data.relationships?.[kind] ?? []).map((item) => item.id).filter(Boolean).sort();
  const assertRelationships = (kind, expected) => {
    const actual = relationshipIds(kind);
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((id, index) => id !== wanted[index])) {
      fail(`schema:relationships.${kind}`, `expected ${wanted.join(",") || "none"}; got ${actual.join(",") || "none"}`);
    }
  };
  assertRelationships("requires", entry.dependencies.required);
  assertRelationships("recommends", entry.dependencies.recommended);
}

let failures = 0;
for (const { entry, track } of tracks) {
  const label = `${entry.id} V${track.foundryMajor} ${track.moduleVersion}`;
  try {
    if (!track.installManifestUrl) fail("schema:installManifestUrl");
    const snapshot = await fetchManifest(track.installManifestUrl);
    validateSchema(entry, track, snapshot);
    console.log(`OK   ${label} | ${snapshot.bytes} B | ${publicUrl(snapshot.finalUrl)}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label} | ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures) {
  console.error(`\nПроверка не пройдена: ${failures} из ${tracks.length} manifest.`);
  process.exitCode = 1;
} else {
  console.log(`\nПроверено manifest: ${tracks.length}. Ошибок нет.`);
}
