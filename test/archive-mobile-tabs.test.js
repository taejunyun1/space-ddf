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

test('regional archive mobile list view fills the remaining viewport height', () => {
  const source = readProjectFile('src/views/RegionalArchiveView.vue')

  assert.match(source, /\.mobile-list-view\s+\.archive-list-pane\s*{[\s\S]*min-height:\s*calc\(100dvh -/)
  assert.match(source, /\.archive-list-content\s*{[\s\S]*flex:\s*1 1 auto/)
  assert.match(source, /\.archive-list-content\s*{[\s\S]*min-height:\s*0/)
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

test('regional archive map contains only ongoing records and links to the planner', () => {
  const view = readProjectFile('src/views/RegionalArchiveView.vue')
  const map = readProjectFile('src/components/archive/ArchiveMap.vue')

  assert.match(view, /ongoingArchiveItems\(filteredItems\.value\)/)
  assert.doesNotMatch(view, /item\.status\s*!==\s*'closed'/)
  assert.match(view, /:selection-unavailable="mapSelectionUnavailable"/)
  assert.match(map, /name:\s*'archive-route'/)
  assert.match(map, /query:\s*{\s*to:\s*selectedItem\.id\s*}/)
  assert.match(map, />길찾기</)
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
