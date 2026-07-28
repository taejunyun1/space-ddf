export function handleAdminPageRoute(context) {
  return createAdminToManageRedirect(context.request)
}

function createAdminToManageRedirect(request) {
  const url = new URL(request.url)

  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    url.pathname = '/manage/rentals'
    return Response.redirect(url.toString(), 302)
  }

  if (url.pathname === '/admin/rental' || url.pathname === '/admin/rental/') {
    url.pathname = '/manage/rentals'
    return Response.redirect(url.toString(), 302)
  }

  url.pathname = url.pathname.replace(/^\/admin/, '/manage')
  return Response.redirect(url.toString(), 302)
}
