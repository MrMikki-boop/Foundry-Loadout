import { decodeLoadout, encodeLoadout, installationIssues, loadoutPlan, revision } from '../data/loadout.mjs';

// ZIP STORE: one UTF-8 manifest, no compression or third-party module assets.
export function manifestZip(text) {
  const name = new TextEncoder().encode('module.json');
  const data = new TextEncoder().encode(text);
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  crc = (crc ^ 0xffffffff) >>> 0;
  const bytes = new Uint8Array(30 + name.length + data.length + 46 + name.length + 22);
  const view = new DataView(bytes.buffer);
  const u16 = (at, n) => view.setUint16(at, n, true);
  const u32 = (at, n) => view.setUint32(at, n, true);
  u32(0, 0x04034b50); u16(4, 20); u16(6, 0x800); u16(12, 33);
  u32(14, crc); u32(18, data.length); u32(22, data.length); u16(26, name.length);
  bytes.set(name, 30); bytes.set(data, 30 + name.length);
  const central = 30 + name.length + data.length;
  u32(central, 0x02014b50); u16(central+4, 20); u16(central+6, 20); u16(central+8, 0x800); u16(central+14, 33);
  u32(central+16, crc); u32(central+20, data.length); u32(central+24, data.length); u16(central+28, name.length);
  bytes.set(name, central+46);
  const end = central+46+name.length;
  u32(end, 0x06054b50); u16(end+8, 1); u16(end+10, 1); u32(end+12, 46+name.length); u32(end+16, central);
  return bytes;
}

export default { async fetch(request) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  const error = (message, status) => new Response(message, {status, headers});
  if (!['GET', 'HEAD'].includes(request.method)) return error('Method not allowed', 405);
  const url = new URL(request.url);
  const match = /^\/install\/([\w-]{1,6000})\/([a-f0-9]{24})\/(module.json|module.zip)$/.exec(url.pathname);
  if (!match) return error('Not found', 404);
  try {
    const value = decodeLoadout(match[1]);
    const issues = installationIssues(value);
    if (issues.length) return error(issues.join('\n'), 422);
    const rev = await revision(value);
    if (rev !== match[2]) return error('Каталог изменился. Откройте сборку на сайте и получите новую ссылку.', 409);
    const base = `${url.origin}/install/${encodeLoadout(value)}/${rev}`;
    const plan = loadoutPlan(value);
    const manifest = {
      id: `foundry-loadout-${rev}`, title: `Foundry Loadout · V${value.major} · ${plan.length} modules`,
      description: 'Набор модулей Foundry Loadout. Подтвердите установку зависимостей. Настройки мира не изменяются.',
      version: '1.0.0', compatibility: {minimum: String(value.major), maximum: String(value.major)},
      manifest: `${base}/module.json`, download: `${base}/module.zip`,
      relationships: {
        systems: [...new Set(plan.flatMap(x => x.track.relationships.systems))].map(id => ({id,type:'system'})),
        requires: plan.map(({id,track}) => ({id, type:'module', manifest:track.installManifestUrl,
          compatibility: {minimum:String(track.moduleVersion).replace(/^v/i,''), maximum:String(track.moduleVersion).replace(/^v/i,'')} }))
      }
    };
    const text = JSON.stringify(manifest, null, 2);
    headers['Content-Type'] = match[3] === 'module.json' ? 'application/json; charset=utf-8' : 'application/zip';
    return new Response(request.method === 'HEAD' ? null : match[3] === 'module.json' ? text : manifestZip(text), {headers});
  } catch { return error('Некорректная сборка.', 400); }
} };
