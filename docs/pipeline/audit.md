# Аудит 2026-08-19

## Критично

- Нет.

## Стоит починить

- `app/catalog-app.tsx:153`, `app/catalog-app.tsx:200`, `app/catalog-app.tsx:201` — четыре видимых поля имеют одинаковое accessible name `Manifest URL`, а четыре кнопки — одинаковое `Скопировать manifest`; родительские `article` не имеют accessible name. В Browser DOM snapshot список элементов не позволяет отличить действие Russian Translation от Dice Tray, DAE или libWrapper. Это расходится с требованием AC-5 о понятных accessible names. Проверял на V14 в production preview.
- `app/globals.css:20`, `app/globals.css:80`, `app/globals.css:91` — DoD T-04 и `design-system/MASTER.md:57` требуют интерактивную цель не меньше 44×44 CSS px, но Browser при 1440 px измерил `Как установить` как 105.9×21.7 px, ссылки лицензий как 38.5×24 px и ссылки авторов как 114.9×37.2 px. Основные form controls и copy/reset buttons имеют 44 px, но заявленный DoD выполнен не для всех ссылок.
- `docs/pipeline/contracts.md:239`, `app/layout.tsx:5` — контракт объявляет `NEXT_PUBLIC_SITE_NAME`, но фактическая metadata жёстко содержит `Foundry Loadout`, а чтение исходников не нашло использования переменной. Публичные функции каталога и `validateTrack` совпадают с реальными экспортами, но конфигурационный контракт остаётся недействующим.

## Наблюдения

- `scripts/manifest-validator.mjs:11` — повторный security-аудит текущего финального worktree не подтвердил прежний reserved-IP дефект. `node --test tests/validator-security.test.mjs` завершился кодом 0: 11 тестов, включая private/reserved DNS, IPv4, IPv6, redirect host/limit, Content-Type, declared/streamed size, timeout и `ManifestSnapshot`. Дополнительный запуск проверил блокировку `64:ff9b::/96`, `64:ff9b:1::/48`, `2001:db8::/32`, `2002::/16`, `3fff::/20`, `5f00::/16`; два публичных адреса остались разрешены.
- `scripts/validate-manifests.mjs:15` — первый `npm run validate:data` внутри сетевой песочницы завершился кодом 1 с `fetch failed` для 8 из 8 URL. Повторный запуск с разрешённой сетью завершился кодом 0: все 8 manifest проверены. Вывод по AC-4 сделан по сетевому запуску, а не по чтению кода.
- `scripts/manifest-validator.mjs:130` — намеренно испорченная in-memory fixture с неверным `id` завершилась кодом 1 и точной ошибкой `schema:id (corrupt != expected)`.
- `data/modules.ts:73`, `scripts/manifest-validator.mjs:154` — runtime-проверка экспортов показала `getTrack`, `filterCatalog`, `statusPresentation` и `validateTrack`; `getTrack` вернул V13-ветку, `filterCatalog` — четыре verified V14-записи. Удалённых из контракта `copyManifest` и `finalManifestUrl` среди публичных экспортов нет.
- `docs/pipeline/plan.md:30` — Clipboard success проверен запуском: после sentinel в clipboard нажатие первой кнопки записало точный V14 URL Russian Translation и показало `Manifest-ссылка скопирована`; видимое readonly-поле по focus выделилось целиком (`selectionStart=0`, `selectionEnd=84`). Rejected/absent Clipboard API нельзя было принудительно получить через доступный Browser без мутации страницы или browser permission, поэтому catch/fallback не засчитан как запускная проверка.
- `docs/pipeline/plan.md:46` — Browser подключился и весь QA прошёл в одном созданном tab. Семантические click/fill/select/clipboard работали, но доступные `Tab`, `Shift+Tab`, `Enter`, `Space` и `Ctrl++` не меняли focus/state/zoom; сделать IAB видимым из субагентского task нельзя. Это не доказательство дефекта продукта, поэтому keyboard activation и 200% zoom помечены непроверяемыми. Отдельно Browser подтвердил видимый focus ring 3 px `rgb(253, 230, 138)` на сфокусированном search input.
- `docs/pipeline/plan.md:46` — viewport override 375/768/1024/1440 px дал `documentElement.scrollWidth === clientWidth` на каждой ширине; проверенные header, sections, filters, cards, copy row, compatibility и toast не вышли за viewport. Compatibility на V13/V14 оставалась компактной raw-строкой, включая `maximum: не указано` без вычисления значения.
- `data/modules.json:175` — premium-сценарий проверен в Browser после снятия `Только проверенные` и применения search/category/license/system: показана ровно JB2A, в карточке 0 manifest inputs, 0 copy buttons, нет install URL, есть только `https://www.patreon.com/JB2A/about` и сообщение о персональной установке.
- `app/catalog-app.tsx:27` — production preview загрузил Pages CSS и три JS chunks по `/Foundry-Loadout/_next/...`; Browser console не содержала warning/error. `npm run preview:pages` фактически поднял `http://127.0.0.1:4174/Foundry-Loadout/`.
- `package.json:13` — финальный повтор `npm run check` завершился кодом 0: lint, TypeScript, 18 catalog/security tests, Pages build и 6 rendered/export tests. Отдельный `npm run build:pages` также завершился кодом 0 и создал artifact с base `/Foundry-Loadout/`.
- `tests/catalog.test.mjs:101` — `rg` не нашёл production-import из `docs/pipeline/spikes`, TODO/FIXME, абсолютных локальных путей или захардкоженных секретов в `app`, `data`, `scripts`, `tests`, `worker` и workflows.

