import { staticContentTypes } from "~~/server/db/cmsConfig.ts";
import { uploadFile } from "~~/server/routes/cms/r2/upload-file.js";
import { deleteIfExists } from "~~/server/routes/cms/r2/delete-if-exists.js";

function isFileType(type) {
  return type === "file" || type === "fileImg";
}

function isNestedObject(value) {
  return typeof value === "object" && value !== null;
}

function getNestedValue(obj, pathArray) {
  let current = obj;
  for (const key of pathArray) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }

  return current;
}

function setNestedValue(obj, pathArray, value) {
  let current = obj;

  for (let i = 0; i < pathArray.length - 1; i++) {
    const key = pathArray[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }

  current[pathArray[pathArray.length - 1]] = value;
}

export async function handleJsonFileUploads(bucket, item, schema) {
  for (const field of schema) {
    if (field.type === "json" && item[field.name]) {
      const template = staticContentTypes[item.title];

      if (template) {
        await processJsonFileUploads(bucket, item[field.name], template);
      }
    }
  }
}

export async function handleJsonDeletePrevious(
  bucket,
  currentStoredItem,
  newItem,
  schema,
) {
  for (const field of schema) {
    if (field.type === "json") {
      const template = staticContentTypes[newItem.title];

      if (template) {
        const currentJson = currentStoredItem[field.name] || {};
        const newJson = newItem[field.name] || {};
        await processJsonFileDeletions(bucket, currentJson, newJson, template);
      }
    }
  }
}

export async function handleJsonFileDeleteAll(bucket, item, schema) {
  for (const field of schema) {
    if (field.type === "json" && item[field.name]) {
      const template = staticContentTypes[item.title];

      if (template) {
        await deleteAllJsonFiles(bucket, item[field.name], template);
      }
    }
  }
}

async function processJsonFileUploads(bucket, jsonData, template, path = []) {
  if (!template || !jsonData) return;

  for (const [key, value] of Object.entries(template)) {
    const currentPath = [...path, key];

    if (isFileType(value)) {
      const fileData = getNestedValue(jsonData, [key]);

      if (fileData?.[0]?.file?.length > 0) {
        const uploadedFileName = await uploadFile(
          bucket,
          fileData[0].name,
          fileData[0].file,
          fileData[0].contentType,
        );

        setNestedValue(jsonData, [key], uploadedFileName);
      }
    } else if (isNestedObject(value)) {
      const nestedData = jsonData[key];

      if (nestedData) {
        await processJsonFileUploads(bucket, nestedData, value, currentPath);
      }
    }
  }
}

async function processJsonFileDeletions(
  bucket,
  currentStoredJson,
  newJson,
  template,
  path = [],
) {
  if (!template) return;

  for (const [key, value] of Object.entries(template)) {
    const currentPath = [...path, key];

    if (isFileType(value)) {
      const oldFileName = getNestedValue(currentStoredJson, [key]);
      const newFileData = getNestedValue(newJson, [key]);

      if (oldFileName && typeof oldFileName === "string") {
        const isNewFileUpload = newFileData?.[0]?.file?.length > 0;
        const isFileChanged = newFileData !== oldFileName;

        if (isNewFileUpload || isFileChanged) {
          await deleteIfExists(bucket, `cms-files/${oldFileName}`);
        }
      }
    } else if (isNestedObject(value)) {
      const currentNestedData = currentStoredJson?.[key] || {};
      const newNestedData = newJson?.[key] || {};

      await processJsonFileDeletions(
        bucket,
        currentNestedData,
        newNestedData,
        value,
        currentPath,
      );
    }
  }
}

async function deleteAllJsonFiles(bucket, jsonData, template, path = []) {
  if (!template || !jsonData) return;

  for (const [key, value] of Object.entries(template)) {
    const currentPath = [...path, key];

    if (isFileType(value)) {
      const fileName = getNestedValue(jsonData, [key]);
      if (fileName && typeof fileName === "string") {
        await deleteIfExists(bucket, `cms-files/${fileName}`);
      }
    } else if (isNestedObject(value)) {
      const nestedData = jsonData[key];
      if (nestedData) {
        await deleteAllJsonFiles(bucket, nestedData, value, currentPath);
      }
    }
  }
}
