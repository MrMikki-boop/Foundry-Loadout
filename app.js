import { initializeLoadout } from "./loadout-ui.mjs";
import { moduleCard, escapeHtml, categoryGroup } from "./data/render.mjs";
import { catalog, filterCatalog, statusPresentation, collections, installationPlan } from "./data/catalog.mjs";


const state = {
  major: 13,
  query: "",
  category: null,
  licenseType: "all",
  system: null,
  verifiedOnly: false,
  dndFeatures: ["actions"],
  premiumAnimations: false,
};
let visibleLimit = 12;
const storageKey = "foundry-loadout:preferences";
let savedScroll = 0;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === "object") {
    if ([13, 14].includes(saved.major)) state.major = saved.major;
    if (typeof saved.query === "string") state.query = saved.query.slice(0, 200);
    if (["all", "free", "premium"].includes(saved.licenseType)) state.licenseType = saved.licenseType;
    if (typeof saved.category === "string") state.category = saved.category;
    if (typeof saved.system === "string") state.system = saved.system;
    state.verifiedOnly = saved.verifiedOnly === true;
    if (Array.isArray(saved.dndFeatures)) state.dndFeatures = saved.dndFeatures.filter(id => ["animations", "actions", "loot"].includes(id));
    state.premiumAnimations = saved.premiumAnimations === true;
    if (Number.isInteger(saved.visibleLimit)) visibleLimit = Math.max(12, Math.min(catalog.length, saved.visibleLimit));
    if (Number.isFinite(saved.scrollY)) savedScroll = Math.max(0, saved.scrollY);
  }
} catch { /* Storage may be unavailable in private browsing. */ }
const urlMajor = Number(new URL(location.href).searchParams.get('v'));
if ([13, 14].includes(urlMajor)) state.major = urlMajor;

function saveState() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ...state, visibleLimit, scrollY: window.scrollY })); }
  catch { /* Browsing and copying still work without storage. */ }
}
let scrollTimer;
window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveState, 150); }, { passive: true });
window.addEventListener('pagehide', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
history.scrollRestoration = 'manual';

const elements = {
  form: document.querySelector("#catalog-controls"),
  list: document.querySelector("#catalog-list"),
  resultCount: document.querySelector("#result-count"),
  selectedMajor: document.querySelector("#selected-major"),
  category: document.querySelector("#category-filter"),
  system: document.querySelector("#system-filter"),
  filterCount: document.querySelector("#filter-count"),
  announcer: document.querySelector("#announcer"),
};


function addOptions(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

addOptions(elements.category, [...new Set(catalog.map((entry) => categoryGroup(entry.category)))].sort((a, b) => a.localeCompare(b, "ru")));
addOptions(elements.system, [...new Set(catalog.flatMap((entry) => entry.tracks.flatMap((track) => track.relationships.systems)))].sort());

function syncControls() {
  if (![...elements.category.options].some(option => option.value === state.category)) state.category = null;
  if (![...elements.system.options].some(option => option.value === state.system)) state.system = null;
  elements.form.querySelector(`[name="foundry-major"][value="${state.major}"]`).checked = true;
  document.querySelector('#catalog-search').value = state.query;
  elements.category.value = state.category ?? '';
  elements.system.value = state.system ?? '';
  document.querySelector('#license-filter').value = state.licenseType;
  document.querySelector('#verified-filter').checked = state.verifiedOnly;
}
syncControls();

function resultLabel(count) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} модуль`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} модуля`;
  return `${count} модулей`;
}


function getResults() {
  const results = filterCatalog(catalog, { ...state, category: null });
  return state.category
    ? results.filter(({ entry }) => categoryGroup(entry.category) === state.category)
    : results;
}

function updateFilterCount() {
  const count = [
    state.category,
    state.licenseType !== "all",
    state.system,
    state.verifiedOnly,
  ].filter(Boolean).length;
  elements.filterCount.hidden = count === 0;
  elements.filterCount.textContent = count ? String(count) : "";
}

