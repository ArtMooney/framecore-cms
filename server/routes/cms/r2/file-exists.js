export async function fileExists(bucket, key) {
  const obj = await bucket.head(key);
  return obj !== null;
}
