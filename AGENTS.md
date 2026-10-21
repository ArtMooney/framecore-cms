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
- Edit `styles/cms.css`; rebuild and commit `runtime/cms.css`. Never introduce
  host-wide styles or depend on the host's Tailwind setup. All generated
  selectors must require `.cms-admin`.
- Format source with Prettier. Generated CSS is excluded from formatting.
- Run `npm test` and rebuild the CSS with `npm run build:css` when styles or
  utility classes change. Verify behavior and builds in the affected consuming
  sites using their own configuration and schemas.
- Preserve existing database and API behavior during extraction work.
- Release by bumping the package version and creating a matching tag after
  the changes have been committed. Consumers pin the pushed tag or commit.
