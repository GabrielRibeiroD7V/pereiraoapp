const imageUrls = new Map<string, { url: string; expiresAt: number }>();

export function getCachedImageUrl(path: string | null) {
  if (!path) return null;
  const entry = imageUrls.get(path);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) imageUrls.delete(path);
    return null;
  }
  return entry.url;
}

export function cacheImageUrl(path: string, url: string) {
  imageUrls.set(path, { url, expiresAt: Date.now() + 45_000 });
  if (imageUrls.size > 80) imageUrls.delete(imageUrls.keys().next().value!);
  return url;
}
