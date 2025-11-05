// src/stores/lib/content-actions.js

export const contentActions = {
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