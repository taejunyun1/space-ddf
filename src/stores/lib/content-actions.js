// src/stores/lib/content-actions.js
import { fetchPublishedContents } from '@/services/contents'

export const contentActions = {
  async hydratePublishedContents() {
    if (this.contentHydrated) return
    this.contentHydrated = true

    try {
      const [shows, projects] = await Promise.all([
        fetchPublishedContents('show'),
        fetchPublishedContents('project'),
      ])
      this.shows = mergeBySlug(this.shows, shows.data, shows.managedSlugs, 'show')
      this.projects = mergeBySlug(this.projects, projects.data, projects.managedSlugs, 'project')
      this.contentSource = 'api'
    } catch {
      this.contentSource = 'static'
    }
  },
  upsertProject(payload) {
    // ✅ _kind 주입
    const withKind = { _kind: 'project', ...payload }
    const i = (this.projects || []).findIndex(p => p.slug === withKind.slug)
    if (i >= 0) this.projects.splice(i, 1, { ...this.projects[i], ...withKind })
    else this.projects.push(withKind)
  },

  upsertShow(payload) {
    // ✅ _kind 주입
    const withKind = { _kind: 'show', ...payload }
    const i = (this.shows || []).findIndex(s => s.slug === withKind.slug)
    if (i >= 0) this.shows.splice(i, 1, { ...this.shows[i], ...withKind })
    else this.shows.push(withKind)
  },

  removeProject(slug) {
    this.projects = (this.projects || []).filter(p => p.slug !== slug)
  },

  removeShow(slug) {
    this.shows = (this.shows || []).filter(s => s.slug !== slug)
  },
}

function mergeBySlug(fallback = [], published = [], managedSlugs = [], kind) {
  const managed = new Set(managedSlugs)
  const result = new Map(fallback.filter(item => !managed.has(item.slug)).map(item => [item.slug, item]))
  for (const item of published) {
    result.set(item.slug, { ...result.get(item.slug), ...item, _kind: kind })
  }
  return [...result.values()]
}
