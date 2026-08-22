# Контракты

## Архитектура

```text
version-controlled catalog.json
          │
          ├── build-time validator ──► HTTP manifests / releases / Foundry catalog
          │                            (CI only, exact allowlist)
          │
          └── React/Vinext page ─────► static catalog UI
                                       search/filter/copy in browser
                                       no runtime API, DB or secrets
                         │
                         └── export-pages.mjs ──► GitHub Pages artifact
```

- Основа сайта: Sites `vinext-starter`, React 19, TypeScript, Vite/Vinext и `@openai/sites-vite-plugin`.
- `.openai/hosting.json` хранится в репозитории с `d1: null` и `r2: null`.
- Основная сборка сохраняет Sites/Vinext Worker-совместимость. `npm run build:pages` отдельно рендерит единственный route и переносит клиентские assets в `out/` с base path `/Foundry-Loadout/`.
- GitHub Pages публикует только `out/`; серверный Worker, D1 и R2 в production-сценарии Pages не используются.
- Каталог импортируется при сборке. Браузер никогда не загружает manifest и не принимает URL пользователя.
- Сетевой валидатор запускается только локально/в CI и читает exact allowlist из типизированных данных.
- Корневой route один. Детальные страницы и клиентский роутер не нужны вертикальному срезу.
- 21st.dev MCP недоступен; компоненты пишутся штатными React/HTML/CSS-средствами по `design-system/MASTER.md`, без UI-kit зависимости.

## Структура production-файлов

```text
app/
  layout.tsx             # metadata, язык, глобальные стили
  page.tsx               # серверная оболочка страницы
  catalog-app.tsx        # клиентское состояние версии и Clipboard API
  globals.css            # токены и компоненты из design-system/MASTER.md
data/
  modules.json           # редакционный каталог, источник данных для UI и валидатора
  modules.ts             # типизированная обёртка и функции выборки
scripts/
  manifest-validator.mjs # тестируемое ядро сетевой проверки
  validate-manifests.mjs # build-time/CI entrypoint
tests/
  catalog.test.mjs       # схема, ветки, URL, отсутствие bulk-сценариев
  validator-security.test.mjs # негативные SSRF/network fixtures без сети
.openai/hosting.json
```

## Модели данных

```ts
type FoundryMajor = 13 | 14;

type VerificationStatus =
  | "verified"
  | "author-claimed"
  | "needs-review"
  | "unavailable"
  | "no-public-manifest"
  | "personal-premium-link";

type CompatibilityValue = string | number;

type Compatibility = {
  minimum?: CompatibilityValue;
  verified?: CompatibilityValue;
  maximum?: CompatibilityValue;
};

type VerificationSources = {
  catalogUrl: `https://${string}` | null;
  releaseUrl: `https://${string}` | null;
  manifestUrl: `https://${string}` | null;
  metadataManifestUrl: `https://${string}` | null;
};

type TrackRelationships = {
  systems: string[];
  required: string[];
  recommended: string[];
};

type ModuleTrack = {
  foundryMajor: FoundryMajor;
  moduleVersion: string | null;
  installManifestUrl: `https://${string}` | null;
  declaredManifestUrl: `https://${string}` | null;
  compatibility: Compatibility;
  relationships: TrackRelationships;
  verificationStatus: VerificationStatus;
  verifiedAt?: `${number}-${number}-${number}`;
  verificationNotes?: string;
  sources: VerificationSources;
};

