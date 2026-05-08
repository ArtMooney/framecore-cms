/**
 * CMS table & field configuration.
 *
 * This file is intentionally empty in the layer. Each consumer project
 * must provide its own `server/db/cmsConfig.ts` describing the tables
 * that should appear in the CMS admin UI.
 *
 * Example consumer file:
 *
 *   export const cmsTables = [
 *     { id: "projects", name: "Projects", viewMode: "list", backupRef: null },
 *   ];
 *
 *   export const fieldsConfig = {
 *     projects: {
 *       id:        { type: "integer", label: "",      required: true,  hidden: true  },
 *       title:     { type: "text",    label: "Title", required: true,  hidden: false },
 *       sortOrder: { type: "integer", label: "",      required: true,  hidden: true  },
 *       createdAt: { type: "date",    label: "",      required: true,  hidden: true  },
 *       updatedAt: { type: "date",    label: "",      required: true,  hidden: true  },
 *     },
 *   };
 *
 *   export const graphConfig = {};
 *   export const staticContentTypes = {};
 */

export const cmsTables: Array<{
  id: string;
  name: string;
  viewMode: "list" | string;
  backupRef: string | null;
}> = [];

export const fieldsConfig: Record<string, Record<string, any>> = {};

export const graphConfig: Record<string, any> = {};

export const staticContentTypes: Record<string, any> = {};
