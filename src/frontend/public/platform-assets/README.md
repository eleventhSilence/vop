# Platform assets

В эту папку добавляются **статические изображения оформления платформы** (не CourseMedia).

Структура:

- `logo/platform-logo.png` — основной логотип платформы (header).
- `backgrounds/hero-background.png` — фон hero-блока на публичной главной странице.
- `backgrounds/app-background.png` — общий внешний фон приложения/платформы.

Пути к этим файлам централизованно задаются во frontend-конфиге:
`src/frontend/src/shared/config/platformAssets.ts`.

Важно:

- файлы обслуживаются из `public` (Vite public root) и доступны как `/platform-assets/...`;
- не использовать `/api/media`;
- не смешивать с медиафайлами курсов (CourseMedia).
