import { embedForQuery } from '@/lib/ai/embeddings'
import { getAllEmbeddings, getIdeasByIds } from '@/lib/db'
import type { SearchResult } from '@/lib/types'

const EMBEDDING_MODEL = 'multilingual-e5-small'

export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0
  return dot / denominator
}

// Loads all embeddings into memory for cosine similarity. Acceptable for <10k ideas
// (~15MB at 384 dims). For larger datasets, consider chunked loading or moving
// cosine similarity computation into a SQLite extension.
export async function searchIdeas(query: string, topK = 20): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const queryVector = await embedForQuery(query)
  const allEmbeddings = await getAllEmbeddings(EMBEDDING_MODEL)

  const scored = allEmbeddings.map(({ ideaId, vector }) => ({
    ideaId,
    score: cosineSimilarity(queryVector, vector),
  }))

  const topResults = scored.sort((a, b) => b.score - a.score).slice(0, topK)

  const topIds = topResults.map((r) => r.ideaId)
  const ideas = await getIdeasByIds(topIds)
  const ideaMap = new Map(ideas.map((idea) => [idea.id, idea]))

  const results: SearchResult[] = []
  for (const { ideaId, score } of topResults) {
    const idea = ideaMap.get(ideaId)
    if (idea) {
      results.push({ idea, score, source: 'semantic' })
    }
  }
  return results
}
