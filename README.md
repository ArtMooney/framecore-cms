# Framecore CMS

A Nuxt 4 module for Cloudflare D1 + R2. It includes `/admin`, the `/cms/*` API,
login/password reset, configurable fields, file uploads, charts and CSV export.
The CMS owns its Tailwind configuration and styles. The module connects Tailwind
to the site's Vite build automatically, reusing an existing Tailwind plugin when
present. The host needs no copied CMS styles, icon plugin or image provider.
To match the site's heading and body fonts, see [Site fonts](#site-fonts-optional).

## Use in a site

Requires Nuxt 4.6.4 or newer in the 4.x series and Node.js 22.22.3+, 24.15.0+
or 26+. The CMS uses `nuxt/server` so server utilities come from the site's
configured server builder rather than a separate CMS copy of H3 or Nitro.

Choose a versioned Git installation or a local checkout. Run the installation
command in the consuming site's directory.

**From GitHub**, use a pinned tag for deployment and CI, once the tag has been
created and pushed:

```sh
npm install "github:ArtMooney/framecore-cms#v0.2.0"
```

The site can then be built without a local CMS checkout. To update later, run
the same command with the new release tag.

**From a local checkout**, keep the CMS repository next to the site. Run
`npm install` in the CMS repository first, then run this in the site:

```sh
npm install ../framecore-cms
```

This saves `file:../framecore-cms` as the dependency. CMS source and style changes
are processed by the site's dev server. See [Develop the CMS in a site](#develop-the-cms-in-a-site)
for the full development workflow.

**To switch between local and Git installations**, run the other installation
command in the site and restart its dev server. The command updates
`package.json` and `package-lock.json`; commit both when selecting a released
version for the site.

Enable the module in either case:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["framecore-cms"],
});
```

## Database schema and CMS configuration

Keep all table definitions in the consuming site's database schema, including
`users` and `static_content`. Use `server/cms.config.ts` to configure the editor:
which tables can be edited, field settings, graphs and content templates.
It imports the schema; it does not define tables.

A typical site keeps these files together:

```text
server/
  db/
    schema.ts       # All of the site's Drizzle table definitions
  cms.config.ts     # Imports the schema and configures the CMS
drizzle.config.ts   # Migration configuration for server/db/schema.ts
migrations/         # Database migrations owned by the site
```

The site's database client and migration tool use the same schema entry point.
For example, the site's `drizzle.config.ts` points to
`schema: "./server/db/schema.ts"`. This keeps database code independent of CMS
editor settings. If table definitions are later split into several files,
re-export them from `server/db/schema.ts` to keep one schema entry point.

Create the server-only CMS configuration file:

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

The CMS uses the `schema` export and the site's Cloudflare bindings `DB` (D1)
and `FILES` (R2). `cmsTables[].id` and `fieldsConfig` use the schema's JavaScript
keys. Exporting the full schema does not make every table editable: `cmsTables`
controls which tables the editor exposes.

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

## Statistics (optional)

Statistics is enabled per site and per table. Add a table to `cmsTables` with
`viewMode: "graph"` and define its views under the same key in `graphConfig`:

```ts
// In the site's server/cms.config.ts, for an existing schema.sales table:
export const cmsTables = [{ id: "sales", name: "Sales", viewMode: "graph" }];

export const graphConfig = {
  sales: [
    { type: "selectors", dateField: "soldAt" },
    {
      type: "bar",
      labelField: "product",
      dateField: "soldAt",
      datasets: [{ label: "Records per product" }],
    },
  ],
};
```

Define the table's fields in `fieldsConfig` as usual. The statistics list and
CSV export use those same visible fields, labels and order as the editing form.
Fields with `hidden: true` are excluded. Dates and date ranges are formatted
consistently in both views; CSV filenames use the selected table's ID.
No booking-specific field names or table named `statistics` are required.

For a site without statistics, keep its content tables in `viewMode: "list"`
and export `graphConfig = {}`. A graph table is hidden from the table selector
when its matching `graphConfig` entry is missing or empty. No statistics table
or view is added automatically by the module.

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

Configure all values in the **consuming site**: use that site's `.env` locally
and its hosting environment variables in production. The CMS repository does
not need its own `.env` file when used as a module. The module declares the
runtime config keys, so new sites can use the variable names below without
adding them to `nuxt.config.ts`.

Nuxt reads `.env` during development and builds; a built production server uses
its hosting environment instead. See [Nuxt runtime config](https://nuxt.com/docs/4.x/guide/going-further/runtime-config#environment-variables).

### Environment variables

**Server-side variables**

| Variable                    | When needed                      | Purpose / default                                                 |
| --------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `NUXT_MAILGUN_API_KEY`      | Password emails                  | Mailgun API key, available only on the server.                    |
| `NUXT_EMAIL_FROM`           | Password emails                  | Sender address for password reset and change-confirmation emails. |
| `NUXT_CMS_MAILGUN_DOMAIN`   | Password emails                  | Sending domain configured in Mailgun.                             |
| `NUXT_CMS_MAILGUN_BASE_URL` | A different Mailgun API endpoint | Optional; defaults to `https://api.eu.mailgun.net`.               |
| `NUXT_USER_NAME`            | Basic-auth API configuration     | Server-side API username. Must match `NUXT_PUBLIC_USER_NAME`.     |
| `NUXT_USER_PASS`            | Basic-auth API configuration     | Server-side API password. Must match `NUXT_PUBLIC_USER_PASS`.     |

