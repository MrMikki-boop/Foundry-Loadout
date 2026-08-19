# Risk spikes — стадия 3

Дата проверки: 2026-08-19.

## S-01 — Есть ли три честных кандидата с отдельными ветками для Foundry VTT 13 и 14?

**Скрипт:** `spikes/01-manifest-tracks.mjs`

**Ответ:** да.

**Факты:** скрипт реально запросил для каждой ветки три независимых первичных источника: manifest релиза, страницу релиза автора и запись официального каталога. Все 18 запросов вернули HTTP 200. Команда:

```powershell
node docs/pipeline/spikes/01-manifest-tracks.mjs
```

Подтверждённый минимальный набор:

| Карточка | Foundry VTT 13 | Foundry VTT 14 | Первичные источники |
|---|---|---|---|
| Russian Translation (`ru-ru`) | manifest `13.351.54`, `minimum=13`, `verified=13`, `maximum=13` | manifest `14.366.1`, `minimum=14`, `verified=14`, `maximum=14` | [каталог](https://foundryvtt.com/packages/ru-ru), [V13 manifest](https://github.com/phenomen/foundry-vtt-ru/releases/download/release-v13/module.json), [V13 release](https://github.com/phenomen/foundry-vtt-ru/releases/tag/release-v13), [V14 manifest](https://github.com/phenomen/foundry-vtt-ru/releases/download/release-v14/module.json), [V14 release](https://github.com/phenomen/foundry-vtt-ru/releases/tag/release-v14) |
| Dice Tray (`dice-calculator`) | pinned manifest `3.5.5`, `minimum=13`, `verified=13`; официальный каталог помечает ветку как 13–13 | pinned manifest `3.7.2`, `minimum=14`, `verified=14`; каталог помечает ветку как 14–14 | [каталог](https://foundryvtt.com/packages/dice-calculator), [V13 manifest](https://github.com/mclemente/fvtt-dice-tray/releases/download/3.5.5/module.json), [V13 release](https://github.com/mclemente/fvtt-dice-tray/releases/tag/3.5.5), [V14 manifest](https://github.com/mclemente/fvtt-dice-tray/releases/download/3.7.2/module.json), [V14 release](https://github.com/mclemente/fvtt-dice-tray/releases/tag/3.7.2) |
| Dynamic Active Effects (`dae`) | manifest `13.0.29`, диапазон `13.0…13.999`, verified `13.351` | manifest `14.0.12`, диапазон `14…14.999`, verified `14.356` | [каталог](https://foundryvtt.com/packages/dae), [V13 manifest](https://gitlab.com/tposney/dae/-/releases/v13.0.29/downloads/module.json), [V13 release](https://gitlab.com/tposney/dae/-/releases/v13.0.29), [V14 manifest](https://gitlab.com/tposney/dae/-/releases/v14.0.12/downloads/module.json), [V14 release](https://gitlab.com/tposney/dae/-/releases/v14.0.12) |

Дословные сокращённые строки вывода:

```text
Russian Translation major=13 status=200 version=13.351.54 compatibility={minimum:13,verified:13,maximum:13}
Russian Translation major=14 status=200 version=14.366.1 compatibility={minimum:14,verified:14,maximum:14}
Dice Tray major=13 status=200 version=3.5.5 compatibility={minimum:13,verified:13}
Dice Tray major=14 status=200 version=3.7.2 compatibility={minimum:14,verified:14}
Dynamic Active Effects major=13 status=200 version=13.0.29 compatibility={minimum:13.0,verified:13.351,maximum:13.999}
Dynamic Active Effects major=14 status=200 version=14.0.12 compatibility={minimum:14,verified:14.356,maximum:14.999}
```

У Dice Tray raw manifest не содержит `maximum`; точная привязка 13–13 и 14–14 подтверждается официальным каталогом. Это не повод дорисовывать отсутствующее поле в данных: нужно хранить raw compatibility и отдельно редакционную целевую major-ветку со ссылкой на каталог. DAE годится для демонстрации зависимостей, но карточка должна предупреждать, что это модуль автоматизации для `dnd5e`, а не универсальный QoL.

**Следствие для плана/контрактов:** вертикальный срез может использовать эти три карточки. Одна карточка хранит два `tracks`; у track отдельно хранятся `installManifestUrl`, raw `compatibility`, `targetMajor`, версия, дата проверки и три source URL. Нельзя выводить `maximum`, которого нет в manifest. Для DAE контракт должен хранить системную область и `relationships.requires`.

## S-02 — Можно ли использовать `releases/latest` как стабильную ссылку для V13 и V14?

**Скрипт:** `spikes/02-mutable-latest.mjs`

**Ответ:** нет.

**Факты:** один прогон трёх реальных URL Dice Tray показал, что mutable `latest` сейчас отдаёт `4.0.5` с `minimum=14`, тогда как pinned V13 отдаёт `3.5.5` с `minimum=13`, а pinned V14 — `3.7.2` с `minimum=14`. Все ответы HTTP 200; время 98–522 мс. [Текущий latest manifest](https://github.com/mclemente/fvtt-dice-tray/releases/latest/download/module.json), [pinned V13](https://github.com/mclemente/fvtt-dice-tray/releases/download/3.5.5/module.json), [pinned V14](https://github.com/mclemente/fvtt-dice-tray/releases/download/3.7.2/module.json).

```text
latest     version=4.0.5 compatibility={minimum:14,verified:14}
pinned-v13 version=3.5.5 compatibility={minimum:13,verified:13}
pinned-v14 version=3.7.2 compatibility={minimum:14,verified:14}
```

Оба pinned manifest Dice Tray при этом содержат внутреннее поле `manifest`, указывающее на mutable `latest`. Значит, URL, по которому каталог устанавливает конкретную ветку, и update URL внутри загруженного manifest — разные сущности и не обязаны совпадать.

**Следствие для плана/контрактов:** в публичной карточке копируется только `installManifestUrl`, закреплённый на проверенном релизе. Поле `declaredManifestUrl` хранится отдельно для аудита. `latest` допустим только для ветки, которую CI повторно проверяет перед каждой публикацией и которая не обслуживает старую major-версию.

## S-03 — У premium-модулей отсутствует публичный manifest и нужно ли скрывать установочную ссылку?

**Скрипт:** `spikes/03-premium-manifest.mjs`

**Ответ:** частично.

**Факты:** предположение «публичного manifest нет всегда» неверно. Официальная карточка [Dice VFX](https://foundryvtt.com/packages/dice-vfx) и его [public metadata manifest](https://r2.foundryvtt.com/packages-public/dice-vfx/module.json) вернули HTTP 200. Manifest содержит `protected: true`, версию `1.2.1` и не содержит `download`. Официальный [Publisher Handbook](https://foundryvtt.com/article/publisher-handbook/) требует для Premium Content System публичный `packages-public/.../module.json`, `protected: true`, отсутствие `download` и выдаёт покупателю content key.

```text
catalog.status=200 manifest.status=200 id=dice-vfx version=1.2.1 protected=true hasDownload=false
```

Публичный защищённый manifest — это метаданные, а не общедоступный архив. Персональный key, Patreon URL, подписочная ссылка или приватный архив не являются публичными данными каталога.

**Следствие для плана/контрактов:** premium-карточка хранит `access="premium"`, официальный `purchaseUrl`, `installMode="publisher"` и может хранить только официальный protected metadata URL как source. Кнопки копирования manifest нет. Токены, activation URL с `?key=...`, приватные manifest и `download` никогда не входят в репозиторий или DOM.

## S-04 — Работает ли Clipboard API на HTTPS с понятным fallback?

**Скрипт:** `spikes/04-clipboard-fallback.mjs`; ручная fixture: `spikes/04-clipboard-fixture.html`.

**Ответ:** да.

**Факты:** по [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) метод широко поддерживается, но доступен только в secure context и может завершиться `NotAllowedError`. По [MDN Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) production должен использовать HTTPS; localhost считается потенциально доверенным для локальной проверки. Одноразовый прогон подтвердил три ветки управления:

```text
success  copied=true  fallback=null
missing  copied=false fallback=select-visible-url
rejected copied=false fallback=select-visible-url error=NotAllowedError
```

Fixture всегда оставляет readonly URL видимым; при отсутствии API или отказе выделяет поле и сообщает, что ссылку нужно скопировать вручную.

**Следствие для плана/контрактов:** копирование запускается только явным нажатием, использует feature detection и обрабатывает rejected Promise. URL остаётся видимым и выделяемым независимо от результата; live-region сообщает успех или ручной fallback. Реальное поведение браузеров проверяется на стадии 8 и на HTTPS после публикации.

## S-05 — Можно ли сохранить полностью статическую архитектуру и опубликовать её через Sites?

**Скрипт:** `spikes/05-static-sites.mjs`

**Ответ:** частично.

**Факты:** требуемый сценарий не нуждается в runtime API, БД, секретах или вводе внешних URL посетителем. Прогон на Node `v22.20.0` показал, что production-кода и `.openai/hosting.json` пока нет, поэтому реальная Sites-сборка ещё не доказана:

```text
hostingJsonExists=false productionEntries=[]
staticRuntimeNeeds={api:false,database:false,secrets:false,userSuppliedUrls:false}
sitesBuildProofAvailable=false
```

Доступный локальный контракт Sites требует сохранить `.openai/hosting.json`, использовать его стартовую архитектуру и выдавать Cloudflare Worker-compatible ESM; это не требует добавлять API, D1, R2, авторизацию или серверное состояние в продукт.

**Следствие для плана/контрактов:** данные каталога импортируются в build, поиск/фильтры/копирование работают только в браузере, а сетевой валидатор запускается только локально/в CI. На стадии вертикального среза нужно инициализировать Sites, сохранить созданный hosting config и доказать `npm run build`; до этого совместимость с Sites остаётся открытым интеграционным пунктом, но не блокирует статическую архитектуру.

## S-06 — Реализуем ли безопасный build-time validator внешних manifest URL?

**Скрипт:** `spikes/06-validator-ssrf.mjs`

**Ответ:** да, при редакционной allowlist и отсутствии пользовательского ввода.

**Факты:** одноразовый валидатор пропустил реальный pinned Dice Tray manifest за 425 мс: проверил HTTPS, точное вхождение исходного URL в allowlist, DNS каждого hop, вручную прошёл один redirect (GitHub `302` → `release-assets.githubusercontent.com` `200`), принял фактический `application/octet-stream`, ограничил тело 256 KiB и распарсил 1 817 байт JSON (`id=dice-calculator`, `version=3.5.5`). Отдельные пробы вернули:

```text
live-valid       ok=true  redirects=1 contentType=application/octet-stream bytes=1817
reject-http      ok=false error=scheme:not-https
reject-private-ip ok=false error=dns:private-or-reserved
reject-unlisted  ok=false error=allowlist:initial-url
```

Официальные GitHub и GitLab release assets реально отдаются как `application/octet-stream`, поэтому политика «только application/json» отвергнет валидные manifests. Допустимый MIME-набор должен быть узким (`application/json`, `text/json`, `text/plain`, `application/octet-stream`), а окончательным доказательством содержимого остаётся успешный JSON parse и схема. DNS preflight перед обычным `fetch` имеет окно TOCTOU; оно не годится как единственная защита для произвольного пользовательского хоста.

**Следствие для плана/контрактов:** runtime endpoint не создаётся. Валидатор принимает только URL, уже перечисленные в version-controlled exact allowlist, повторяет HTTPS/DNS/host-проверку на каждом redirect, ограничивает 3 redirects, 8 секунд на hop и 256 KiB, затем проверяет MIME, JSON и manifest-схему. Redirect-хосты разрешаются отдельно и только после запроса к allowlisted исходнику. Если позже появится пользовательский ввод, этот дизайн непригоден без pinned DNS/изолированного fetch-сервиса; такая возможность остаётся non-goal.

## S-07 — Безопасно ли публично выпускать проект под рабочим именем `Foundry Loadout`?

**Скрипт:** `spikes/07-branding.mjs`

**Ответ:** нет.

**Факты:** запрос официального [Branding Guide](https://foundryvtt.com/article/branding/) вернул HTTP 200 и 11 614 байт. Автоматические проверки нашли все пять релевантных правил:

```text
mentionsAvoidShortFoundry=true
mentionsFoundryVttAlternative=true
forbidsFullOfficialNameInTitle=true
warnsAgainstEndorsement=true
warnsAgainstVerificationClaim=true
```

Guide просит не сокращать название ПО до `Foundry`, допускает `Foundry VTT` или `FVTT`, не использовать `Foundry Virtual Tabletop` в названии проекта и не создавать впечатление одобрения или проверки со стороны Foundry Gaming LLC. `Foundry Loadout` начинается именно с нежелательного сокращения и звучит как название официального продукта.

**Следствие для плана/контрактов:** `Foundry Loadout` остаётся только codename. До публичного релиза нужен нейтральный public name (либо письменное разрешение Foundry Gaming LLC). В интерфейсе и metadata обязательна заметная формулировка «Неофициальный каталог сообщества; не связан с Foundry Gaming LLC», нельзя использовать официальный логотип как знак проверки и нельзя называть редакционный статус официальной сертификацией.

## Итог стадии

- Допущение о трёх ветвящихся карточках подтверждено: `ru-ru`, `dice-calculator`, `dae`.
- `latest` исключён для закреплённых V13-треков; install URL и объявленный update URL моделируются отдельно.
- Premium-модель уточнена: protected metadata URL возможен, публичной копируемой download/install-ссылки нет.
- Статическая архитектура сохраняется; реальный Sites build остаётся доказать вертикальным срезом.
- Валидатор остаётся build-time/CI-инструментом над version-controlled allowlist.
- Публичный релиз под именем `Foundry Loadout` заблокирован до переименования или письменного разрешения.
