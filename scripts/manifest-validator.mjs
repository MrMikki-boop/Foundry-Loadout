import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export const LIMITS = Object.freeze({ timeoutPerHopMs: 8_000, maxRedirects: 3, maxResponseBytes: 262_144 });
export const ACCEPTED_CONTENT_TYPES = new Set(["application/json", "text/json", "text/plain", "application/octet-stream"]);
export const REDIRECT_HOSTS = new Set([
  "github.com", "raw.githubusercontent.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com",
  "gitlab.com", "release-assets.gitlab-static.net", "storage.googleapis.com",
]);

const IPV4_SPECIAL_USE = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.31.196.0", 24], ["192.52.193.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["192.175.48.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const IPV6_SPECIAL_USE = [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48],
  ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
  ["5f00::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
];

export function createBlockedNetworkList() {
  const ipv4 = new BlockList();
  const ipv6 = new BlockList();
  for (const [network, prefix] of IPV4_SPECIAL_USE) ipv4.addSubnet(network, prefix, "ipv4");
  for (const [network, prefix] of IPV6_SPECIAL_USE) ipv6.addSubnet(network, prefix, "ipv6");
  return { ipv4, ipv6 };
}

const blocked = createBlockedNetworkList();

export function fail(code, detail = "") {
  throw new Error(detail ? `${code} (${detail})` : code);
}

export function isBlockedAddress(address, blockLists = blocked) {
  const version = isIP(address);
  if (!version) fail("dns:invalid-address", address);
  const family = version === 4 ? "ipv4" : "ipv6";
  return blockLists[family].check(address, family);
}

export function assertSafeUrl(input, allowedHosts = REDIRECT_HOSTS) {
  const url = input instanceof URL ? input : new URL(input);
  if (url.protocol !== "https:") fail("scheme:not-https");
  if (url.username || url.password) fail("url:credentials");
  if (!allowedHosts.has(url.hostname)) fail("redirect:host-not-allowed", url.hostname);
  return url;
}

export async function assertPublicDns(hostname, { lookupFn = lookup, blockLists = blocked } = {}) {
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname, blockLists)) fail("dns:private-or-reserved", hostname);
    return;
  }
  const answers = await lookupFn(hostname, { all: true, verbatim: true });
  if (!answers.length) fail("dns:no-address", hostname);
  for (const answer of answers) {
    if (isBlockedAddress(answer.address, blockLists)) fail("dns:private-or-reserved", answer.address);
  }
}

export async function readLimited(response, limits = LIMITS) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limits.maxResponseBytes) fail("size:limit");
  if (!response.body) fail("http:empty-body");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > limits.maxResponseBytes) fail("size:limit");
    chunks.push(buffer);
  }
  return { bytes, text: Buffer.concat(chunks).toString("utf8") };
}

