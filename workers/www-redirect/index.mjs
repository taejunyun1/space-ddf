const CANONICAL_HOST = 'spaceddf.xyz'

export default {
  async fetch(request) {
    const target = new URL(request.url)
    target.protocol = 'https:'
    target.hostname = CANONICAL_HOST
    target.port = ''

    return Response.redirect(target.toString(), 301)
  }
}
