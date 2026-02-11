export interface Idea {
  id: string
  createdAt: number
  updatedAt: number
  text: string
  title: string | null
  archived: boolean
  sourceApp: string | null
  markdownPath: string | null
}

export interface IdeaUpdate {
  text?: string
  title?: string | null
}

export interface SearchResult {
  idea: Idea
  score: number
  source: 'fts' | 'semantic' | 'both'
}
