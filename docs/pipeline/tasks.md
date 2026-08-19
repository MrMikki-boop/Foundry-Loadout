# Задачи

- [x] T-01 — Статический экспорт для GitHub Pages
      Файлы: `package.json`, `scripts/export-pages.mjs`, `.github/workflows/pages.yml`, `tests/pages-export.test.mjs`, `docs/pipeline/contracts.md`
      Делаем: сохраняем Sites/Vinext-сборку и добавляем воспроизводимый статический артефакт `out/` с base path `/Foundry-Loadout/`; GitHub Actions проверяет и публикует артефакт Pages.
      DoD: `npm run build:pages` создаёт `out/index.html`, `.nojekyll` и рабочие ссылки на существующие CSS/JS; `node --test tests/pages-export.test.mjs` зелёный.
      Исполнитель: главный цикл
      Зависит от: —

- [x] T-02 — Полная модель выдачи и безопасный premium-статус
      Файлы: `data/modules.json`, `data/modules.ts`, `scripts/validate-manifests.mjs`, `tests/catalog.test.mjs`, `docs/pipeline/contracts.md`
      Делаем: добавляем проверенный libWrapper для V13/V14 и карточку JB2A Patreon без публичной установочной ссылки; реализуем `filterCatalog` и представление всех статусов.
      DoD: тесты доказывают разные категории, системы, лицензии и статусы; premium-запись не содержит manifest/download URL; все публичные manifest проходят валидатор.
      Исполнитель: главный цикл
      Зависит от: —

- [x] T-03 — Поиск, фильтры и пустая выдача
      Файлы: `app/catalog-app.tsx`, `app/globals.css`, `tests/rendered-html.test.mjs`
      Делаем: поиск по названию, ID и описанию; фильтры категории, лицензии, системы и «только проверенные»; число результатов и сброс при пустой выдаче.
      DoD: фильтры комбинируются через AND, число карточек меняется, пустая выдача содержит кнопку сброса; элементы имеют связанные labels.
      Исполнитель: главный цикл
      Зависит от: T-02

- [x] T-04 — Полные карточки и состояния интерфейса
      Файлы: `app/catalog-app.tsx`, `app/globals.css`, `tests/rendered-html.test.mjs`
      Делаем: показываем лицензию, raw compatibility, обязательные и рекомендуемые зависимости, статус и предупреждение; копирование доступно только для verified URL; уточняем инструкцию и мобильную компоновку.
      DoD: HTML содержит все поля контракта; premium-карточка ведёт на официальную страницу и не рендерит кнопку копирования; focus/контраст/44px targets заданы стилями.
      Исполнитель: главный цикл
      Зависит от: T-02, T-03

- [x] T-05 — CI, регрессии и документация запуска
      Файлы: `package.json`, `.github/workflows/ci.yml`, `tests/*.mjs`, `README.md`, `docs/pipeline/brief.md`, `docs/pipeline/state.md`
      Делаем: собираем локальные проверки в одну команду, проверяем отсутствие секретов/latest, статический экспорт и SSR; описываем GitHub Pages handoff.
      DoD: `npm run check` и `npm run validate:data` зелёные; README содержит точные команды и единственное действие владельца репозитория для включения Pages.
      Исполнитель: главный цикл
      Зависит от: T-01, T-02, T-03, T-04

- [ ] T-06 — Закрыть reserved-IP обходы валидатора
      Приоритет: P1 до публичного релиза
      Файлы: `scripts/validate-manifests.mjs`, `tests/validator-security.test.mjs`, `package.json`
      Делаем: дополняем IPv4/IPv6 special-use denylist и выносим проверяемые части валидатора так, чтобы тесты без сети покрывали private/reserved DNS, timeout, redirect host/limit, Content-Type и size limit.
      DoD: перечисленные негативные fixtures завершаются конкретными кодами ошибок; `240.0.0.1`, `255.255.255.255` и `192.88.99.1` отклоняются; `npm run check` запускает security-набор и проходит в чистой рабочей копии.
      Исполнитель: главный цикл
      Зависит от: T-05

- [ ] T-07 — Устранить дрейф контрактов
      Приоритет: P2
      Файлы: `docs/pipeline/contracts.md`, `data/modules.ts`, `app/catalog-app.tsx`, `scripts/validate-manifests.mjs`, `tests/*.mjs`
      Делаем: принимаем одно решение по `copyManifest`, `validateTrack`, `finalManifestUrl` и premium `protected`: реализуем тестируемые публичные границы либо сужаем контракт до реально используемого внутреннего API.
      DoD: все заявленные типы и сигнатуры существуют в коде и покрыты тестами либо удалены из контракта с записью причины в `decisions.md`; premium по-прежнему не раскрывает install URL.
      Исполнитель: главный цикл
      Зависит от: T-06

- [ ] T-08 — Повторить обязательный Browser QA
      Приоритет: P1 до публичного релиза
      Файлы: `docs/pipeline/audit.md`
      Делаем: после восстановления trusted browser-service на одном открытом экране проверяем V13/V14, все фильтры, пустое состояние/reset, Clipboard success/fallback, premium-карточку, Tab/Shift+Tab, Enter/Space, focus, 375/768/1024/1440 px, 200% zoom и отсутствие горизонтального overflow.
      DoD: AC-1, AC-2, AC-3, AC-5, browser-часть AC-6 и AC-9 получают запускные доказательства; найденные дефекты исправлены или заведены отдельными задачами.
      Исполнитель: свежий аудитор
      Зависит от: T-06, T-07, доступный Browser

- [ ] T-09 — Снять блокер публичного имени
      Приоритет: P1 до публичного релиза
      Файлы: UI, metadata, `README.md`, `.github/workflows/pages.yml`, документация пайплайна
      Делаем: пользователь выбирает нейтральное публичное имя либо предоставляет письменное разрешение на `Foundry Loadout`; после выбора синхронизируем название и Pages base path.
      DoD: название соответствует Foundry VTT Brand Guidelines или подтверждено правообладателем; production URL/base path и все тексты используют одно имя.
      Исполнитель: пользователь + главный цикл
      Зависит от: решение пользователя

- [ ] T-10 — Добавить проект в Git и доказать GitHub Actions
      Приоритет: P1 до публичного релиза
      Файлы: весь утверждённый source tree, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`
      Делаем: после разрешения пользователя формируем первый осмысленный коммит, публикуем ветку и запускаем CI/Pages; локальные IDE-файлы, секреты, зависимости и build outputs остаются вне Git.
      DoD: `git ls-files` содержит исходники и workflow, но не `.idea`, `.env*`, `node_modules`, `dist` и `out`; удалённые CI/check и Pages artifact завершаются успешно.
      Исполнитель: главный цикл
      Зависит от: T-06, T-07, T-08, T-09, разрешение пользователя
