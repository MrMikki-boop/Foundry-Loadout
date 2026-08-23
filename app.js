import { catalog, filterCatalog, statusPresentation } from "./data/catalog.mjs";

const CATEGORY_GROUPS = Object.freeze({
  "Автоматизация": "Автоматизация и бой",
  "Автоматизация D&D5e": "Автоматизация и бой",
  "Бой и интерфейс": "Автоматизация и бой",
  "Анимации и звук": "Анимации и звук",
  "Премиальные модули": "Анимации и звук",
  "Карты и сцены": "Карты и сцены",
  "Инструменты ведущего": "Инструменты",
  "Кости и чат": "Инструменты",
  "Кубики": "Инструменты",
  "Базовые библиотеки": "Библиотеки",
  "Библиотеки": "Библиотеки",
  "Локализация": "Локализация",
  "Переводы и контент": "Локализация",
});

const state = {
  major: 14,
  query: "",
  category: null,
  licenseType: "all",
  system: null,
  verifiedOnly: false,
};
let visibleLimit = 12;

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

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
const categoryGroup = (category) => CATEGORY_GROUPS[category] ?? category;

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

function resultLabel(count) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} модуль`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} модуля`;
  return `${count} модулей`;
}

function compatibilityLabel(track) {
  const { minimum, verified, maximum } = track.compatibility;
  const values = [];
  if (minimum !== undefined) values.push(`от ${minimum}`);
  if (verified !== undefined) values.push(`проверено на ${verified}`);
  if (maximum !== undefined) values.push(`до ${maximum}`);
  return values.length ? values.join(" · ") : `Диапазон для V${track.foundryMajor} не указан`;
}

function dependencyLabel(track) {
  const count = track.relationships.required.length;
  if (!count) return "Без обязательных зависимостей";
  return `${count} ${count === 1 ? "зависимость" : count < 5 ? "зависимости" : "зависимостей"}`;
}

function detailRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function moduleCard({ entry, track }) {
  const presentation = statusPresentation[track.verificationStatus];
  const systems = track.relationships.systems.length ? track.relationships.systems.join(", ") : "Любая система";
  const required = track.relationships.required.length ? track.relationships.required.join(", ") : "Нет";
  const recommended = track.relationships.recommended.length ? track.relationships.recommended.join(", ") : "Нет";
  const version = track.moduleVersion ? `v${track.moduleVersion}` : "по подписке";
  const url = track.installManifestUrl;
  const license = entry.license.url
    ? `<a href="${escapeHtml(entry.license.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(entry.license.name)} ↗</a>`
    : escapeHtml(entry.license.name);
  const primaryAction = presentation.canCopy && url
    ? `<button class="primary-button" type="button" data-copy-url="${escapeHtml(url)}">Копировать manifest</button>
       <div class="fallback-field" hidden>
         <label>Скопируйте ссылку вручную</label>
         <input type="text" value="${escapeHtml(url)}" readonly />
       </div>`
    : `<a class="primary-button" href="${escapeHtml(entry.projectUrl)}" target="_blank" rel="noreferrer noopener">Получить у автора ↗</a>`;
  const rawUrl = url
    ? detailRow("Manifest URL", `<code>${escapeHtml(url)}</code>`)
    : detailRow("Установка", escapeHtml(track.verificationNotes ?? "Публичной ссылки нет"));

  return `
    <article class="module-card">
      <div class="card-topline">
        <div>
          <p class="card-category">${escapeHtml(categoryGroup(entry.category))}</p>
          <h3>${escapeHtml(entry.title)}</h3>
          <p class="package-id">${escapeHtml(entry.id)} · ${escapeHtml(version)}</p>
        </div>
        <span class="status status-${escapeHtml(presentation.tone)}">${escapeHtml(presentation.label)}</span>
      </div>
      <p class="module-description">${escapeHtml(entry.description)}</p>
      <ul class="card-meta" aria-label="Краткие сведения">
        <li>V${track.foundryMajor}</li>
        <li>${escapeHtml(systems)}</li>
        <li>${escapeHtml(dependencyLabel(track))}</li>
        <li>${entry.licenseType === "free" ? "Бесплатный" : "Премиальный"}</li>
      </ul>
      <div class="card-actions">${primaryAction}</div>
      <details class="module-details">
        <summary>Подробнее</summary>
        <dl>
          ${detailRow("Совместимость", escapeHtml(compatibilityLabel(track)))}
          ${detailRow("Игровые системы", escapeHtml(systems))}
          ${detailRow("Обязательные зависимости", escapeHtml(required))}
          ${detailRow("Рекомендуемые зависимости", escapeHtml(recommended))}
          ${detailRow("Лицензия", license)}
          ${detailRow("Проверено", escapeHtml(track.verifiedAt ?? "Дата не указана"))}
          ${rawUrl}
        </dl>
        <a class="author-link" href="${escapeHtml(entry.projectUrl)}" target="_blank" rel="noreferrer noopener">Страница автора ↗</a>
      </details>
    </article>`;
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
    const label = button.textContent;
    button.textContent = "Скопировано";
    elements.announcer.textContent = "Manifest-ссылка скопирована";
    window.setTimeout(() => { button.textContent = label; }, 2500);
  } catch {
    const fallback = button.closest(".card-actions").querySelector(".fallback-field");
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
  if (target.name === "foundry-major") state.major = Number(target.value);
  if (target.id === "category-filter") state.category = target.value || null;
  if (target.id === "license-filter") state.licenseType = target.value;
  if (target.id === "system-filter") state.system = target.value || null;
  if (target.id === "verified-filter") state.verifiedOnly = target.checked;
  visibleLimit = 12;
  render();
});

document.addEventListener("click", (event) => {
  const reset = event.target.closest("[data-reset]");
  if (reset) return resetFilters();
  const more = event.target.closest("[data-more]");
  if (more) {
    visibleLimit += 12;
    return render();
  }
  const copy = event.target.closest("[data-copy-url]");
  if (copy) copyManifest(copy, copy.dataset.copyUrl);
});

render();
