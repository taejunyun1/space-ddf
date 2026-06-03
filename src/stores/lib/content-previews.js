const previewModules = import.meta.glob('/src/assets/previews/**/*.webp', {
  eager: true,
  import: 'default',
})

const previews = Object.entries(previewModules).reduce((result, [path, url]) => {
  const match = path.match(/\/previews\/(show|project)\/([^/]+)\.webp$/)

  if (!match) return result

  const [, kind, slug] = match
  result[kind] ||= {}
  result[kind][slug] = url

  return result
}, {})

export function previewFor(kind, slug) {
  return previews[kind]?.[slug] || ''
}
