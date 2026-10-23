import { catalog, statusPresentation } from './data/catalog.mjs';
import { escapeHtml } from './data/render.mjs';
import { normalizeLoadout, encodeLoadout, decodeLoadout, loadoutPlan, installationIssues, revision } from './data/loadout.mjs';

const storageKey = 'foundry-loadout:my-builds';
let builds = {13: [], 14: []};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const major of [13,14]) builds[major] = normalizeLoadout({major,ids:saved?.[major] ?? []}).ids;
} catch { /* Keep browsing if storage is unavailable. */ }
let major = 13;
let imported = null;
let generation = 0;
let undo = null;
let notice = "";
const dialog = document.createElement('dialog');
dialog.id = 'loadout-dialog';
dialog.setAttribute('aria-labelledby', 'loadout-title');
document.body.append(dialog);
const launcher = document.createElement('button');
launcher.className = 'loadout-launcher';
launcher.type = 'button';
launcher.addEventListener('click', () => { imported = null; notice = ''; show(); });
document.querySelector('#collections').after(launcher);
const current = () => ({major, ids:builds[major]});
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(builds)); }
  catch { document.querySelector('#announcer').textContent = 'Браузер не разрешает сохранить сборку. Сохраните ссылку через «Поделиться».'; }
  updateButtons();
}
function updateButtons() {
  launcher.innerHTML = `<span><strong>Моя сборка <span class="build-count">${builds[major].length}</span></strong><small>Foundry V${major} · сохранена в этом браузере</small></span><span>Открыть →</span>`;
  for (const button of document.querySelectorAll('[data-add-module]')) {
    const selected = builds[major].includes(button.dataset.addModule);
    button.textContent = selected ? '✓ В сборке' : '+ В сборку';
    button.title = selected ? 'Убрать из выбранных модулей' : 'Добавить в мою сборку';
    button.setAttribute('aria-pressed', String(selected));
  }
}
function shareUrl(value) {
  const url = new URL(location.href);
  url.search = ''; url.hash = `build=${encodeLoadout(value)}`;
  return url.href;
}
function show() {
  const value = imported ?? current();
  const plan = loadoutPlan(value);
  const selected = plan.filter(item => value.ids.includes(item.id));
  const dependencies = plan.filter(item => !value.ids.includes(item.id));
  const section = (title, rows) => rows.length ? `<section class="build-section"><h3>${title} <span>${rows.length}</span></h3><ul class="build-list">${rows.map(({id,entry,track}) => {
    const parents = plan.filter(item => item.track?.relationships.required.includes(id)).map(item => item.entry?.title ?? item.id);
    const canCopy = track?.installManifestUrl && statusPresentation[track.verificationStatus]?.canCopy;
    return `<li class="build-row"><div class="build-row-info"><strong>${escapeHtml(entry?.title ?? id)}</strong><small>${track?.moduleVersion ? 'v' + escapeHtml(String(track.moduleVersion).replace(/^v/i,'')) : 'Версия у автора'}${!track ? ' · нет версии для V' + value.major : ''}</small>${parents.length ? `<small>Нужен для: ${escapeHtml(parents.join(', '))}</small>` : ''}</div><div class="build-row-actions">${canCopy ? `<button class="secondary-button" data-build-copy="${escapeHtml(track.installManifestUrl)}" aria-label="Копировать ссылку ${escapeHtml(entry.title)}">Ссылка</button>` : `<a class="secondary-button" href="${escapeHtml(entry?.projectUrl ?? 'https://foundryvtt.com/packages/' + encodeURIComponent(id))}" target="_blank" rel="noopener noreferrer">У автора ↗</a>`}${!imported && value.ids.includes(id) ? `<button class="build-remove" data-build-remove="${escapeHtml(id)}" aria-label="Убрать ${escapeHtml(entry?.title ?? id)}" title="Убрать из выбранных">×</button>` : ''}</div></li>`;
  }).join('')}</ul></section>` : '';
  dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">Foundry V${value.major}</p><h2 id="loadout-title">${imported ? 'Сборка по ссылке' : 'Моя сборка'}</h2></div><button class="build-remove" data-build-close aria-label="Закрыть сборку">×</button></div>
    <p class="build-intro">${imported ? 'Посмотрите состав и добавьте нужный набор к своему. Ваши модули останутся на месте.' : 'Вы выбираете модули — обязательные зависимости добавляются сами.'}</p>
    ${imported ? '<button class="primary-button" data-build-merge>Добавить к моей сборке</button>' : ''}
    <div class="build-feedback" role="status">${escapeHtml(notice)} ${!imported && undo ? '<button class="text-button" data-build-undo>Отменить</button>' : ''}</div>
    ${plan.length ? `<div class="build-actions build-main-actions"><button class="primary-button" data-build-install disabled>Копировать ссылку для Foundry</button><button class="secondary-button" data-build-share>Поделиться сборкой</button></div><p id="build-install-message" role="status">Проверяем доступность установки…</p>` : ''}
    ${section('Вы выбрали', selected)}${section('Нужны для работы', dependencies)}
    ${!plan.length ? '<div class="build-empty"><strong>Начните с того, что нужно вашей игре</strong><p>Добавляйте отдельные модули из каталога или готовый набор целиком.</p><button class="primary-button" data-build-close>Выбрать модули</button></div>' : ''}
    ${plan.length ? `<div class="build-footer"><button class="secondary-button" data-build-close>Продолжить выбор</button><p class="install-note">«Поделиться сборкой» открывает состав на сайте. Для ручной установки сначала установите зависимости из раздела «Нужны для работы», затем выбранные модули.</p></div>` : ''}
    <p id="build-message" role="status"></p><div id="build-link" hidden><label>Скопируйте ссылку<input readonly></label></div>`;
  if (!dialog.open) { dialog.showModal(); dialog.querySelector('[data-build-close]').focus(); }
  if (plan.length) prepareInstall(value, ++generation);
  else generation++;
}
async function prepareInstall(value, turn) {
  const button = dialog.querySelector('[data-build-install]');
  const message = dialog.querySelector('#build-install-message');
  try {
    const endpoint = import.meta.env.VITE_INSTALLER_URL ?? 'https://foundry-loadout-installer.foundry-loadout.workers.dev';
    if (!endpoint) { button.disabled = true; message.textContent = 'Установка одной ссылкой ещё не подключена. Пока можно скопировать ссылки модулей по отдельности. Сохранение и обмен сборкой уже работают.'; return; }
    const issues = installationIssues(value);
    if (issues.length) { message.textContent = issues.join('. '); return; }
    const url = new URL(`/install/${encodeLoadout(value)}/${await revision(value)}/module.json`, endpoint);
    const response = await fetch(url, {signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Сервис установки недоступен или каталог обновился. Обновите страницу и попробуйте снова.');
    const manifest = await response.json();
    if (manifest.manifest !== url.href) throw new Error('Сервис вернул некорректную ссылку.');
    if (turn !== generation) return;
    button.dataset.url = url.href; button.disabled = false; button.textContent = 'Копировать ссылку для Foundry';
    message.textContent = url.protocol === 'http:' ? 'Локальная проверка: эта ссылка работает только на этом компьютере. Публичный сервис ещё не подключён.' : 'Вставьте ссылку в Manifest URL в Foundry и подтвердите установку зависимостей. Затем включите модули в мире. Уже установленные несовместимые версии могут потребовать ручной замены.';
  } catch (error) { if (turn === generation) { message.textContent = error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Не удалось связаться с сервисом установки. Проверьте подключение и попробуйте открыть сборку позже. Отдельные ссылки модулей доступны ниже.' : error.message; } }
}
async function copy(url, button) {
  const field = dialog.querySelector('#build-link');
  field.hidden = true; field.querySelector('input').value = url;
  try { await navigator.clipboard.writeText(url); if (button) { const label = button.textContent; button.textContent = 'Скопировано ✓'; setTimeout(() => { if (button.isConnected) button.textContent = label; }, 2000); } dialog.querySelector('#build-message').textContent = button?.hasAttribute('data-build-share') ? 'Ссылка на состав скопирована. Отправьте её другому человеку.' : 'Ссылка модуля скопирована. Вставьте её в Manifest URL в Foundry.'; } 
  catch { field.hidden = false; field.querySelector('input').focus(); field.querySelector('input').select(); dialog.querySelector('#build-message').textContent = 'Скопируйте выделенную ссылку вручную.'; }
}
dialog.addEventListener('click', event => {
  if (event.target === dialog || event.target.closest('[data-build-close]')) return dialog.close();
  const remove = event.target.closest('[data-build-remove]');
  if (remove) {
    const id = remove.dataset.buildRemove;
    undo = {major, ids:[...builds[major]]};
    builds[major] = builds[major].filter(item => item !== id);
    notice = loadoutPlan(current()).some(item => item.id === id) ? 'Убран из выбранных, но остаётся зависимостью другого модуля.' : 'Модуль убран. Ненужные зависимости тоже удалены.';
    persist(); show(); dialog.querySelector('[data-build-undo]').focus(); return;
  }
  if (event.target.closest('[data-build-undo]') && undo) {
    builds[undo.major] = undo.ids; undo = null; notice = 'Удаление отменено.'; persist(); show(); dialog.querySelector('[data-build-close]').focus(); return;
  }
  const single = event.target.closest('[data-build-copy]');
  if (single) return copy(single.dataset.buildCopy, single);
  if (event.target.closest('[data-build-merge]')) {
    undo = null; notice = 'Набор добавлен. Повторяющиеся модули объединены.';
    major = imported.major; builds[major] = [...new Set([...builds[major], ...imported.ids])]; imported = null;
    const url = new URL(location.href); url.hash = ''; url.searchParams.set('v', major); history.replaceState(null, '', url);
    document.querySelector(`[name="foundry-major"][value="${major}"]`).click();
    persist(); return show();
  }
  if (event.target.closest('[data-build-share]')) return copy(shareUrl(imported ?? current()), event.target.closest('[data-build-share]'));
  const install = event.target.closest('[data-build-install]');
  if (install?.dataset.url) copy(install.dataset.url);
});
document.addEventListener('click', event => {
  const add = event.target.closest('[data-add-module]');
  if (add) {
    undo = null; notice = '';
    const id = add.dataset.addModule;
    builds[major] = builds[major].includes(id) ? builds[major].filter(x => x !== id) : [...builds[major], id];
    persist();
  }
  const pack = event.target.closest('[data-add-pack]');
  if (pack) {
    undo = null; notice = '';
    builds[major] = [...new Set([...builds[major], ...pack.dataset.addPack.split(',').filter(id => catalog.some(x => x.id === id))])];
    persist(); document.querySelector('#install-dialog').close(); imported = null; notice = 'Набор добавлен в вашу сборку.'; show();
  }
});
function openShared() {
  if (!location.hash.startsWith('#build=')) return;
  try { imported = decodeLoadout(location.hash.slice(7)); show(); }
  catch(error) { document.querySelector('#announcer').textContent = error.message; launcher.textContent = error.message; }
}
dialog.addEventListener('close', () => {
  generation++;
  if (location.hash.startsWith('#build=')) { const url = new URL(location.href); url.hash = ''; history.replaceState(null, '', url); }
});
window.addEventListener('hashchange', openShared);
document.addEventListener('catalog-render', event => { if (major !== event.detail.major) { undo = null; notice = ''; } major = event.detail.major; updateButtons(); });
export function initializeLoadout(selectedMajor) { major = selectedMajor; updateButtons(); openShared(); }
