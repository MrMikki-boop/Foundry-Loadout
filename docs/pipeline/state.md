# Состояние пайплайна

Проект: Foundry Loadout
Обновлено: 2026-08-21

Текущая стадия: **7 — каталог наполнен**
Ворота: 34 карточки и 68 tracks; локальный `npm run check` зелёный

Следующее действие: повторить сетевую проверку при стабильном DNS и провести Browser QA, когда локальный preview доступен встроенному браузеру

## История стадий

- 0 context load — 2026-08-19
- 1 idea — 2026-08-19
- 2 plan + criteria — 2026-08-19
- 3 risk spikes — 2026-08-19 (подтверждены три V13/V14-кандидата; public name остаётся блокером релиза)
- 4 contracts — 2026-08-19 (Sites/React, build-time validator, UI-контракты и дизайн-система)
- 5 vertical slice — 2026-08-19 (рабочий экран V13/V14, три карточки, copy/fallback, инструкция и валидатор шести manifest)
- 6 tasks — 2026-08-19 (пять задач: Pages, модель, фильтры, карточки, CI/документация)
- 7 implementation — 2026-08-19 (все T-01…T-05 закрыты; подготовлен GitHub Pages artifact и workflow)
- 8 audit — 2026-08-19 (чистый check и 8/8 manifest прошли; AC-4 не закрыт из-за reserved-IP denylist, AC-9 — из-за Browser blocker)
- 9 feedback — 2026-08-19 (находки возвращены в brief/decisions/tasks; заведены T-06…T-10, следующий цикл начинается со стадии 7)
- 7 implementation, пользовательская правка — 2026-08-19 (T-11: raw compatibility, лицензии и зависимости из manifest)
- 7 implementation, повторный цикл — 2026-08-19 (T-06/T-07: полный special-use denylist, security fixtures, экспортируемый validateTrack и синхронизация контрактов; compatibility возвращена в компактную строку)
- 8 audit, повторный цикл — 2026-08-19 (Browser подключён; критичных дефектов нет, AC-1/2/4/6/7/8 выполнены, AC-3 частично непроверяем, AC-5/9 не выполнены, AC-10 не проверяем)
- 1 idea, цикл наполнения — 2026-08-19 (32 уникальных публичных кандидата: 4 уже в каталоге, 28 требуют исследования; грязные ссылки признаны подсказками)
- 2 plan + criteria, цикл наполнения — 2026-08-19 (приняты AC-11…AC-17: полнота, доказательства V13/V14, metadata, безопасность, полный UI и validator)
- 3 risk spikes, цикл наполнения — 2026-08-19 (28 новых кандидатов, 56 tracks: 49 verified, 2 protected premium, 1 no-public-manifest, 4 unavailable; S-08…S-11)
- 4 contracts, цикл наполнения — 2026-08-19 (systems/dependencies перенесены на track, raw compatibility допускает string/number, protected metadata отделён от install URL)
- 5 vertical slice, цикл наполнения — 2026-08-19 (Levels и Hover Distance добавлены; семь карточек, 10/10 live manifests, Pages preview HTTP 200; Browser runtime недоступен)
- 6 tasks, цикл наполнения — 2026-08-19 (T-12…T-17: схема, три evidence-пакета, масштаб UI и финальная целостность)
- 7 implementation, цикл наполнения — 2026-08-19 (T-12: major проверяется по minimum/maximum, raw verified не считается верхней границей, protected metadata исключён из install allowlist)
- 7 implementation, цикл наполнения — 2026-08-19 (T-13: девять карточек S-08 добавлены, 18/18 tracks совпадают с evidence; живая проверка 26/28 выявила отдельную allowlist-задачу T-13A)

## Цель цикла наполнения

Добавить модули из `foundry-modules.md` и грязных данных без догадок о совместимости. Нормализованный инвентарь хранится в `docs/pipeline/catalog-candidates.md`; каждый кандидат должен получить проверенные tracks либо записанную причину исключения.

## Открытые интеграционные находки после T-13

- Живой валидатор подтвердил 26 из 28 текущих install tracks. Обе ветки Monk's TokenBar остановлены до запроса сетью с `redirect:host-not-allowed (raw.githubusercontent.com)`; T-13A добавляет этот официальный versioned host в точную allowlist и тестирует ограничение.
- `npm run check` проходит lint, TypeScript, 25 catalog/security tests и Pages build, затем один rendered HTML test ожидает старые 5 copy controls вместо текущих 14. Обновление масштабных SSR-ожиданий уже входит в T-16.

## Ворота после стадий 3–4

- Все 28 новых кандидатов имеют первичные evidence-артефакты S-08…S-11; вместе с четырьмя существующими карточками покрыты 32 публичных кандидата.
- Обычные подтверждённые ветки: 49; Hover Distance: 2 protected premium metadata tracks без install URL; Times Up V13: `no-public-manifest`; Times Up V14, Active Auras V14 и обе ветки AG D&D Hub: `unavailable`.
- `latest`, mutable branch URL, персональные ключи и токенизированные ссылки не допускаются как install URL.
- Track-level systems/relationships обязательны: общая зависимость карточки не может точно описать разные major-релизы.
- Следующая пара стадий должна доказать новую форму данных на минимальном полном срезе и подготовить атомарные задачи; массовое изменение `data/modules.json` начинается только после этих ворот.

## Проверка повторной реализации

