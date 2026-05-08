# CLAUDE.md

Project context for AI coding assistants working in this repository.

## What this repo is

`framecore-cms` is a **Nuxt Layer** that ships a self-contained CMS admin
UI plus the Nitro endpoints, Drizzle schema, and Tailwind styles needed to
run it on Cloudflare D1 + R2. It is consumed by other Nuxt projects
directly from GitHub via `extends: ["github:hskoglund/framecore-cms#vX.Y.Z"]`
— it is **not** published to npm.

It is **not** an application. It is a reusable building block. The
`playground/` directory is the only place a "site" exists, and it only
exists so the layer can be developed and smoke-tested locally.

## Repo layout

```
framecore-cms/
├─ app/                    # Layer code
│  ├─ pages/admin.vue      # /admin route
│  ├─ components/cms/**    # CMS UI (auto-imported as Cms*)
│  ├─ composables/         # useNoIndexSeo
│  └─ utils/               # emailValidator, requiredFields, months
├─ server/                 # Layer Nitro endpoints
│  ├─ routes/cms/**        # /cms/* REST endpoints
│  ├─ utils/               # check-login, mailgun
│  └─ db/                  # client.ts + users-only schema.ts + empty cmsConfig.ts
├─ tailwind.config.js      # Exports `cmsStyles` plugin (scoped to .cms-admin)
├─ nuxt.config.ts          # Layer config — modules + runtimeConfig defaults
├─ playground/             # Local dev consumer; `extends: [".."]`
│  ├─ nuxt.config.ts
│  ├─ wrangler.toml        # D1/R2 bindings live here, not in the layer
│  ├─ drizzle.config.ts
│  ├─ server/db/schema.ts  # re-exports `users` from the layer + demo tables
│  └─ server/db/cmsConfig.ts
└─ package.json
```

## Conventions and rules to follow

### Layer boundary

- **Never reintroduce site-specific code into the layer.** Anything that
  references a particular site's domain, branding, content store, image
  base URL, schema.org JSON-LD, fonts, or favicons belongs in the consumer
  project (or in `playground/` for dev), not in the layer.
- The layer owns exactly **one** database table: `users`. Consumer projects
  define their own tables and re-export `users` from
  `framecore-cms/server/db/schema`.
- `cmsTables`, `fieldsConfig`, `graphConfig`, `staticContentTypes` in
  `server/db/cmsConfig.ts` are intentionally empty in the layer — the
  consumer's `~~/server/db/cmsConfig.ts` is what actually drives the UI.
- CMS routes import from `~~/server/db/schema` and `~~/server/db/cmsConfig`.
  `~~/` resolves to the consumer's rootDir, so the layer's own files in
  those paths are only used by the playground.

### Cloudflare bindings

The layer hard-codes binding names: `DB` (D1) and `FILES` (R2). Don't
parameterise them — keep the layer simple, document the requirement.

### Tailwind

- This project uses **Tailwind CSS 4.2+**. Use the v4 plugin/config style
  (CSS-first `@import "tailwindcss"`, `@apply` inside JS plugins, no
  `content` array required at the consumer level).
- The CMS plugin (`cmsStyles` in `tailwind.config.js`) scopes **everything**
  under `.cms-admin`. Never add unscoped global styles in the layer — they
  would leak into the host site. Whatever rule you add must live inside
  the `.cms-admin` block.
- `prettier-plugin-tailwindcss` is enabled, so class-order is auto-managed.

### Formatting

- Always run **Prettier** on any file you create or change. The project's
  config is in `.prettierrc` (`prettier-plugin-tailwindcss` enabled).
- Indentation: 4 spaces in `package.json`, 2 spaces everywhere else (the
  Prettier defaults are fine).

### Auth & secrets

- Two layers of auth protect `/cms/*`:
  1. HTTP Basic auth gate (`runtimeConfig.userName/userPass`)
  2. Drizzle-backed user login (`users` table + bcrypt-style verify in
     `server/routes/cms/utils/password.js`)
- Reset-password flow is via Mailgun. Templates live in
  `server/routes/cms/content/message-*.js` — consumers can override by
  defining their own file at the same path in their project.

### Versioning

- Bump the version in `package.json` and create a matching git tag
  (`v0.1.0`, `v0.1.1`, …) for every change consumers should pick up.
- Consumers pin to a tag/SHA in their `extends` string — never `#main` for
  production deploys.

## Commands

```bash
npm install                # installs layer + playground deps
npm run dev                # boots playground at localhost:3000

# Drizzle migrations (run against playground)
npm run db:generate
npm run db:migrate:local
npm run db:studio:local
```

## Things to remember when making changes

1. **Run/keep the playground in sync.** If you change a CMS route signature
   or a config field, update `playground/server/db/cmsConfig.ts` and
   `playground/server/db/schema.ts` so `npm run dev` still works.
2. **Don't leak globals.** Anything added to `tailwind.config.js` must be
   under `.cms-admin`. Anything added to `nuxt.config.ts`'s `runtimeConfig`
   must have a sensible empty default.
3. **Document binding/env additions** in `README.md` whenever you add a new
   `runtimeConfig` key, Cloudflare binding, or env variable — consumers
   need to know.
4. **Use Prettier.** Always format files you touch.