**Public variables**

| Variable                     | When needed                       | Purpose / default                                                    |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `NUXT_PUBLIC_USER_NAME`      | Basic-auth API configuration      | Username sent by the browser with CMS API requests.                  |
| `NUXT_PUBLIC_USER_PASS`      | Basic-auth API configuration      | Password sent by the browser with CMS API requests.                  |
| `NUXT_PUBLIC_IMAGE_BASE_URL` | Images served from another origin | Base URL used for CMS image previews. Defaults to the site's origin. |

Set all four Basic-auth variables, with matching server/browser values. They
are visible to visitors through the public pair and are not an admin secret.
Admin login separately checks an account in the site's `users` table; admin
email addresses and passwords are not configured through these variables.
The login store persists admin credentials, as in the original CMS.

The Mailgun key, sender and domain are required when using password emails.
Regular login and content editing do not need Mailgun configuration.

Image preview URLs use `<NUXT_PUBLIC_IMAGE_BASE_URL>/cms-files/<filename>`.
If the base URL is omitted, the site must serve those files at
`/cms-files/<filename>` on its own origin.

Example for the **site's** `.env`, using placeholder values:

```dotenv
# Server-side API values.
NUXT_USER_NAME=site-api-user
NUXT_USER_PASS=site-api-password
# Required when using password emails:
NUXT_MAILGUN_API_KEY=your-mailgun-api-key
NUXT_EMAIL_FROM=CMS <cms@example.com>
NUXT_CMS_MAILGUN_DOMAIN=mg.example.com
# Optional override; this is already the default:
NUXT_CMS_MAILGUN_BASE_URL=https://api.eu.mailgun.net

# Public API values must match the server-side pair.
NUXT_PUBLIC_USER_NAME=site-api-user
NUXT_PUBLIC_USER_PASS=site-api-password
# Optional: image preview origin.
NUXT_PUBLIC_IMAGE_BASE_URL=https://files.example.com
```

Existing sites such as Boråssajten explicitly map `NUXT_USERNAME`,
`NUXT_USERPASS`, `NUXT_PUBLIC_USERNAME` and `NUXT_PUBLIC_USERPASS` in their
`nuxt.config.ts`. Keep those mappings when retaining the legacy names; new
sites can use the standard underscore-separated names above.

### Cloudflare bindings

Configure these in the consuming site's Cloudflare project for each environment:

| Binding | Resource    | Used for                                             |
| ------- | ----------- | ---------------------------------------------------- |
| `DB`    | D1 database | All CMS queries, including admin login.              |
| `FILES` | R2 bucket   | Content creation, saving, deletion and file uploads. |

These are resource bindings, not `.env` API keys. The current single-item
create, save and delete handlers require `FILES`, even for items without files.
The CMS accesses D1 through `DB`; Cloudflare account IDs and API tokens used by
site-specific migration or deployment tools are not CMS runtime requirements.

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

Record changes under `Unreleased` in [CHANGELOG.md](./CHANGELOG.md). When
preparing a release, move those entries to a section with the version number
and actual release date, then keep `Unreleased` for upcoming changes.

All shared code lives in this repository. Bump `package.json`, run the tests
and verify the consuming sites, then commit and tag the release. Consumers can install
`github:ArtMooney/framecore-cms#v0.2.0` once that tag has been pushed. Pin a tag
or commit for deployed sites. Each site updates the dependency and redeploys
when it wants the new version. There is no npm publication requirement.

The local `file:../framecore-cms` dependency used by Boråssajten requires both
repositories side by side. Replace it with a pushed Git tag/commit before
building in CI where only the site repository is checked out.