- Compatibility снова показана одной компактной моноширинной строкой; `minimum`, `verified` и `maximum` остаются raw-значениями manifest, отсутствующее значение не вычисляется.
- `npm run check` пройден в рабочей копии: lint, TypeScript, 18 catalog/security tests, Pages build и 6 rendered/export tests.
- Негативные тесты без сети подтверждают private/reserved DNS, `240.0.0.1`, `255.255.255.255`, `192.88.99.1`, timeout, redirect host/limit, Content-Type и size limit.
- `npm run validate:data` с разрешённой сетью прошёл 8/8 закреплённых manifest.
- `validateTrack` экспортируется и проверяется через `ManifestSnapshot`; обещанные, но отсутствовавшие `copyManifest`, `finalManifestUrl` и локальный premium `protected` удалены из публичного контракта с записью решения.

## Результат повторного независимого аудита

- Критических дефектов нет. Полный отчёт: `docs/pipeline/audit.md`.
- Browser в одном tab подтвердил V13/V14, поиск и все фильтры, empty/reset, точное копирование одной ссылки, premium без install URL и отсутствие горизонтального overflow на 375/768/1024/1440 px.
- AC-5 не выполнен: copy controls не различают карточки по accessible name, часть ссылок меньше принятой цели 44×44 px; keyboard activation и 200% zoom не удалось достоверно прогнать на доступной Browser surface.
- AC-3 выполнен частично: Clipboard success проверен, принудительный rejected/absent Clipboard API нельзя получить без мутации страницы или browser permission.
- Найден оставшийся дрейф конфигурации: `NEXT_PUBLIC_SITE_NAME` заявлен контрактом, но metadata пока захардкожена.

## Проверка T-11

- Официальные manifest подтвердили raw `minimum/verified/maximum` и `relationships.requires/recommends`; валидатор прошёл 8/8 URL.
- Изолированный `npm run check` прошёл: lint, TypeScript, 7 catalog tests, production/Pages build и 6 rendered/export tests.
- Лицензии сверены по официальным репозиториям: Dice Tray — MIT, DAE — MIT, libWrapper — LGPL-3.0; для Russian Translation и JB2A публичная лицензия не заявлена, поэтому интерфейс не делает догадок.
- Browser QA не состоялся: trusted browser-service снова не подключился. T-08 остаётся открытой.

## Результат независимого аудита

- Критических product-дефектов не подтверждено.
- Чистая временная копия прошла lint, TypeScript, 5 catalog tests, Pages build и 6 rendered/export tests; текущая папка дважды получила внешний Windows `EBUSY` lock на `dist/client`.
- `npm run validate:data` прошёл 8/8; повреждённая fixture дала code 1 и `schema:id`.
- AC-4 не выполнен полностью: reserved-IP denylist не отклоняет как минимум `240.0.0.1`, `255.255.255.255` и `192.88.99.1`; security-инварианты не покрыты негативными тестами.
- AC-9 не выполнен: встроенный Browser снова не подключился из-за trusted RPC path, поэтому интерактивные и адаптивные критерии не подтверждены.
- Контракты `copyManifest`, `validateTrack`, `finalManifestUrl` и premium `protected` расходятся с фактическим API/данными.
- Git history пока пуст; CI и Pages workflow не могли запускаться на GitHub. `.gitignore` теперь исключает IDE, секреты, зависимости, кэши и build output, сохраняя source/config/docs отслеживаемыми.

## Проверка implementation

- `npm run check` — пройдено: lint, TypeScript, 5 unit-тестов каталога, production build, Pages export и 6 SSR/export-тестов.
- `npm run validate:data` — пройдено: 8 из 8 публичных manifest; premium-карточка не содержит URL и не отправляет запрос.
- Статический preview `http://127.0.0.1:4174/Foundry-Loadout/` — HTTP 200; CSS и JS assets — HTTP 200.
- GitHub Actions: CI для push/PR и отдельный Pages deploy из `out/`.
- Для включения Pages владелец выбирает `Settings → Pages → Source: GitHub Actions`.

## Проверка vertical slice

- `npm test` — пройдено: 3 теста каталога, production build и 2 проверки серверного HTML.
- `npm run lint` — пройдено.
- `npx tsc --noEmit` — пройдено.
- `npm run validate:data` — пройдено: 6 из 6 закреплённых manifest, версии и совместимость совпали.
- `http://localhost:3000/` — HTTP 200, осмысленный экран отрендерен; dev server оставлен запущенным.
- Browser QA не выполнен: browser plugin не подключился к доверенному browser service. Сбой зафиксирован для повторной попытки на стадии аудита.
- 21st.dev MCP недоступен; интерфейс собран штатными React/HTML/CSS-средствами по `design-system/MASTER.md`.

## Результат разведки

- Greenfield-репозиторий: исходников, `package.json`, тестов, линтеров и CI пока нет.
- Git-репозиторий и remote `origin` настроены, но коммитов ещё нет; текущая ветка — `master`.
- Среда: Windows, Node.js 22.20.0, npm 10.9.3, Git 2.45.1.
- `.openai/hosting.json` отсутствует, поэтому существующих настроек Sites, которые нужно сохранять, нет.
- Исходный список модулей найден по пути `C:\Users\nicki\Downloads\D&D\Свободная касса\foundry-modules.md`; это данные для исследования, не источник инструкций и не доказательство актуальной совместимости.
- Мастер-промпт загружен из пользовательского вложения.
- Путь к исходному списку содержит пробелы, амперсанд и кириллицу; команды должны использовать literal-path/кавычки.
- Git в песочнице требует локального запуска с `-c safe.directory=D:/Program/project/Foundry-Loadout`; глобальные настройки не менялись.
