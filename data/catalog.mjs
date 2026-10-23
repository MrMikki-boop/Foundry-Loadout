import modules from "./modules.json" with { type: "json" };

export const statusPresentation = Object.freeze({
  "public-manifest": { label: "Ссылка автора", tone: "info", canCopy: true },
  verified: { label: "Проверено", tone: "success", canCopy: true },
  "author-claimed": { label: "Заявлено автором", tone: "info", canCopy: false },
  "needs-review": { label: "Требует проверки", tone: "warning", canCopy: false },
  unavailable: { label: "Ссылка недоступна", tone: "danger", canCopy: false },
  "no-public-manifest": { label: "Нет публичного manifest", tone: "neutral", canCopy: false },
  "personal-premium-link": { label: "Премиальный: персональная установка", tone: "neutral", canCopy: false },
});

export function getTrack(entry, major) {
  return entry.tracks.find((track) => track.foundryMajor === major) ?? null;
}

export function filterCatalog(entries, filters) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return entries.flatMap((entry) => {
    const track = getTrack(entry, filters.major);
    if (!track) return [];
    const searchable = [entry.title, entry.id, entry.description, entry.category, ...(entry.aliases ?? []), ...track.relationships.systems]
      .join(" ")
      .toLocaleLowerCase("ru");
    if (query && !searchable.includes(query)) return [];
    if (filters.category && entry.category !== filters.category) return [];
    if (filters.licenseType !== "all" && entry.licenseType !== filters.licenseType) return [];
    if (filters.system === "__system-agnostic__" && track.relationships.systems.length) return [];
    if (filters.system && filters.system !== "__system-agnostic__" && track.relationships.systems.length && !track.relationships.systems.includes(filters.system)) return [];
    if (filters.verifiedOnly && track.verificationStatus !== "verified") return [];
    return [{ entry, track }];
  });
}

export const catalog = modules;

// Curated workflows are separate from authors' mandatory manifest dependencies.
export const collections = [
  { id: "essentials", title: "Базовый Foundry", subtitle: "Перевод и удобство для любой системы", description: "Русский интерфейс, панель бросков, быстрый поиск по Ctrl+Space и расстояния между токенами. Выберите нужное: эти модули не требуют D&D5e. Babele и libWrapper полезны для отдельных переводов, но не обязательны для всего набора.", roots: ["ru-ru", "dice-calculator", "quick-insert", "universal-hover-distance"], related: ["babele"], source: "https://github.com/phenomen/foundry-vtt-ru" },
  { id: "dnd5e", title: "Ваш стол D&D 5e", subtitle: "Анимации · действия · добыча", description: "Выберите возможности для своей игры. Общие зависимости собраны один раз, перед модулями, которым они нужны. Проверяйте также версию системы D&D5e на странице автора.", roots: [], related: [], source: "https://foundryvtt.com/packages/dnd5e" },
  { id: "animations", title: "Заклинания оживают", subtitle: "Анимации для D&D 5e", description: "JB2A даёт графику, Automated Animations запускает её, а D&D5e Animations добавляет готовые настройки. Бесплатная JB2A покрывает часть эффектов; полная библиотека доступна по подписке.", roots: ["JB2A_DnD5e", "dnd5e-animations"], related: ["jb2a_patreon", "autoanimations", "sequencer", "socketlib"], source: "https://jules-bens-aa.github.io/jb2a-wiki/getting-started/guides/" },
  { id: "actions", title: "Действия под рукой", subtitle: "Панель действий для D&D 5e", description: "Token Action HUD D&D5e добавляет броски, предметы и действия выбранного токена. Core и socketlib обеспечивают работу панели.", roots: ["token-action-hud-dnd5e"], related: ["token-action-hud-core"], source: "https://github.com/Larkinabout/fvtt-token-action-hud-dnd5e" },
  { id: "loot", title: "Добыча и торговцы", subtitle: "Предметы на карте для D&D 5e", description: "Item Piles и адаптер D&D 5e. Адаптер соединяет основной модуль с игровой системой.", roots: ["itempilesdnd5e"], related: ["item-piles"], source: "https://github.com/fantasycalendar/FoundryVTT-ItemPilesDnD5e" },
];

export function installationPlan(ids, major, entries = catalog) {
  const seen = new Set();
  const result = [];
  function visit(id, requiredBy) {
    if (seen.has(id)) return;
    seen.add(id);
    const entry = entries.find((item) => item.id === id);
    const track = entry && getTrack(entry, major);
    for (const dependency of track?.relationships.required ?? []) visit(dependency, entry.title);
    result.push({ id, entry, track, requiredBy });
  }
  for (const id of ids) visit(id, null);
  return result;
}
