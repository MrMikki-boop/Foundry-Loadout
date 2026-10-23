import { catalog, installationPlan, statusPresentation } from './catalog.mjs';

export function normalizeLoadout(value) {
  if (!value || ![13, 14].includes(value.major) || !Array.isArray(value.ids) || value.ids.length > 100 || value.ids.some(id => typeof id !== 'string' || !catalog.some(entry => entry.id === id))) throw new Error('Ссылка сборки повреждена или содержит неизвестные модули.');
  return { major: value.major, ids: [...new Set(value.ids)].sort() };
}
export function encodeLoadout(value) { return btoa(JSON.stringify(normalizeLoadout(value))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
export function decodeLoadout(token) {
  if (typeof token !== 'string' || token.length > 6000 || !/^[\w-]+$/.test(token)) throw new Error('Некорректная ссылка сборки.');
  try { return normalizeLoadout(JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')))); }
  catch { throw new Error('Ссылка сборки повреждена или устарела.'); }
}
export function loadoutPlan(value) {
  const { ids, major } = normalizeLoadout(value);
  return installationPlan(ids, major);
}
export function installationIssues(value) {
  const plan = loadoutPlan(value);
  const issues = plan.filter(({track}) => !track?.installManifestUrl || !statusPresentation[track.verificationStatus]?.canCopy)
    .map(({entry,id}) => `${entry?.title ?? id}: нет публичной ссылки для V${value.major}`);
  if (!plan.length) issues.push('Сборка пуста.');
  if (plan.some(x => x.id === 'jb2a_patreon') && plan.some(x => x.id === 'JB2A_DnD5e')) issues.push('Выберите одну библиотеку JB2A: бесплатную или Patreon.');
  return issues;
}
export async function revision(value) {
  const data = loadoutPlan(value).map(({id,track}) => [id, track ?? null]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
