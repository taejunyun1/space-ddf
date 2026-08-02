export async function serveManagedDetailRoute(context) {
  const assetResponse = await context.env.ASSETS.fetch(context.request)
  if (assetResponse.status !== 404) return assetResponse

  const shellUrl = new URL('/', context.request.url)
  return context.env.ASSETS.fetch(new Request(shellUrl, context.request))
}