type ModuleEntry = {
  id: string;
  title: string;
  description: string;
  category: string;
  licenseType: "free" | "premium";
  license: {
    name: string;
    url: `https://${string}` | null;
  };
  projectUrl: `https://${string}`;
  tracks: ModuleTrack[];
};
```

`installManifestUrl` — единственное значение, которое разрешено копировать. `declaredManifestUrl` — update URL внутри manifest; он хранится для аудита и не подменяет закреплённую установочную ссылку.

`sources.manifestUrl` — именно проверенный публичный manifest обычного релиза. `sources.metadataManifestUrl` — официальный versioned protected manifest: он доказывает metadata premium-пакета, но никогда не становится install URL. Для недоказанной или отсутствующей ветки source URL, которого нет, остаётся `null`; поле не заполняется догадкой.

Системы и зависимости принадлежат track, потому что разные major-релизы одного модуля могут объявлять разный набор relationships. Пустой `relationships.systems` означает system-agnostic модуль и показывается в UI как «Любая система». Фильтр системы читает только выбранный track: конкретная система совпадает по manifest ID, а отдельный вариант «Любая система» выбирает пустой массив.

Нельзя дорисовывать отсутствующий `compatibility.maximum`: `targetMajor` задаётся полем `foundryMajor`, а raw compatibility сохраняется без догадок.

`compatibility.verified` показывает последнюю версию, на которой автор проверял пакет, но не задаёт верхнюю границу. Валидатор допускает major, если она не ниже `minimum` и не выше `maximum`; отсутствующая граница считается открытой. Поэтому один и тот же versioned manifest может честно обслуживать V13 и V14.

`license` описывает лицензию кода или контента, а `licenseType` только доступ: бесплатно или за плату. Если автор не опубликовал лицензию, карточка так и пишет; свободную лицензию нельзя предполагать по бесплатному доступу.

## Контракт трёх карточек вертикального среза

| ID | V13 | V14 | Системы | Зависимости из manifest | Лицензия |
|---|---|---|---|---|---|
| `ru-ru` | `13.351.54`, pinned `release-v13` | `14.366.1`, pinned `release-v14` | Foundry VTT, переводы систем | `lib-wrapper`, `babele` — рекомендуемые | не указана автором |
| `dice-calculator` | `3.5.5`, pinned release | `3.7.2`, pinned release | system-agnostic | — | MIT |
| `dae` | `13.0.29`, Foundry `13.0…13.999` | `14.0.12`, Foundry `14…14.999` | dnd5e | `lib-wrapper`, `socketlib` — обязательные | MIT |

Для всех шести веток статус `verified`, дата проверки `2026-08-19`, а sources содержат официальный каталог, официальный релиз и manifest релиза. `latest` не используется как `installManifestUrl`.

Этот раздел фиксирует исходный вертикальный срез. Полный каталог следует общей модели выше: systems и dependencies хранятся в каждом track, а карточка содержит ровно по одному track для V13 и V14, включая честные состояния отсутствия.

## Публичные функции каталога

```ts
function getTrack(entry: ModuleEntry, major: FoundryMajor): ModuleTrack | null;

function filterCatalog(
  entries: readonly ModuleEntry[],
  filters: {
    major: FoundryMajor;
    query: string;
    category: string | null;
    licenseType: "all" | "free" | "premium";
    system: string | null;
    verifiedOnly: boolean;
  },
): Array<{ entry: ModuleEntry; track: ModuleTrack }>;

```

Копирование — внутренний обработчик `CatalogApp`, не публичный API проекта. Он вызывается только по явному нажатию, передаёт Clipboard API URL выбранной карточки, а при отсутствии API или rejected Promise фокусирует и выделяет видимый readonly URL.

## Контракт отображения

```ts
type VerificationPresentation = {
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
  canCopy: boolean;
};

const statusPresentation: Record<VerificationStatus, VerificationPresentation> = {
  verified: { label: "Проверено", tone: "success", canCopy: true },
  "author-claimed": { label: "Заявлено автором", tone: "info", canCopy: false },
  "needs-review": { label: "Требует проверки", tone: "warning", canCopy: false },
  unavailable: { label: "Ссылка недоступна", tone: "danger", canCopy: false },
  "no-public-manifest": { label: "Нет публичного manifest", tone: "neutral", canCopy: false },
  "personal-premium-link": {
    label: "Премиальный: персональная установка",
    tone: "neutral",
    canCopy: false,
  },
};
```

- В DOM присутствует только выбранный `track`; скрытая major-ветка не создаёт доступной кнопки копирования.
- `minimum`, `verified` и `maximum` показываются одной компактной моноширинной строкой с raw-значениями из manifest. Отсутствующее поле получает подпись «не указано», а не вычисленное значение.
- Required и recommended dependencies выбранного track показываются как дополнения. Карточка объясняет, что Foundry VTT предложит установить объявленные зависимости вместе с модулем.
- Карточка отдельно показывает название лицензии или честную пометку, что автор её публично не указал.
- Статус передаётся текстом и оформлением, не одним цветом.
- Для premium-карточки `installManifestUrl` и `declaredManifestUrl` равны `null`. Официальный versioned protected manifest допускается только в `sources.metadataManifestUrl`; `sources.manifestUrl` остаётся `null`, кнопки копирования нет.
- `verified` — единственный статус, разрешающий копирование. `unavailable`, `no-public-manifest` и `personal-premium-link` всегда имеют `installManifestUrl: null`.
- Внешние ссылки используют `target="_blank"` и `rel="noreferrer noopener"`.
- Описания — обычный текст; HTML из manifest не рендерится.
- На странице нет сборки, корзины, bulk copy, очереди или экспорта.

## Контракт валидатора

```ts
type ValidationLimits = {
  timeoutPerHopMs: 8_000;
  maxRedirects: 3;
  maxResponseBytes: 262_144;
};

