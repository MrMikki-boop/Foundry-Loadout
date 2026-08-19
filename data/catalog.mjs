import modules from "./modules.json" with { type: "json" };

export const statusPresentation = Object.freeze({
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
    const searchable = [entry.title, entry.id, entry.description, entry.category, ...entry.systems]
      .join(" ")
      .toLocaleLowerCase("ru");
    if (query && !searchable.includes(query)) return [];
    if (filters.category && entry.category !== filters.category) return [];
    if (filters.licenseType !== "all" && entry.licenseType !== filters.licenseType) return [];
    if (filters.system && !entry.systems.includes(filters.system)) return [];
    if (filters.verifiedOnly && track.verificationStatus !== "verified") return [];
    return [{ entry, track }];
  });
}

export const catalog = modules;
