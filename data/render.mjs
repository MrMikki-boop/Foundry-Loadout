import { collections, statusPresentation } from "./catalog.mjs";

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

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
export const categoryGroup = (category) => CATEGORY_GROUPS[category] ?? category;

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

export function moduleCard({ entry, track }) {
  const presentation = statusPresentation[track.verificationStatus];
  const systems = track.relationships.systems.length ? track.relationships.systems.join(", ") : "Любая система";
  const required = track.relationships.required.length ? track.relationships.required.join(", ") : "Нет";
  const recommended = track.relationships.recommended.length ? track.relationships.recommended.join(", ") : "Нет";
  const version = track.moduleVersion ? `v${String(track.moduleVersion).replace(/^v/i, "")}` : "версия у автора";
  const url = track.installManifestUrl;
  const license = entry.license.url
    ? `<a href="${escapeHtml(entry.license.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(entry.license.name)} ↗</a>`
    : escapeHtml(entry.license.name);
  const quickCopy = presentation.canCopy && url && !track.relationships.required.length;
  const primaryAction = quickCopy
    ? `<button class="primary-button" type="button" data-copy-url="${escapeHtml(url)}">Копировать ссылку</button><div class="fallback-field" hidden><label>Скопируйте ссылку вручную<input readonly value="${escapeHtml(url)}"></label></div>`
    : `<button class="primary-button" type="button" data-install="${escapeHtml(entry.id)}">${presentation.canCopy && url ? 'Установить с зависимостями' : 'Как получить'} <span aria-hidden="true">↗</span></button>`;
  const collection = collections.find((item) => [...item.roots, ...item.related].includes(entry.id));
  const rawUrl = url
    ? detailRow("Manifest URL", `<code>${escapeHtml(url)}</code>`)
    : detailRow("Установка", escapeHtml(track.verificationNotes ?? "Публичной ссылки нет"));

  return `
    <article class="module-card" id="module-${escapeHtml(entry.id)}">
      <div class="card-topline">
        <div>
          <p class="card-category">${escapeHtml(categoryGroup(entry.category))}</p>
          <h3><a href="?v=${track.foundryMajor}#module-${encodeURIComponent(entry.id)}" data-module-link="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</a></h3>
          <p class="package-id">${escapeHtml(entry.id)} · ${escapeHtml(version)}</p>
        </div>
        <span class="status status-${escapeHtml(presentation.tone)}">${escapeHtml(track.verificationStatus === "verified" ? "Manifest проверен" : presentation.label)}</span>
      </div>
      ${entry.edition ? `<p class="edition">${escapeHtml(entry.edition)}</p>` : ""}
      <p class="module-description">${escapeHtml(entry.description)}</p>
      <ul class="card-meta" aria-label="Краткие сведения">
        <li>V${track.foundryMajor}</li>
        <li>${escapeHtml(systems)}</li>
        <li>${escapeHtml(dependencyLabel(track))}</li>
        <li>${entry.licenseType === "free" ? "Бесплатный" : "Премиальный"}</li>
      </ul>
      ${collection ? `<button class="collection-link" type="button" data-collection="${collection.id}">${escapeHtml(collection.subtitle)} →</button>` : ''}
      ${entry.paidEdition ? `<details class="module-details"><summary>Полная версия с HB / UA</summary><p>${escapeHtml(entry.paidEdition.description)}</p><a class="author-link" href="${escapeHtml(entry.paidEdition.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.paidEdition.title)} на Boosty ↗</a></details>` : ''}
      <div class="card-actions">${primaryAction}<button class="secondary-button" data-add-module="${escapeHtml(entry.id)}" aria-pressed="false">+ В мою сборку</button></div>
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

