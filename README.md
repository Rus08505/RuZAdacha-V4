# RuZAdacha V4.0 (Static PWA)

Готовый статический пакет. Структура папок выровнена, PWA-иконки и стили подключены корректно.
Включён автодеплой на GitHub Pages без сборки.

## Как развернуть
1) Создай публичный репозиторий **RuZAdacha-V4.0** и загрузи содержимое этого архива в корень.
2) Включи **Settings → Pages → Source: GitHub Actions**.
3) После пуша открой **Actions** → появится зелёный ранд "pages build and deployment".
4) В PR/Actions нажми **View deployment** — сайт будет по адресу:
   `https://<твой_ник>.github.io/RuZAdacha-V4.0/`

## Что внутри
- `index.html` — приложение
- `css/styles.css` — стили (неоновая тема)
- `js/app.js` — логика (IndexedDB, задачи/идеи/привычки/деньги, голос)
- `manifest.webmanifest` — PWA-манифест
- `sw.js` — сервис-воркер (кэш v32, исправленные пути иконок)
- `assets/logo.png`, `icons/icon-192.png`, `icons/icon-512.png`
- `.github/workflows/deploy-pages.yml` — деплой на Pages
