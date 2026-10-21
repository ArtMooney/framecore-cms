import { fileExists } from "./file-exists.js";

export async function deleteIfExists(bucket, key) {
  try {
    if (await fileExists(bucket, key)) {
      await bucket.delete(key);
      return true;
    }

    return false;
  } catch (error) {
    throw new Error(`Error removing file: ${error.message}`);
  }
}
