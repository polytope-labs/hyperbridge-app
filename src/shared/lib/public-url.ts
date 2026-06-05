/**
 * Resolves a public asset path for the current Vite `base` (e.g. GitHub Pages subpath).
 * External URLs are returned unchanged.
 */
export function resolvePublicUrl(path: string): string {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path
  }

  const base = import.meta.env.BASE_URL
  const normalized = path.startsWith("/") ? path.slice(1) : path

  return `${base}${normalized}`
}
