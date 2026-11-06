# Framecore CMS

A Nuxt 4 module for Cloudflare D1 + R2. It includes `/admin`, the `/cms/*` API,
login/password reset, configurable fields, file uploads, charts and CSV export.
The CMS owns its Tailwind configuration and styles. The module connects Tailwind
to the site's Vite build automatically, reusing an existing Tailwind plugin when
present. The host needs no copied CMS styles, icon plugin or image provider.
To match the site's heading and body fonts, see [Site fonts](#site-fonts-optional).

## Use in a site

Install `framecore-cms` from a released Git tag, or link the sibling repository
while developing:

```sh
npm install ../framecore-cms
```

Enable the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["framecore-cms"],
});
```

Create one server-only configuration file:

```ts
// server/cms.config.ts
import * as schema from "./db/schema";
export { schema };

export const cmsTables = [
  { id: "articles", name: "Articles", viewMode: "list" },
];
export const fieldsConfig = {
  articles: {
    id: { type: "integer", hidden: true },
    title: { type: "text", label: "Title", required: true },
    sortOrder: { type: "integer", hidden: true },
  },
};
export const graphConfig = {};
export const staticContentTypes = {};
```

Each site defines its entire Drizzle SQLite schema and owns its migrations and
Cloudflare bindings `DB` (D1) and `FILES` (R2). The CMS package defines no tables.
Its only database input is the `schema` exported by the site's CMS configuration.
`cmsTables[].id` and `fieldsConfig` use that schema's JavaScript keys.

The built-in login expects a `schema.users` table with `id`, `email`, `password`
and `resetId` fields. The `/cms/static` content endpoint expects
`schema.static_content`; JSON editing uses `title` and `content`. These are
JavaScript export/field names; each site chooses the SQL table and column names,
constraints and extra fields. For example, `users` may map to an
`admin_accounts` SQL table. The CMS never creates or migrates these tables.

Each editable table needs an `id` primary key and a numeric `sortOrder` column.
Provide field settings for every column; use `hidden: true` for system columns.
Supported fields: text, textarea, integer, checkbox, date, dateRange, select,
file, fileImg and json.
Graph options must be JSON-compatible because they are sent to the admin through
the metadata API; JavaScript callbacks are not supported there.
For `json` content, `staticContentTypes` maps each row's title to its editable
nested fields.

To keep an existing config path, set
`cms: { config: "./server/db/cmsConfig.ts" }`. That file must also export `schema`.
The module reserves `/admin` and `/cms/*`; remove local copies of those routes.
The admin uses its own layout and sends `noindex, nofollow`.

## Site fonts (optional)

The CMS does not bundle fonts or choose font families. It reads the site's
`--font-body` and `--font-heading` CSS variables. Font files and font names
stay in the consuming site.

**If the variables already exist globally**, no CSS changes are needed.
This also applies to CSS-first Tailwind themes that already expose both values.

**For a JavaScript Tailwind config**, add the following block to the site's
existing main CSS file, after its `@config` directive, to use the same heading
and body fonts in the CMS:

```css
/* After the site's existing @config directive. */
:root {
  --font-body: theme(--font-body);
  --font-heading: theme(--font-heading);
}
```

This is a site-side integration step when matching both fonts. `theme(...)`
resolves `theme.fontFamily.body` and `theme.fontFamily.heading` from that site's
Tailwind config at build time. Keep the existing font imports and `@font-face`
rules. Do not repeat the font names in the CMS config.

For example, Boråssajten adds this block in `app/assets/css/main.css`, while its
font names remain in `tailwind.config.js`.

**Without this setup**, the CMS still works and inherits the surrounding body
font. If only `--font-body` exists, headings fall back to that font. Plain CSS
inheritance does not read Tailwind's separate `heading` and `body` config keys.

## Environment

Configure these per site (declare no extra runtime keys; the module adds them):

```dotenv
NUXT_USER_NAME=site-api-user
NUXT_USER_PASS=site-api-password
NUXT_PUBLIC_USER_NAME=site-api-user
NUXT_PUBLIC_USER_PASS=site-api-password
NUXT_PUBLIC_IMAGE_BASE_URL=https://files.example.com

# Optional, for password reset emails:
NUXT_MAILGUN_API_KEY=...
NUXT_EMAIL_FROM=CMS <cms@example.com>
NUXT_CMS_MAILGUN_DOMAIN=mg.example.com
# Defaults to the EU Mailgun endpoint:
NUXT_CMS_MAILGUN_BASE_URL=https://api.eu.mailgun.net
```

Existing sites that explicitly read `NUXT_USERNAME`, `NUXT_USERPASS`, etc. in
`nuxt.config.ts` can keep doing so. Nuxt's automatic overrides use the
underscore-separated names above.

The current login protocol is preserved: a public Basic-auth API header plus
an admin account in the `users` table. The Basic-auth values are visible to
visitors and are not an admin secret. The login store persists the admin
credentials, as in the original CMS. A session-based login would be a separate
change.

## Develop the CMS in a site

Keep this repository next to the site that imports it. Install the CMS
repository's dependencies and run its checks:

```sh
npm install
npm test
```

In the consuming site, link the repository and start that site's dev server:

```sh
npm install ../framecore-cms
npm run dev
```

Edit the shared code in this repository and verify it in the consuming site's
`/admin`, using that site's schema, configuration and Cloudflare bindings.
Restart the site's dev server after changing the module registration in
`module.mjs`. Verify affected sites before releasing a shared update.

Edit `tailwind.config.js` for the CMS theme and base styles. `runtime/cms.css`
loads that config, registers the CMS component sources and imports Tailwind
and the datepicker stylesheet. The consuming site's normal Vite build compiles
them, including during development. There is no separate CSS build command or
generated CSS file to commit.

CMS components use normal Tailwind utility classes such as `h-auto` and `flex`.
The stylesheet generates those utilities under `.cms-admin`, alongside the
scoped base and form styles. Theme values are compiled inline so the CMS does
not replace the host's theme variables. Tailwind's global Preflight reset is
omitted. The datepicker uses its standard `dp-` classes and stylesheet.

## Versions

All shared code lives in this repository. Bump `package.json`, run the tests
and verify the consuming sites, then commit and tag the release. Consumers can install
`github:ArtMooney/framecore-cms#v0.2.0` once that tag has been pushed. Pin a tag
or commit for deployed sites. Each site updates the dependency and redeploys
when it wants the new version. There is no npm publication requirement.

The local `file:../framecore-cms` dependency used by Boråssajten requires both
repositories side by side. Replace it with a pushed Git tag/commit before
building in CI where only the site repository is checked out.