export async function fetchManifest(input, options = {}) {
  const limits = { ...LIMITS, ...options.limits };
  const allowedInitialUrls = options.allowedInitialUrls ?? new Set();
  const allowedRedirectHosts = options.allowedRedirectHosts ?? REDIRECT_HOSTS;
  const fetchFn = options.fetchFn ?? fetch;
  const lookupFn = options.lookupFn ?? lookup;
  if (!allowedInitialUrls.has(input)) fail("allowlist:initial-url");
  let current = new URL(input);

  for (let redirects = 0; redirects <= limits.maxRedirects; redirects += 1) {
    assertSafeUrl(current, allowedRedirectHosts);
    await assertPublicDns(current.hostname, { lookupFn });
    let response;
    try {
      response = await fetchFn(current, {
        redirect: "manual",
        headers: { "user-agent": "Foundry-Loadout-manifest-validator/0.1" },
        signal: AbortSignal.timeout(limits.timeoutPerHopMs),
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") fail("timeout:hop");
      throw error;
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) fail("redirect:no-location");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) fail(`http:${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!ACCEPTED_CONTENT_TYPES.has(contentType)) fail(`content-type:${contentType || "missing"}`);
    const body = await readLimited(response, limits);
    let data;
    try { data = JSON.parse(body.text); } catch { fail("json:invalid"); }
    return { data, bytes: body.bytes, finalUrl: current.href, status: response.status, contentType };
  }
  fail("redirect:too-many");
}

function majorOf(value) {
  const match = String(value ?? "").match(/^\d+/);
  return match ? Number(match[0]) : null;
}

function compatibilityMajor(compatibility, field) {
  const value = compatibility[field];
  if (value === undefined || value === null || value === "") return null;
  const major = majorOf(value);
  if (major === null) fail(`schema:compatibility.${field}`);
  return major;
}

function relationshipIds(data, kind) {
  return (data.relationships?.[kind] ?? []).map((item) => item.id).filter(Boolean).sort();
}

export function validateSchema(entry, track, snapshot) {
  const data = snapshot.data;
  if (data.id !== entry.id) fail("schema:id", `${data.id} != ${entry.id}`);
  if (typeof data.title !== "string" || !data.title.trim()) fail("schema:title");
  if (data.version !== track.moduleVersion) fail("schema:version", `${data.version} != ${track.moduleVersion}`);
  if (typeof data.manifest !== "string" || !data.manifest.startsWith("https://")) fail("schema:manifest");
  if (typeof data.download !== "string" || !data.download.startsWith("https://")) fail("schema:download");
  const compatibility = data.compatibility ?? {};
  const minimum = compatibilityMajor(compatibility, "minimum");
  const maximum = compatibilityMajor(compatibility, "maximum");
  compatibilityMajor(compatibility, "verified");
  if (minimum !== null && minimum > track.foundryMajor) fail("schema:compatibility.minimum");
  if (maximum !== null && maximum < track.foundryMajor) fail("schema:compatibility.maximum");

  const actualSystems = relationshipIds(data, "systems");
  const expectedSystems = [...track.relationships.systems].sort();
  if (actualSystems.length !== expectedSystems.length || actualSystems.some((id, index) => id !== expectedSystems[index])) {
    fail("schema:relationships.systems", `expected ${expectedSystems.join(",") || "none"}; got ${actualSystems.join(",") || "none"}`);
  }

  for (const [kind, expected] of [["requires", track.relationships.required], ["recommends", track.relationships.recommended]]) {
    const actual = relationshipIds(data, kind);
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((id, index) => id !== wanted[index])) {
      fail(`schema:relationships.${kind}`, `expected ${wanted.join(",") || "none"}; got ${actual.join(",") || "none"}`);
    }
  }
}

function assertHttpsEvidenceUrl(value, field, label) {
  if (value === null || value === undefined) return;
  let url;
  try { url = new URL(value); } catch { fail(`schema:${field}`, label); }
  if (url.protocol !== "https:" || url.username || url.password) fail(`schema:${field}`, label);
}

export function buildValidationPlan(catalog) {
  const tracks = [];
  const allowedInitialUrls = new Set();

  for (const entry of catalog) {
    for (const track of entry.tracks) {
      const label = `${entry.id} V${track.foundryMajor}`;
      const sources = track.sources ?? {};
      assertHttpsEvidenceUrl(sources.catalogUrl, "sources.catalogUrl", label);
      assertHttpsEvidenceUrl(sources.releaseUrl, "sources.releaseUrl", label);
      assertHttpsEvidenceUrl(sources.manifestUrl, "sources.manifestUrl", label);
      assertHttpsEvidenceUrl(sources.metadataManifestUrl, "sources.metadataManifestUrl", label);

      if (track.verificationStatus === "verified") {
        if (!track.installManifestUrl) fail("schema:verified-install-url", label);
        assertHttpsEvidenceUrl(track.installManifestUrl, "installManifestUrl", label);
        if (sources.manifestUrl !== track.installManifestUrl) fail("schema:verified-manifest-source", label);
        if (sources.metadataManifestUrl !== null) fail("schema:verified-metadata-source", label);
        tracks.push({ entry, track });
        allowedInitialUrls.add(track.installManifestUrl);
        continue;
      }

      if (track.installManifestUrl !== null) fail("schema:nonverified-public-url", label);
      if (sources.metadataManifestUrl !== null && track.verificationStatus !== "personal-premium-link") {
        fail("schema:metadata-status", label);
      }
      if (track.verificationStatus === "personal-premium-link") {
        if (track.declaredManifestUrl !== null) fail("schema:premium-declared-manifest", label);
        if (sources.manifestUrl !== null) fail("schema:premium-public-manifest", label);
      }
    }
  }

  return { tracks, allowedInitialUrls };
}

export async function validateTrack(entry, track, options = {}) {
  if (!track.installManifestUrl) fail("schema:installManifestUrl");
  const snapshot = await fetchManifest(track.installManifestUrl, {
    ...options,
    allowedInitialUrls: options.allowedInitialUrls ?? new Set([track.installManifestUrl]),
  });
  validateSchema(entry, track, snapshot);
  const data = snapshot.data;
  return {
    initialUrl: track.installManifestUrl,
    finalUrl: snapshot.finalUrl,
    status: snapshot.status,
    contentType: snapshot.contentType,
    bytes: snapshot.bytes,
    id: data.id,
    title: data.title,
    version: data.version,
    compatibility: data.compatibility ?? {},
    declaredManifestUrl: data.manifest ?? null,
    downloadUrl: data.download ?? null,
    systems: relationshipIds(data, "systems"),
    requiredDependencies: relationshipIds(data, "requires"),
    recommendedDependencies: relationshipIds(data, "recommends"),
  };
}

export function publicUrl(value) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.href;
}
