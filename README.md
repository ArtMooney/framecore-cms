# framecore-cms

A reusable [Nuxt Layer](https://nuxt.com/docs/getting-started/layers) that
ships a self-contained CMS admin UI plus the Nitro endpoints, Drizzle
schema, and Tailwind styles needed to run it on Cloudflare D1 + R2.

The layer is consumed directly from GitHub — no npm publishing required.

---

## Repo layout

```
framecore-cms/
├─ app/                    # Layer — admin page, components, composables, utils
├─ server/                 # Layer — /cms/* Nitro routes, db client, users schema
├─ tailwind.config.js      # Layer — exports `cmsStyles` plugin (scoped to .cms-admin)
├─ nuxt.config.ts          # Layer — modules + runtimeConfig defaults
├─ playground/             # Local dev consumer (used by `npm run dev`)
└─ package.json
```

`playground/` is a real Nuxt project that `extends: [".."]`, i.e. it pulls in
the layer the same way an external consumer would. Use it as the dev sandbox
while iterating on the CMS.

---

## Local development

```bash
npm install
npm run dev          # boots the playground at http://localhost:3000
```

D1/R2 setup the first time:

```bash
cd playground
npx wrangler d1 create framecore-cms-playground   # paste returned id into wrangler.toml
npx wrangler r2 bucket create framecore-cms-playground
npx wrangler d1 execute framecore-cms-playground --local --command="SELECT 1"
cd ..
npm run db:generate
npm run db:migrate:local
```

---

## Using the layer in another project

### 1. Extend the layer

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ["github:hskoglund/framecore-cms#v0.1.0"],
})
```

Pin to a tag or commit SHA in production. For private repos, set
`GIGET_AUTH=<github_token>` in your build environment (e.g. Cloudflare Pages
env vars). Cloudflare Pages also needs `NODE_VERSION=20`.

### 2. Cloudflare bindings

The layer expects two bindings — names are fixed: `DB` (D1) and `FILES` (R2).

```toml
# wrangler.toml in your consumer project
[[d1_databases]]
binding = "DB"
database_name = "your-db"
database_id = "..."

[[r2_buckets]]
binding = "FILES"
bucket_name = "your-bucket"
```

### 3. Drizzle schema

Your `server/db/schema.ts` must re-export the layer's `users` table alongside
your own tables:

```ts
export { users } from "framecore-cms/server/db/schema";

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", { /* … */ });
```

### 4. CMS configuration

Describe the tables that should appear in the admin UI:

```ts
// server/db/cmsConfig.ts
export const cmsTables = [
  { id: "projects", name: "Projects", viewMode: "list", backupRef: null },
];

export const fieldsConfig = {
  projects: {
    id:        { type: "integer", label: "",      required: true,  hidden: true  },
    title:     { type: "text",    label: "Title", required: true,  hidden: false },
    sortOrder: { type: "integer", label: "",      required: true,  hidden: true  },
    createdAt: { type: "date",    label: "",      required: true,  hidden: true  },
    updatedAt: { type: "date",    label: "",      required: true,  hidden: true  },
  },
};

export const graphConfig = {};
export const staticContentTypes = {};
```

### 5. Tailwind

```js
// tailwind.config.js in your consumer project
import { cmsStyles } from "framecore-cms/tailwind.config.js";

export default {
  plugins: [cmsStyles],
};
```

The plugin only touches selectors scoped under `.cms-admin`, so it never
leaks into your site's design.

### 6. Environment variables

```
NUXT_USERNAME=<basic-auth user for /cms/*>
NUXT_USERPASS=<basic-auth pass>
NUXT_PUBLIC_USERNAME=<same, exposed to the client>
NUXT_PUBLIC_USERPASS=<same, exposed to the client>
NUXT_MAILGUN_API_KEY=...
NUXT_EMAIL_FROM=...
NUXT_EMAIL_TO=...
NUXT_UNSUBSCRIBE_TO=...
```

The admin UI is then available at `/admin`.