## Acceptance criteria — сводка

| AC | Статус | Как проверено |
|---|---|---|
| AC-1 | Выполнен | В одном Browser tab переключены V14 → V13 → V14. Для четырёх verified-карточек одновременно менялись только видимые version, compatibility и manifest URL; DOM содержал четыре URL выбранной ветки. |
| AC-2 | Выполнен | Browser: search `active effects`, затем category `Автоматизация`, access `free`, system `dnd5e`, verified on/off оставляли только DAE; конфликт с `premium` дал 0, empty state и рабочий reset; premium-комбинация дала только JB2A. |
| AC-3 | Не проверяем полностью | Success и точное одиночное значение clipboard подтверждены; URL видим и выделяется целиком. Отказ/отсутствие Clipboard API нельзя было получить на доступной Browser surface без искусственной мутации страницы. |
| AC-4 | Выполнен | `npm run validate:data` с сетью: 8/8, exit 0; security tests: 11/11; corrupted fixture: exit 1, `schema:id`; финальный `npm run check`: exit 0. |
| AC-5 | Не выполнен | Widths и отсутствие horizontal overflow подтверждены, focus ring измерен. Accessible names copy controls не различают карточки; T-04 нарушает 44px target contract. Tab/Shift+Tab, Enter/Space и 200% zoom дополнительно не удалось достоверно прогнать из субагентского IAB. |
| AC-6 | Выполнен | `npm run build:pages` и `npm run preview:pages`; Browser загрузил статический HTML/CSS/JS, поиск, фильтры и copy работали без API/БД/секретов и без console errors. |
| AC-7 | Выполнен | 7 catalog tests + 11 security tests; 8 live manifest; premium tracks имеют три URL-поля `null`; Browser premium-карточка не рендерит URL/copy. |
| AC-8 | Выполнен | SSR tests и Browser DOM: справочник, неофициальный disclaimer, безопасные внешние ссылки по исходному DOM-контракту, кнопка `Скопировать manifest`, инструкция из пяти шагов. |
| AC-9 | Не выполнен | Отчёт и большая часть одного Browser-сценария выполнены, но AC-3 fallback, keyboard activation и 200% zoom не получили запускного доказательства; остаются две accessibility-находки AC-5. |
| AC-10 | Не проверяем | Публичного HTTPS-релиза, отчётов `$launch-security`/`$launch-web` и `release.md` нет; стадия релиза не запущена. |
