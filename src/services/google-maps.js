let googleMapsPromise = null

const GOOGLE_MAPS_CALLBACK = '__spaceDdfGoogleMapsReady'
const GOOGLE_MAPS_API_URL = 'https://maps.googleapis.com/maps/api/js'

export function hasGoogleMapsApiKey() {
  return Boolean(googleMapsApiKey())
}

export function googleMapsMapId() {
  return import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
}

export async function loadGoogleMapsLibrary(name) {
  await loadGoogleMaps()
  return window.google.maps.importLibrary(name)
}

function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps)
  }

  if (googleMapsPromise) return googleMapsPromise

  const key = googleMapsApiKey()

  if (!key) {
    googleMapsPromise = Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
    return googleMapsPromise
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    window[GOOGLE_MAPS_CALLBACK] = () => resolve(window.google.maps)

    const params = new URLSearchParams({
      key,
      loading: 'async',
      callback: GOOGLE_MAPS_CALLBACK,
      v: 'weekly',
      language: 'ko',
      region: 'KR',
      auth_referrer_policy: 'origin',
    })

    const script = document.createElement('script')
    script.async = true
    script.src = `${GOOGLE_MAPS_API_URL}?${params.toString()}`
    script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load'))
    document.head.appendChild(script)
  })

  return googleMapsPromise
}

function googleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
}
