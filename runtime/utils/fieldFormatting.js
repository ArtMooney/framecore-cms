import { months } from "../components/lib/months.js";

export function formatFieldLabel(name) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

export function formatFieldValue(value, type) {
  if (value === undefined || value === null || value === "") return "";

  if (type === "date" || type === "dateRange") {
    if (!Array.isArray(value)) return formatDate(value);

    const start = formatDate(value[0]);
    const end = formatDate(value[1]);
    if (!start) return "";
    return !end || start === end ? start : `${start} – ${end}`;
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function formatDate(value) {
  if (value === undefined || value === null || value === "") return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
