import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const initialUrls = new Set([
  "https://github.com/mclemente/fvtt-dice-tray/releases/download/3.5.5/module.json",
]);
const redirectHosts = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
]);
const acceptedTypes = new Set([
  "application/json",
  "text/json",
  "text/plain",
  "application/octet-stream",
]);
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

function assertHttps(url) {
  if (url.protocol !== "https:") throw new Error("scheme:not-https");
  if (url.username || url.password) throw new Error("url:credentials");
}

async function assertPublicDns(hostname) {
  if (isIP(hostname)) {
    const family = isIP(hostname) === 4 ? "ipv4" : "ipv6";
    if (blocked.check(hostname, family)) throw new Error("dns:private-or-reserved");
    return [hostname];
  }
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length) throw new Error("dns:no-address");
  for (const answer of answers) {
    const family = answer.family === 4 ? "ipv4" : "ipv6";
    if (blocked.check(answer.address, family)) throw new Error("dns:private-or-reserved");
  }
  return answers.map(({ address }) => address);
}

async function validateManifest(input) {
  if (!initialUrls.has(input)) throw new Error("allowlist:initial-url");
  let current = new URL(input);
  const hops = [];
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    assertHttps(current);
    if (!redirectHosts.has(current.hostname)) throw new Error("allowlist:redirect-host");
    const addresses = await assertPublicDns(current.hostname);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "Foundry-Loadout-stage-3-spike" },
      signal: AbortSignal.timeout(8_000),
    });
    hops.push({ url: current.href, status: response.status, addresses });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect:no-location");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`http:${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!acceptedTypes.has(contentType)) throw new Error(`content-type:${contentType || "missing"}`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 262_144) throw new Error("size:content-length");
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > 262_144) throw new Error("size:stream");
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    const data = JSON.parse(text);
    return { hops, finalUrl: current.href, contentType, bytes, id: data.id, version: data.version };
  }
  throw new Error("redirect:too-many");
}

for (const [name, url] of [
  ["live-valid", [...initialUrls][0]],
]) {
  const started = performance.now();
  try {
    const result = await validateManifest(url);
    console.log(JSON.stringify({ name, ok: true, elapsedMs: Math.round(performance.now() - started), ...result }));
  } catch (error) {
    console.log(JSON.stringify({ name, ok: false, elapsedMs: Math.round(performance.now() - started), error: error.message }));
  }
}

for (const [name, probe] of [
  ["reject-http", async () => assertHttps(new URL("http://github.com/example/module.json"))],
  ["reject-private-ip", async () => {
    const url = new URL("https://127.0.0.1/module.json");
    assertHttps(url);
    await assertPublicDns(url.hostname);
  }],
  ["reject-unlisted", async () => {
    const url = "https://example.com/module.json";
    if (!initialUrls.has(url)) throw new Error("allowlist:initial-url");
  }],
]) {
  try {
    await probe();
    console.log(JSON.stringify({ name, ok: true, error: null }));
  } catch (error) {
    console.log(JSON.stringify({ name, ok: false, error: error.message }));
  }
}
