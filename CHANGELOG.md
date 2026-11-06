# Changelog

Notable changes to Framecore CMS. See the [README](./README.md) for setup and
integration instructions.

## Unreleased

### Changed

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