function render() {
  const results = getResults();
  const visibleResults = results.slice(0, visibleLimit);
  elements.selectedMajor.textContent = String(state.major);
  elements.resultCount.textContent = visibleResults.length < results.length
    ? `Показано ${visibleResults.length} из ${results.length}`
    : resultLabel(results.length);
  elements.list.innerHTML = results.length
    ? `${visibleResults.map(moduleCard).join("")}
       ${visibleResults.length < results.length
         ? `<button class="secondary-button load-more" type="button" data-more>Показать ещё ${Math.min(12, results.length - visibleResults.length)}</button>`
         : ""}`
    : `<div class="empty-state" role="status">
         <h3>Ничего не найдено</h3>
         <p>Уберите часть условий или попробуйте другое название.</p>
         <button class="primary-button" type="button" data-reset>Сбросить фильтры</button>
       </div>`;
  updateFilterCount();
  document.querySelector('#collections').innerHTML = collections.filter(item => ["essentials", "dnd5e"].includes(item.id)).map((item, index) => `<a class="collection-card" href="?v=${state.major}#collection-${item.id}" data-collection="${item.id}"><span class="collection-number">0${index + 1} / ГОТОВЫЙ НАБОР</span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.subtitle)}</span><span class="collection-cta">Посмотреть состав <span aria-hidden="true">↗</span></span></a>`).join('');
  saveState();
  document.dispatchEvent(new CustomEvent("catalog-render", {detail:{major:state.major}}));
}

function resetFilters() {
  state.query = "";
  state.category = null;
  state.licenseType = "all";
  state.system = null;
  state.verifiedOnly = false;
  visibleLimit = 12;
  elements.form.reset();
  elements.form.querySelector(`[name="foundry-major"][value="${state.major}"]`).checked = true;
  render();
}

async function copyManifest(button, url) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
    await navigator.clipboard.writeText(url);
    const label = button.dataset.originalLabel ?? button.textContent;
    button.dataset.originalLabel = label;
    button.textContent = "Скопировано ✓";
    button.closest(".install-item, .module-card").classList.add("copied");
    elements.announcer.textContent = "Manifest-ссылка скопирована";
    window.setTimeout(() => { button.textContent = label; }, 2500);
  } catch {
    const fallback = button.closest(".install-item, .card-actions").querySelector(".fallback-field");
    const input = fallback.querySelector("input");
    fallback.hidden = false;
    input.focus();
    input.select();
    elements.announcer.textContent = "Автокопирование недоступно. Ссылка выделена; нажмите Control+C.";
  }
}

elements.form.addEventListener("submit", (event) => event.preventDefault());
elements.form.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "catalog-search") state.query = target.value;
  if (target.name === "foundry-major") {
    state.major = Number(target.value);
    const url = new URL(location.href); url.searchParams.set('v', state.major);
    history.replaceState(null, '', url);
  }
  if (target.id === "category-filter") state.category = target.value || null;
  if (target.id === "license-filter") state.licenseType = target.value;
  if (target.id === "system-filter") state.system = target.value || null;
  if (target.id === "verified-filter") state.verifiedOnly = target.checked;
  visibleLimit = 12;
  render();
});

document.addEventListener("click", (event) => {
  const moduleLink = event.target.closest('[data-module-link]');
  if (moduleLink && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault();
    history.pushState(null, '', moduleLink.href);
    return navigateToHash();
  }
  const reset = event.target.closest("[data-reset]");
  if (reset) return resetFilters();
  const more = event.target.closest("[data-more]");
  if (more) {
    visibleLimit += 12;
    return render();
  }
  const install = event.target.closest("[data-install]");
  if (install) return openInstallation([install.dataset.install]);
  const collection = event.target.closest("[data-collection]");
  if (collection) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('v', state.major);
    url.hash = `collection-${collection.dataset.collection}`;
    history.replaceState(null, '', url);
    const selected = collections.find((item) => item.id === collection.dataset.collection);
    if (selected.id === "dnd5e") return openDndCollection();
    return openInstallation(collection.dataset.premium ? selected.roots.map(id => id === "JB2A_DnD5e" ? "jb2a_patreon" : id) : selected.roots, selected);
  }
  const copy = event.target.closest("[data-copy-url]");
  if (copy) copyManifest(copy, copy.dataset.copyUrl);
});

