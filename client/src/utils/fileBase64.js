export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export async function fileToUploadPayload(file, field) {
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  return {
    field,
    filename: file.name,
    data: arrayBufferToBase64(buffer),
  };
}
