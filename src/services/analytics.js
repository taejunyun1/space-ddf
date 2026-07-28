const GOOGLE_ANALYTICS_HOSTNAME = 'spaceddf.xyz'
const GOOGLE_TAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'
const GOOGLE_TAG_SCRIPT_ATTRIBUTE = 'data-space-ddf-analytics'

export function installGoogleAnalytics({
  documentRef = document,
  env = import.meta.env,
  locationRef = window.location,
  windowRef = window,
} = {}) {
  const measurementId = env.VITE_GA_MEASUREMENT_ID || ''

  if (!shouldEnableGoogleAnalytics({
    hostname: locationRef.hostname,
    isProductionBuild: Boolean(env.PROD),
    measurementId,
  })) {
    return false
  }

  windowRef.dataLayer = windowRef.dataLayer || []
  windowRef.gtag = windowRef.gtag || function gtag() {
    windowRef.dataLayer.push(arguments)
  }

  windowRef.gtag('js', new Date())
  windowRef.gtag('config', measurementId)

  if (documentRef.querySelector(`script[${GOOGLE_TAG_SCRIPT_ATTRIBUTE}="google"]`)) {
    return true
  }

  const script = documentRef.createElement('script')
  script.async = true
  script.src = googleTagScriptUrl(measurementId)
  script.setAttribute(GOOGLE_TAG_SCRIPT_ATTRIBUTE, 'google')
  documentRef.head.appendChild(script)

  return true
}

export function shouldEnableGoogleAnalytics({ hostname, isProductionBuild, measurementId }) {
  return Boolean(measurementId) && isProductionBuild && hostname === GOOGLE_ANALYTICS_HOSTNAME
}

function googleTagScriptUrl(measurementId) {
  const params = new URLSearchParams({ id: measurementId })

  return `${GOOGLE_TAG_SCRIPT_URL}?${params.toString()}`
}
