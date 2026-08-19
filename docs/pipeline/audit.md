# Аудит 2026-08-19

## Критично

- Подтверждённых критических дефектов продуктового кода не обнаружено. AC-9 при этом не закрыт: обязательная браузерная часть аудита не состоялась из-за недоступности Browser, см. наблюдения.

## Стоит починить

- `scripts/validate-manifests.mjs:25` — denylist не покрывает все адреса, которые контракт запрещает как reserved: прямой запуск той же `BlockList` показал `false` для `240.0.0.1`, `255.255.255.255` и `192.88.99.1`. DNS-ответ с таким адресом пройдёт `assertPublicDns`, хотя `docs/pipeline/contracts.md:206` требует отклонять все reserved-адреса. Это не выполняет security-часть AC-4; текущий exact hostname allowlist уменьшает практический риск, но не устраняет расхождение.
- `docs/pipeline/contracts.md:134` — публичный контракт обещает `copyManifest(track, clipboard): Promise<CopyResult>`, но `app/catalog-app.tsx:49` содержит внутренний обработчик `copyManifest(key, url)`, который ничего не возвращает. Аналогично, `validateTrack(...): Promise<ManifestSnapshot>` из `docs/pipeline/contracts.md:196` отсутствует как экспортируемая функция: `scripts/validate-manifests.mjs:135` запускает монолитный CLI-цикл. Видимый happy path реализован, но реальные сигнатуры не соответствуют контрактам и Clipboard/security-ветки нельзя тестировать через заявленный API.
- `tests/catalog.test.mjs:15` — в 11 автоматических тестах нет негативных тестов тайм-аута, redirect limit/host, Content-Type, size limit и private/reserved DNS для `scripts/validate-manifests.mjs`; `npm run check` не запускает даже mocked validator. В ходе аудита ad-hoc повреждённый ответ корректно завершил CLI кодом 1 с `schema:id` для 8/8 веток, но регрессии остальных security-инвариантов остаются без автоматической защиты, что ослабляет DoD T-05 и AC-4.
- `.github/workflows/ci.yml:1` — `git status --short` показывает все файлы проекта, включая оба workflow, как `??`; `git ls-files` пуст. Поэтому CI и Pages сейчас существуют только в рабочей папке и не могут запускаться GitHub. Перед проверкой AC-10 проект нужно добавить в историю и фактически прогнать `.github/workflows/pages.yml:30`–`.github/workflows/pages.yml:50`.

## Наблюдения

- `docs/pipeline/plan.md:82` — встроенный Browser не подключился: `Trusted RPC dependency must resolve within a configured trusted code path: file:///C:/Users/nicki/.codex/plugins/cache/openai-bundled/browser/26.814.41407/scripts/browser-service.mjs`. Поэтому на одном открытом экране не подтверждены переключение V13/V14, комбинированные фильтры и reset пустого состояния, Clipboard success/fallback, premium-карточка, Tab/Shift+Tab, Enter/Space, focus, 360/375 px, 200% zoom и горизонтальный overflow. Подмена другим browser surface не выполнялась.
- `package.json:18` — `npm run check` в текущей рабочей папке дважды упал с `EBUSY` при удалении `dist/client`; тот же исходный набор в чистой временной копии с теми же `node_modules` прошёл полностью: lint, TypeScript, 5 catalog tests, Pages build и 6 rendered/export tests. Это похоже на внешний lock текущего build output, а не на воспроизводимый дефект чистой сборки.
- `scripts/export-pages.mjs:26` — статический preview `http://127.0.0.1:4174/Foundry-Loadout/` вернул 200; все найденные CSS/JS/favicon URL с `/Foundry-Loadout/` также вернули 200. Это подтверждает текущий Pages base path только HTTP-проверкой, не визуально.
- `data/modules.json:176` — premium-запись содержит `installManifestUrl`, `declaredManifestUrl` и `sources.manifestUrl` только как `null`; unit-тест подтверждает отсутствие копируемого manifest. Интерактивное отображение карточки не проверено из-за Browser blocker.
- `.gitignore:25` — скан исходников и конфигурации не нашёл ключей, токенизированных URL, импортов из `docs/pipeline/spikes` или абсолютных локальных путей в production-коде. Локальные `localhost`/`127.0.0.1` встречаются только в preview-сервере и SSR-тесте; абсолютный `C:\Users\...` остаётся только в процессных документах `docs/pipeline/brief.md:44` и `docs/pipeline/state.md:46`.
- `docs/pipeline/contracts.md:75` — поле `finalManifestUrl` отсутствует в фактическом `ModuleTrack` (`data/modules.ts:23`), а обещанный premium-флаг `protected: true` из `docs/pipeline/contracts.md:167` отсутствует в данных. Безопасное поведение premium сейчас обеспечивается статусом и тремя `null`, но контракт данных дрейфует.

## Acceptance criteria — сводка

| AC | Статус | Как проверено |
|---|---|---|
| AC-1 | Не проверяем | Unit-тест подтвердил по одному track V13/V14 на запись, SSR — только выбранную V14-ветку. Само переключение и отсутствие старой ветки в живом DOM не проверены из-за Browser blocker. |
| AC-2 | Не проверяем | `filterCatalog` прошёл AND-тест query/category/license/system/status; исходник содержит count, empty state и reset. Последовательное взаимодействие в UI не проверено. |
| AC-3 | Не проверяем | SSR содержит ровно четыре URL и четыре copy-кнопки для V14; код fallback фокусирует и выделяет readonly input. Реальные Clipboard success/rejection не запускались. |
| AC-4 | Не выполнен | Сетевой `npm run validate:data`: 8/8 OK; mocked повреждённый ответ: код 1 и конкретный `schema:id` 8/8. Reserved denylist неполон, поэтому критерий допустимого конечного адреса не выполнен полностью. |
| AC-5 | Не проверяем | CSS задаёт focus-visible, 44 px targets и мобильный breakpoint, но обязательные 360/375/768/1024/1440, 200%, keyboard и overflow проверки в Browser не состоялись. |
| AC-6 | Не проверяем | Чистая временная копия прошла `npm run check`, export создан, preview и assets отвечают 200, runtime API/DB/secrets не найдены. Search/filter/copy в открытом браузере не проверены. |
| AC-7 | Выполнен | Catalog tests, 8/8 live manifests и скан данных подтвердили отдельные tracks, HTTPS pinned URLs, даты/источники и отсутствие premium manifest/credentials/latest install URL. |
| AC-8 | Выполнен | Rendered HTML tests и проверка исходника подтвердили справочник, disclaimer, безопасный `rel`, отсутствие «Скачать модуль» и инструкцию из пяти шагов. |
| AC-9 | Не выполнен | Автоматическая часть проведена и отчёт записан, но обязательный единый браузерный проход не выполнен; остаётся открытая находка AC-4. |
| AC-10 | Не проверяем | Нет launch-аудитов, production HTTPS URL и `release.md`; workflow также ещё не находится в Git history. |
