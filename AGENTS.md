# Project context

This repository is a Nuxt module, not a site or a Nuxt layer. The module entry
is `module.mjs`; shared CMS runtime code is in `runtime/`. Develop and verify
changes through the sites that import this module.

- Keep all table definitions, content, branding, migrations and production
  Cloudflare resources in the consuming site. The CMS runtime defines no
  database tables and exposes no schema export.
- The host provides one server-only config with named exports `schema`,
  `cmsTables`, `fieldsConfig`, `graphConfig` and `staticContentTypes`.
- Access that config only on the server via `#framecore-cms/config`. The admin
  loads public field/graph metadata through authenticated `/cms/*` endpoints.
- Keep internal imports relative and Nuxt/Vue/H3 imports explicit. Published
  package files cannot depend on a host's auto-imports or folder layout.
- D1/R2 binding names are `DB` and `FILES`. Keep this scope simple.
- Edit `tailwind.config.js` for the CMS theme and base styles. `runtime/cms.css`
  loads the config and sources; the module connects Tailwind to the host's Vite
  build. Use normal Tailwind utility classes. Keep the utility generation and
  base styles inside `.cms-admin`. CMS root containers must wrap elements that use utility classes, including
  after Teleport. Do not add a global
  Preflight reset or a separate CSS build step.
- Fonts come from the host's `--font-heading` and `--font-body` CSS variables.
  Keep font files and font choices in the site; do not hardcode them in the CMS.
  The README's installation steps must explain how JavaScript-based Tailwind
  sites expose these variables after their `@config` directive, and how fonts
  inherit when the variables are absent.
- Format source with Prettier.
- Run `npm test` after relevant changes. Verify behavior and builds in the
  affected consuming sites using their own configuration and schemas.
- Preserve existing database and API behavior during extraction work.
- Record user-facing changes under `Unreleased` in `CHANGELOG.md`.
- Prepare a release by updating the package version and moving the changelog
  entries to a section with the matching version and actual release date.
  Commit the release changes before creating a matching tag. Consumers pin the
  pushed tag or commit.
