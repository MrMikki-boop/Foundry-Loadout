"use client";

import { useMemo, useState } from "react";
import { filterCatalog, modules, statusPresentation, type FoundryMajor, type ModuleTrack } from "@/data/modules";

const DEFAULT_FOUNDRY_MAJOR: FoundryMajor = 14;
const categories = [...new Set(modules.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, "ru"));
const systems = [...new Set(modules.flatMap((entry) => entry.tracks.flatMap((track) => track.relationships.systems)))].sort((a, b) => a.localeCompare(b, "ru"));

function resultLabel(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} модуль`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} модуля`;
  return `${count} модулей`;
}

function compatibilityLabel(track: ModuleTrack) {
  const { minimum, verified, maximum } = track.compatibility;
  if (!minimum && !verified && !maximum) return `Автор не указал публичный диапазон для V${track.foundryMajor}.`;

  return [
    `minimum: ${minimum ?? "не указано"}`,
    `verified: ${verified ?? "не указано"}`,
    `maximum: ${maximum ?? "не указано"}`,
  ].join(" · ");
}

export function CatalogApp() {
  const [major, setMajor] = useState<FoundryMajor>(DEFAULT_FOUNDRY_MAJOR);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [licenseType, setLicenseType] = useState<"all" | "free" | "premium">("all");
  const [system, setSystem] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [notice, setNotice] = useState("");

  const results = useMemo(
    () => filterCatalog(modules, { major, query, category, licenseType, system, verifiedOnly }),
    [major, query, category, licenseType, system, verifiedOnly],
  );

  function resetFilters() {
    setQuery("");
    setCategory(null);
    setLicenseType("all");
    setSystem(null);
    setVerifiedOnly(true);
  }

  async function copyManifest(url: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard:unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Manifest-ссылка скопирована");
    } catch {
      setNotice("Не получилось скопировать ссылку. Попробуйте ещё раз.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#catalog" aria-label="Foundry Loadout, к каталогу">
          <span className="brand-mark" aria-hidden="true">FL</span>
          <span>Foundry Loadout</span>
        </a>
        <a className="header-link" href="#install">Как установить</a>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">Справочник manifest-ссылок</p>
          <h1 id="page-title">Модули для вашей версии Foundry VTT</h1>
          <p className="hero-lead">
            Проверенные manifest-ссылки для Foundry VTT 13 и 14. В карточке сразу видны назначение модуля, совместимость и зависимости.
          </p>
        </div>

        <fieldset className="version-picker" aria-describedby="version-hint">
          <legend>Версия Foundry VTT</legend>
          <div className="segmented-control">
            {([13, 14] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="foundry-major" value={value} checked={major === value} onChange={() => setMajor(value)} />
                <span>V{value}</span>
              </label>
            ))}
          </div>
          <p id="version-hint">Карточки и ссылки меняются вместе с версией.</p>
        </fieldset>
      </section>

      <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
        <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <div className="search-field">
            <label htmlFor="catalog-search">Поиск по каталогу</label>
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Название, package ID или назначение"
              autoComplete="off"
            />
          </div>
          <div className="filter-field">
            <label htmlFor="category-filter">Категория</label>
            <select id="category-filter" value={category ?? ""} onChange={(event) => setCategory(event.currentTarget.value || null)}>
              <option value="">Все категории</option>
              {categories.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="license-filter">Доступ</label>
            <select id="license-filter" value={licenseType} onChange={(event) => setLicenseType(event.currentTarget.value as "all" | "free" | "premium")}>
              <option value="all">Любой</option>
              <option value="free">Бесплатные</option>
              <option value="premium">Премиальные</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="system-filter">Игровая система</label>
            <select id="system-filter" value={system ?? ""} onChange={(event) => setSystem(event.currentTarget.value || null)}>
              <option value="">Все системы</option>
              <option value="__system-agnostic__">Любая система</option>
              {systems.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </div>
          <label className="verified-filter">
            <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.currentTarget.checked)} />
            <span>Только проверенные</span>
          </label>
          <button className="reset-button" type="button" onClick={resetFilters}>Сбросить</button>
        </form>

        <div className="section-heading">
          <div>
            <p className="eyebrow">Каталог</p>
            <h2 id="catalog-title">Для Foundry VTT {major}</h2>
          </div>
          <p className="result-count" aria-live="polite">{resultLabel(results.length)}</p>
        </div>

        {results.length ? (
        <div className="catalog-grid">
          {results.map(({ entry, track }) => {
            const url = track.installManifestUrl;
            const presentation = statusPresentation[track.verificationStatus];
            return (
              <article className="module-card" key={entry.id}>
                <div className="card-topline">
                  <div className="card-badges">
                    <span className="category">{entry.category}</span>
                    <span className={`license-badge license-${entry.licenseType}`}>
                      {entry.licenseType === "free" ? "Бесплатный" : "Премиальный"}
                    </span>
                  </div>
                  <span className={`status status-${presentation.tone}`}><span aria-hidden="true">●</span> {presentation.label}</span>
                </div>

                <div className="card-title-row">
                  <div><h3>{entry.title}</h3><p className="package-id">{entry.id}</p></div>
                  <span className="module-version">{track.moduleVersion ? `v${track.moduleVersion}` : "По подписке"}</span>
                </div>

                <p className="module-description">{entry.description}</p>
                <dl className="facts">
                  <div>
                    <dt>Foundry VTT {track.foundryMajor}</dt>
                    <dd className="compatibility-value">{compatibilityLabel(track)}</dd>
                  </div>
                  <div><dt>Системы</dt><dd>{track.relationships.systems.length ? track.relationships.systems.join(", ") : "Любая система"}</dd></div>
                  <div>
                    <dt>Дополнения и зависимости</dt>
                    <dd className="dependency-list">
                      <span>{track.relationships.required.length ? `Обязательные: ${track.relationships.required.join(", ")}` : "Обязательных нет"}</span>
                      {track.relationships.recommended.length ? <span>Рекомендуемые: {track.relationships.recommended.join(", ")}</span> : null}
                      {track.relationships.required.length || track.relationships.recommended.length ? (
                        <small>При установке Foundry VTT предложит добавить их вместе с модулем.</small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Лицензия</dt>
                    <dd>
                      {entry.license.url ? (
                        <a href={entry.license.url} target="_blank" rel="noreferrer noopener">{entry.license.name} <span aria-hidden="true">↗</span></a>
                      ) : entry.license.name}
                    </dd>
                  </div>
                </dl>

                {presentation.canCopy && url ? (
                <div className="manifest-block">
                  <span className="manifest-label">Manifest URL</span>
                  <button type="button" className="manifest-copy" aria-label={`Скопировать manifest: ${entry.title}`} onClick={() => copyManifest(url)}>{url}</button>
                </div>
                ) : (
                  <div className="access-notice" role="note">
                    <strong>{presentation.label}</strong>
                    <span>{track.verificationNotes ?? "Публичную ссылку для этой ветки не публикуем."}</span>
                  </div>
                )}

                <div className="card-footer">
                  <span>Сведения проверены {track.verifiedAt ?? "не указано"}</span>
                  <a href={entry.projectUrl} target="_blank" rel="noreferrer noopener">{entry.licenseType === "premium" ? "Доступ у автора" : "Страница автора"} <span aria-hidden="true">↗</span></a>
                </div>
              </article>
            );
          })}
        </div>
        ) : (
          <div className="empty-state" role="status">
            <p className="eyebrow">Ничего не найдено</p>
            <h3>Проверьте фильтры</h3>
            <p>Попробуйте убрать часть условий или вернуться к проверенным модулям по умолчанию.</p>
            <button type="button" className="reset-button reset-button-primary" onClick={resetFilters}>Сбросить фильтры</button>
          </div>
        )}
      </section>

      <section className="install-section" id="install" aria-labelledby="install-title">
        <div>
          <p className="eyebrow">Ручная установка</p>
          <h2 id="install-title">Куда вставить ссылку</h2>
          <p>Сначала сделайте резервную копию мира. Модуль устанавливается в Foundry VTT, а включается уже внутри нужного мира. Если manifest перечисляет зависимости, Foundry VTT предложит установить их заодно.</p>
        </div>
        <ol className="install-steps">
          <li><span>1</span><p>Нажмите <strong>Скопировать manifest</strong> в карточке модуля.</p></li>
          <li><span>2</span><p>Откройте Foundry Virtual Tabletop.</p></li>
          <li><span>3</span><p>Перейдите в <strong>Дополнения → Установить модуль</strong>.</p></li>
          <li><span>4</span><p>Вставьте ссылку в поле <strong>Manifest URL</strong>.</p></li>
          <li><span>5</span><p>Нажмите <strong>Установить</strong>. После загрузки включите модуль внутри нужного мира.</p></li>
        </ol>
      </section>

      <footer><p>Независимый справочник. Foundry Loadout не связан с Foundry Gaming LLC и не одобрен ею. Foundry Virtual Tabletop является торговой маркой Foundry Gaming LLC.</p></footer>
      <div className="toast" role="status" aria-live="polite" aria-atomic="true">{notice}</div>
    </main>
  );
}