const dialog = document.querySelector('#install-dialog');
document.querySelector('#close-install').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (location.hash.startsWith('#collection-')) {
    const url = new URL(location.href); url.hash = ''; history.replaceState(null, '', url);
  }
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

function openDndCollection() {
  const ids = collections.filter(item => state.dndFeatures.includes(item.id)).flatMap(item => item.roots)
    .map(id => state.premiumAnimations && id === "JB2A_DnD5e" ? "jb2a_patreon" : id);
  openInstallation(ids, collections.find(item => item.id === "dnd5e"));
}

dialog.addEventListener('change', event => {
  if (!event.target.matches('[data-dnd-feature], #premium-animations')) return;
  const focusId = event.target.id;
  state.dndFeatures = [...dialog.querySelectorAll('[data-dnd-feature]:checked')].map(input => input.value);
  state.premiumAnimations = dialog.querySelector('#premium-animations')?.checked ?? state.premiumAnimations;
  saveState();
  openDndCollection();
  document.getElementById(focusId)?.focus({ preventScroll: true });
});

function openInstallation(ids, collection) {
  const plan = installationPlan(ids, state.major);
  document.querySelector('#dialog-title').textContent = collection?.title ?? plan.find((item) => item.id === ids[0])?.entry?.title ?? 'Установка';
  const suggested = [...new Set(plan.flatMap(item => item.track?.relationships.recommended ?? []))].filter(id => !plan.some(item => item.id === id));
  const recommendation = !collection && collections.find((item) => [...item.roots, ...item.related].includes(ids[0]));
  document.querySelector('#installation-content').innerHTML = `
    <p class="dialog-intro">${escapeHtml(collection?.description ?? 'Ссылки для выбранной версии Foundry VTT. Сначала установите зависимости, затем сам модуль.')}</p>
    ${collection?.id === 'dnd5e' ? `<fieldset class="feature-picker"><legend>Что добавить в игру</legend>${collections.filter(item => ['animations', 'actions', 'loot'].includes(item.id)).map(item => `<label><input id="feature-${item.id}" type="checkbox" data-dnd-feature value="${item.id}" ${state.dndFeatures.includes(item.id) ? 'checked' : ''}><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle)}</small></span></label>`).join('')}</fieldset>${state.dndFeatures.includes('animations') ? `<label class="premium-choice"><input id="premium-animations" type="checkbox" ${state.premiumAnimations ? 'checked' : ''}> У меня есть JB2A Patreon (вместо бесплатной библиотеки)</label>` : ''}<p class="install-note">${plan.length ? `В составе: ${resultLabel(plan.length)} с зависимостями.` : 'Отметьте хотя бы одну возможность.'}</p>` : ''}
    <div class="install-guide"><strong>Foundry VTT ${state.major} → Дополнения → Установить модуль</strong><br>Скопируйте ссылку, вставьте в поле Manifest URL и нажмите «Установить». Повторите для каждого модуля. Затем включите их в настройках мира.</div>
    ${collection?.id === 'animations' ? `<button class="secondary-button" type="button" data-collection="animations" ${ids.includes('jb2a_patreon') ? '' : 'data-premium="true"'}>${ids.includes('jb2a_patreon') ? 'Использовать бесплатную JB2A' : 'У меня есть JB2A Patreon'}</button><p class="install-note">Выберите одну библиотеку JB2A. Некоторые пресеты также используют PSFX; состав эффектов смотрите в инструкции автора.</p>` : ''}
    ${ids.length ? `<button class="secondary-button" data-add-pack="${escapeHtml(ids.join(','))}">Добавить набор и открыть сборку →</button>` : ''}
    <ol class="install-list">${plan.map(({ id, entry, track, requiredBy }) => {
      const url = track?.installManifestUrl;
      const canCopy = url && statusPresentation[track.verificationStatus].canCopy;
      return `<li class="install-item"><div><strong>${escapeHtml(entry?.title ?? id)}</strong><small>${escapeHtml(requiredBy ? 'Нужен для ' + requiredBy : 'Выбранный модуль')}${track?.moduleVersion ? ' · v' + escapeHtml(String(track.moduleVersion).replace(/^v/i, '')) : ''}</small></div>
      ${canCopy ? `<button type="button" class="primary-button" data-copy-url="${escapeHtml(url)}">Копировать ссылку</button><div class="fallback-field" hidden><label>Скопируйте ссылку вручную<input readonly value="${escapeHtml(url)}"></label></div>` : `<p class="install-note">${escapeHtml(track?.verificationNotes ?? 'В каталоге нет проверенной ссылки для этой версии. Найдите модуль в Foundry и проверьте совместимость.')}</p><a class="secondary-button" target="_blank" rel="noopener noreferrer" href="${escapeHtml(entry?.projectUrl ?? 'https://foundryvtt.com/packages/' + encodeURIComponent(id))}">Страница модуля ↗</a>`}</li>`;
    }).join('')}</ol>
    ${suggested.length ? `<aside class="recommendation"><strong>Автор также рекомендует</strong><p>Необязательные дополнения. Откройте модуль, чтобы посмотреть его зависимости и способ установки.</p>${suggested.map(id => `<button class="secondary-button" type="button" data-install="${escapeHtml(id)}">${escapeHtml(catalog.find(item => item.id === id)?.title ?? id)}</button>`).join(' ')}</aside>` : ''}
    ${recommendation ? `<aside class="recommendation"><strong>${escapeHtml(recommendation.subtitle)}</strong><p>${escapeHtml(recommendation.description)}</p><button class="secondary-button" type="button" data-collection="${recommendation.id}">Показать весь комплект →</button></aside>` : ''}
    ${collection ? `<a class="author-link" href="${escapeHtml(collection.source)}" target="_blank" rel="noopener noreferrer">Инструкция автора ↗</a>` : ''}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  document.querySelector('#close-install').focus({ preventScroll: true });
}

function navigateToHash() {
  const major = Number(new URL(location.href).searchParams.get('v'));
  if ([13, 14].includes(major)) state.major = major;
  let hash;
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch { return false; }
  if (hash.startsWith('module-')) {
    const id = hash.slice(7);
    const entry = catalog.find(item => item.id === id);
    if (!entry) return false;
    if (!entry.tracks.some(track => track.foundryMajor === state.major)) state.major = entry.tracks[0].foundryMajor;
    Object.assign(state, { query: '', category: null, system: null, licenseType: 'all', verifiedOnly: false });
    visibleLimit = catalog.length;
    syncControls(); render();
    document.getElementById(hash)?.scrollIntoView({ block: 'start' });
    return true;
  }
  if (hash.startsWith('collection-')) {
    const collection = collections.find(item => item.id === hash.slice(11));
    if (!collection) return false;
    syncControls(); render();
    if (collection.id === "dnd5e") openDndCollection();
    else openInstallation(collection.roots, collection);
    return true;
  }
  return false;
}
window.addEventListener('hashchange', navigateToHash);
window.addEventListener('popstate', () => { if (!navigateToHash()) { syncControls(); render(); } });
render();
if (!navigateToHash()) requestAnimationFrame(() => {
  if (location.hash && performance.getEntriesByType('navigation')[0]?.type !== 'reload') document.getElementById(location.hash.slice(1))?.scrollIntoView();
  else window.scrollTo(0, savedScroll);
});

initializeLoadout(state.major);
