const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('regional archive mobile layout uses list and map view tabs instead of a drawer', () => {
  const source = readProjectFile('src/views/RegionalArchiveView.vue')

  assert.doesNotMatch(source, /archive-map-drawer/)
  assert.doesNotMatch(source, /mobile-map-scrim/)
  assert.match(source, /const\s+activeMobileView\s*=\s*ref\('list'\)/)
  assert.match(source, /role="tablist"/)
  assert.match(source, /리스트로 보기/)
  assert.match(source, /지도로 보기/)
  assert.match(source, /mobile-list-view/)
  assert.match(source, /mobile-map-view/)
  assert.match(source, /@click="activeMobileView = 'map'"/)
})

test('regional archive mobile list uses natural page height without nested scrolling', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  const list = readProjectFile('src/components/archive/ArchiveList.vue')

  assert.match(view, /\.mobile-list-view\s+\.archive-list-pane\s*{[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*0;/)
  assert.match(view, /\.mobile-list-view\s+\.archive-list-content\s*{[\s\S]*?flex:\s*none;[\s\S]*?overflow:\s*visible;/)
  assert.doesNotMatch(view, /\.mobile-list-view\s+\.archive-list-pane\s*{[\s\S]*?calc\(100dvh/)
  assert.match(list, /@media \(max-width:\s*1024px\)[\s\S]*?\.archive-list\s*{[\s\S]*?max-height:\s*none;[\s\S]*?overflow-y:\s*visible;/)
})

test('regional archive map defaults to a closer zoom level', () => {
  const source = readProjectFile('src/components/archive/ArchiveMap.vue')

  assert.match(source, /const\s+DEFAULT_ZOOM\s*=\s*10/)
  assert.match(source, /const\s+SINGLE_MARKER_ZOOM\s*=\s*15/)
  assert.match(source, /const\s+SELECTED_MARKER_ZOOM\s*=\s*12/)
  assert.match(source, /googleMap\.setZoom\(DEFAULT_ZOOM\)/)
  assert.match(source, /googleMap\.setZoom\(SINGLE_MARKER_ZOOM\)/)
  assert.match(source, /googleMap\.setZoom\(SELECTED_MARKER_ZOOM\)/)
})

test('regional archive map groups Biennale pavilions by their shared venue key', () => {
  const source = readProjectFile('src/components/archive/ArchiveMap.vue')
  const groups = markerGroupsFromMapSource(source, [
    {
      id: 'malaysia-pavilion',
      city: 'gwangju',
      cityLabel: '광주',
      venue: 'ACC 국제전시관 1',
      venueGroupKey: 'biennale-venue-coordinate-v1|acc',
      lat: 35.1462,
      lng: 126.9218,
      status: 'ongoing',
      archiveType: 'exhibition',
    },
    {
      id: 'myanmar-pavilion',
      city: 'gwangju',
      cityLabel: '광주',
      venue: 'ACC 국제전시관 1층 로비',
      venueGroupKey: 'biennale-venue-coordinate-v1|acc',
      lat: 35.14624,
      lng: 126.92184,
      status: 'ongoing',
      archiveType: 'exhibition',
    },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].count, 2)
  assert.deepEqual(groups[0].itemIds, ['malaysia-pavilion', 'myanmar-pavilion'])
})

test('regional archive map accepts only valid scalar latitude and longitude values', () => {
  const source = readProjectFile('src/components/archive/ArchiveMap.vue')
  const invalidCoordinates = [
    [null, 126.9],
    [undefined, 126.9],
    ['', 126.9],
    ['   ', 126.9],
    [true, 126.9],
    [35.1, false],
    [NaN, 126.9],
    [91, 126.9],
    [35.1, 181],
  ]
  const groups = markerGroupsFromMapSource(source, [
    ...invalidCoordinates.map(([lat, lng], index) => archiveMapItem(`invalid-${index}`, lat, lng)),
    archiveMapItem('numeric-strings', '35.1', '126.9'),
    archiveMapItem('equator-prime-meridian', 0, 0),
  ])

  assert.deepEqual(groups.flatMap(group => group.itemIds), ['numeric-strings', 'equator-prime-meridian'])
})

test('regional archive map keeps the active pavilion selectable within a shared venue', () => {
  const source = readProjectFile('src/components/archive/ArchiveMap.vue')

  assert.match(source, /const selectedGroupItems = computed\(/)
  assert.match(source, /v-for="item in selectedGroupItems"/)
  assert.match(source, /@click="selectGroupedItem\(item\.id\)"/)
  assert.match(source, /:aria-pressed="item\.id === selectedItem\.id"/)
  assert.match(source, /emit\('select', group\.itemIds\.includes\(props\.selectedId\) \? props\.selectedId : group\.primaryId\)/)
  assert.match(source, /query:\s*{\s*to:\s*selectedItem\.id\s*}/)
})

test('regional archive map refreshes existing marker selection content when selection changes groups', () => {
  const source = readProjectFile('src/components/archive/ArchiveMap.vue')

  assert.match(source, /watch\(\(\) => props\.selectedId, \(\) => \{\s*syncMarkers\(\{ fitBounds: false \}\)\s*}\)/)
  assert.match(source, /const marker = markerMap\.get\(group\.id\) \|\| createMarker\(group\)/)
  assert.match(source, /marker\.content = markerContent\(group, selected\)/)
  assert.match(source, /marker\.zIndex = selected \? 20 : 10 \+ group\.count/)
})

test('regional archive map preserves the current viewport for selection-only marker refreshes', () => {
  const source = readProjectFile('src/components/archive/ArchiveMap.vue')

  assert.match(source, /watch\(markerGroups, \(\) => \{\s*syncMarkers\(\{ fitBounds: true \}\)\s*}\)/)
  assert.match(source, /watch\(\(\) => props\.selectedId, \(\) => \{\s*syncMarkers\(\{ fitBounds: false \}\)\s*}\)/)
  assert.match(source, /function syncMarkers\(\{ fitBounds = true \} = \{\}\)/)
  assert.match(source, /if \(fitBounds\) fitVisibleMarkers\(\)\s*focusSelectedMarker\(\)/)
  assert.match(source, /const marker = markerMap\.get\(group\.id\) \|\| createMarker\(group\)/)
})

test('regional archive map contains only ongoing records and links to the planner', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  const map = readProjectFile('src/components/archive/ArchiveMap.vue')

  assert.match(view, /ongoingArchiveItems\(archiveItems\.value\)/)
  assert.doesNotMatch(view, /item\.status\s*!==\s*'closed'/)
  assert.match(view, /:selection-unavailable="mapSelectionUnavailable"/)
  assert.match(map, /name:\s*'archive-route'/)
  assert.match(map, /query:\s*{\s*to:\s*selectedItem\.id\s*}/)
  assert.match(map, />길찾기</)
})

test('regional archive exposes verified radar filters without crowd copy', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  const filters = readProjectFile('src/components/archive/ArchiveFilters.vue')
  const composable = readProjectFile('src/composables/useRegionalArchive.js')
  assert.match(view, /v-model:activeQuickFilter/)
  assert.match(filters, /오늘 종료/)
  assert.match(filters, /무료/)
  assert.match(filters, /주차 가능/)
  assert.match(filters, /내 주변/)
  assert.doesNotMatch(`${view}\n${filters}\n${composable}`, /혼잡|crowd/i)
})

test('regional archive feeds only ongoing records into list and map', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  assert.match(view, /const ongoingItems = computed\(\(\) => ongoingArchiveItems\(archiveItems\.value\)\)/)
  assert.match(view, /useRegionalArchive\(ongoingItems/)
})

test('archive list and map expose ordered route selection', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  const list = readProjectFile('src/components/archive/ArchiveList.vue')
  const map = readProjectFile('src/components/archive/ArchiveMap.vue')
  assert.match(list, /selectedRouteIds/)
  assert.match(list, /경로에 추가/)
  assert.match(list, /선택됨/)
  assert.match(map, /toggle-route/)
  assert.match(view, /toggleLimitedArchiveRouteId/)
  assert.match(view, /ArchiveRouteSelectionBar/)
})

test('archive map loads nearby transport only for the selected exhibition', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  assert.match(view, /watch\(mapSelectedItem/)
  assert.match(view, /fetchNearbyTransport\(\{[\s\S]*?lat:\s*item\.lat,[\s\S]*?lng:\s*item\.lng/)
  assert.match(view, /AbortController/)
  assert.doesNotMatch(view, /Promise\.all\([^)]*fetchNearbyTransport/)
})

test('archive list hides missing transport metadata and exposes filter reset', () => {
  const list = readProjectFile('src/components/archive/ArchiveList.vue')
  assert.match(list, /transportSummary\(item\)/)
  assert.match(list, /v-if="transportSummary\(item\)"/)
  assert.match(list, /필터 초기화/)
})

test('regional archive uses distinct city colors for Gwangju, Jeonbuk, and Jeonnam', () => {
  const mapSource = readProjectFile('src/components/archive/ArchiveMap.vue')
  const listSource = readProjectFile('src/components/archive/ArchiveList.vue')
  const filterSource = readProjectFile('src/components/archive/ArchiveFilters.vue')
  const styles = readProjectFile('src/assets/styles/global.css')

  assert.match(styles, /--ddf-city-gwangju:\s*#[0-9a-fA-F]{6}/)
  assert.match(styles, /--ddf-city-jeonju:\s*#[0-9a-fA-F]{6}/)
  assert.match(styles, /--ddf-city-jeonnam:\s*#[0-9a-fA-F]{6}/)
  assert.match(mapSource, /CITY_COLORS\s*=\s*{[\s\S]*var\(--ddf-city-gwangju\)[\s\S]*var\(--ddf-city-jeonju\)[\s\S]*var\(--ddf-city-jeonnam\)/)
  assert.doesNotMatch(mapSource, /STATUS_MARKER_COLORS/)
  assert.match(listSource, /class="ddf-pill city"/)
  assert.match(filterSource, /city\.id !== 'all' \? city\.id : ''/)
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function markerGroupsFromMapSource(source, items) {
  const match = source.match(/const markerGroups = computed\(\(\) => \{([\s\S]*?)\n\}\)\n\nconst selectedMarkerGroup/)
  assert.ok(match, 'ArchiveMap marker grouping must remain a computed collection')

  const groupBody = match[1].replace(/props\.items/g, 'items')
  return Function('items', 'archiveTypeValue', 'markerStatus', 'hasValidCoordinates', groupBody)(
    items,
    item => item.archiveType,
    current => current,
    sourceFunction(source, 'hasValidCoordinates') || (() => true),
  )
}

function archiveMapItem(id, lat, lng) {
  return {
    id,
    city: 'gwangju',
    cityLabel: '광주',
    venue: id,
    lat,
    lng,
    status: 'ongoing',
    archiveType: 'exhibition',
  }
}

function sourceFunction(source, name) {
  const match = source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))
  return match ? Function(`return (${match[0]})`)() : null
}