type ManifestSnapshot = {
  initialUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  bytes: number;
  id: string;
  title: string;
  version: string;
  compatibility: Compatibility;
  declaredManifestUrl: string | null;
  downloadUrl: string | null;
  systems: string[];
  requiredDependencies: string[];
  recommendedDependencies: string[];
};

type ValidatorOptions = {
  limits?: Partial<ValidationLimits>;
  allowedInitialUrls?: ReadonlySet<string>;
  allowedRedirectHosts?: ReadonlySet<string>;
  fetchFn?: typeof fetch;
  lookupFn?: typeof import("node:dns/promises").lookup;
};

async function validateTrack(
  entry: ModuleEntry,
  track: ModuleTrack,
  options?: ValidatorOptions,
): Promise<ManifestSnapshot>;

function buildValidationPlan(entries: readonly ModuleEntry[]): {
  tracks: Array<{ entry: ModuleEntry; track: ModuleTrack }>;
  allowedInitialUrls: ReadonlySet<string>;
};
```

Инварианты:

1. Исходный URL должен точно присутствовать в version-controlled allowlist и использовать HTTPS без credentials.
2. Перед каждым hop проверяются протокол, разрешённый hostname и все DNS-адреса; private, loopback, link-local, multicast, reserved и metadata endpoints запрещены.
3. Редиректы проходят вручную, не более трёх; redirect-host allowlist отделён от initial URL allowlist.
4. Допустимые Content-Type: `application/json`, `text/json`, `text/plain`, `application/octet-stream`; после этого обязательны JSON parse и schema checks.
5. Тело читается потоково до 256 KiB; на hop действует тайм-аут 8 секунд.
6. Проверяются `id`, `title`, `version`, compatibility, `manifest`, `download`, точное совпадение `systems`, `relationships.requires` и `relationships.recommends` выбранного track, совпадение редакционной версии и попадание major в границы `minimum`/`maximum`. Raw `verified` парсится, но не используется как верхняя граница.
7. Ошибка любой verified-ветки завершает `npm run validate:data` ненулевым кодом.
8. Валидатор сети обходит только `verified` tracks. Protected metadata проверяется отдельной редакционной процедурой и никогда не попадает в allowlist копируемых install URL.

## Хранилище

- Единственный источник публичных значений: `data/modules.json` в Git; `data/modules.ts` накладывает типы и экспортирует функции для UI.
- База данных, D1, R2, cookies и Local Storage не используются.
- Выбранная версия живёт только в React state; дефолт — V14.
- Сайт не хранит историю поиска, установки или копирования.

## Конфигурация

| Параметр | Тип | Значение | Откуда | Смысл |
|---|---|---|---|---|
| `DEFAULT_FOUNDRY_MAJOR` | `13 | 14` | `14` | код | начальная вкладка |
| `VALIDATOR_TIMEOUT_MS` | number | `8000` | код | тайм-аут на hop |
| `VALIDATOR_MAX_REDIRECTS` | number | `3` | код | предел редиректов |
| `VALIDATOR_MAX_BYTES` | number | `262144` | код | предел manifest |
| `NEXT_PUBLIC_SITE_NAME` | string | codename | metadata | будет заменён перед публичным релизом |

## Секреты и доступы

Секреты не нужны. `.env` отсутствует. Premium content keys, Patreon-токены, персональные manifest URL и Foundry package release tokens запрещены в данных, fixture, DOM и логах.

## Ошибки

| Код | Когда | Поведение CLI/UI |
|---|---|---|
| `allowlist:initial-url` | URL не из каталога | CLI падает |
| `scheme:not-https` | протокол не HTTPS | CLI падает |
| `dns:private-or-reserved` | DNS/IP небезопасен | CLI падает |
| `redirect:too-many` | более трёх hop | CLI падает |
| `redirect:host-not-allowed` | неожиданный конечный хост | CLI падает |
| `http:<status>` | HTTP не 2xx | CLI падает |
| `content-type:<type>` | MIME вне allowlist | CLI падает |
| `size:limit` | manifest больше 256 KiB | CLI падает |
| `timeout:hop` | один сетевой hop превысил 8 секунд | CLI падает |
| `json:invalid` | ответ не JSON | CLI падает |
| `schema:<field>` | поле отсутствует/не совпало | CLI падает с именем поля |
| `clipboard:unavailable` | Clipboard API отсутствует/отказал | UI выделяет видимый URL и предлагает ручное копирование |
