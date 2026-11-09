# Changelog

Notable changes to Framecore CMS. See the [README](./README.md) for setup and
integration instructions.

## Unreleased

## 0.3.3 - 2026-11-09

### Fixed

- The optional Nuxt Image adapter uses an import that Nuxt can transform,
  preventing the `#imports` warning when opening `/admin` in development.

## 0.3.2 - 2026-11-09

### Fixed

- Stored-image previews reuse the site's Nuxt Image provider for 80px WebP
  renditions when available, keeping direct image URLs as a fallback. Previews
  load lazily, including in collapsed rows. Uploads and original files are
  unchanged, and Nuxt Image remains optional.

## 0.3.1 - 2026-11-06

### Fixed

- Cloudflare HTTPS deployments use the original Worker request URL for origin
  validation, secure cookies and password-reset links. Same-site login no
  longer fails when the server adapter reconstructs an HTTP request. Cross-site
  requests remain blocked and forwarded host/protocol headers are not trusted.

## 0.3.0 - 2026-11-06

### Fixed

- Password reset tokens require an exact match, expire after 30 minutes and
  can only be consumed once. Unknown email addresses return the same generic
  response; reset links use the site's own origin and the stored email address.
- Automatic archiving copies and deletes rows in one D1 transaction. Failed
  writes preserve all source rows, and concurrent requests do not duplicate them.
- Admin request failures now appear in the UI, preserve unsaved edits and clear
  busy indicators. Expired sessions return to login with an explanation.
  Session errors use the existing message box below the login form.
- The initial session spinner keeps its circular shape and only appears when
  the session check takes longer than 200 milliseconds, avoiding a brief flash.

### Changed

- Replaced persisted administrator passwords with encrypted HttpOnly session
  cookies and server-enforced expiry. Requires a random server-only
  `NUXT_CMS_SESSION_PASSWORD` of at least 32 characters in every site environment.
  No schema migration is needed. Existing users must log in again, and older
  password-reset links must be requested again.
- The CMS no longer installs `pinia-plugin-persistedstate`. Custom admin API
  clients must use the login session cookie; public content APIs are unchanged.

- Updated all direct dependencies to their latest stable versions. Nuxt 4.6.4
  and Node.js 22.22.3+, 24.15.0+ or 26+ are now required.
- Server utilities now come from `nuxt/server`, removing the CMS's runtime H3
  dependency and Nitro peer dependency. H3 2 is used only for API tests.
- Expanded the environment reference with per-site configuration, required and
  optional variables, matching Basic-auth values and Cloudflare binding requirements.
  Server-side variables are listed first, followed by a separate public section.

## 0.2.0 - 2026-11-06

### Added

- A reusable Nuxt 4 module providing `/admin`, the `/cms/*` API, login, password
  reset, file uploads, configurable forms, charts and CSV export.
- A server-only site configuration and an authenticated metadata endpoint for
  graph settings and JSON content templates.
- Support for the site's heading and body fonts through `--font-heading` and
  `--font-body`, with inheritance when the variables are absent.

### Changed

- All table definitions, including `users` and `static_content`, and all
  migrations belong to the consuming site. Its CMS configuration exports the
  site's schema to the module.
- CMS styles use a dedicated Tailwind configuration, compile through the
  consuming site's Vite build and stay scoped to the CMS container.
- Statistics lists and CSV exports use the site's visible fields and labels.
  Hidden fields are omitted, dates share the same formatting and CSV filenames
  use the selected table's ID.
- Statistics is enabled per table through `viewMode: "graph"` and a matching
  non-empty `graphConfig` entry. Sites without statistics show no statistics view.

### Removed

- The playground application and its development configuration.
- The separate CSS generation script and committed generated stylesheet.
