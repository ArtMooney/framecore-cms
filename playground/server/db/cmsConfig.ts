export const cmsTables = [
  {
    id: "demo_items",
    name: "Demo Items",
    viewMode: "list",
    backupRef: null,
  },
];

export const fieldsConfig = {
  demo_items: {
    id: { type: "integer", label: "", required: true, hidden: true },
    title: { type: "text", label: "Title", required: true, hidden: false },
    description: {
      type: "textarea",
      label: "Description",
      required: false,
      hidden: false,
    },
    sortOrder: { type: "integer", label: "", required: true, hidden: true },
    createdAt: { type: "date", label: "", required: true, hidden: true },
    updatedAt: { type: "date", label: "", required: true, hidden: true },
  },
};

export const graphConfig = {};

export const staticContentTypes = {};
