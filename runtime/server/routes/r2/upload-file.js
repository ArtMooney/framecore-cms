export async function uploadFile(bucket, fileName, base64Data, contentType) {
  try {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);

    const lastDotIndex = fileName.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0 && lastDotIndex < fileName.length - 1;

    const baseName = hasExtension ? fileName.slice(0, lastDotIndex) : fileName;
    const extension = hasExtension ? fileName.slice(lastDotIndex) : "";

    const key = `${baseName}-${Date.now()}${extension}`;

    await bucket.put(`cms-files/${key}`, byteArray, {
      httpMetadata: { contentType: contentType || "application/octet-stream" },
    });

    return key;
  } catch (error) {
    throw new Error(`Error uploading file: ${error.message}`);
  }
}
