import Database from '@tauri-apps/plugin-sql'
import { deserializeEmbedding, serializeEmbedding } from './embedding-codec'
import { runMigrations } from './migrations'
import type { Idea, IdeaUpdate } from './types'

let db: Database | null = null

async function getDb(): Promise<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

export async function initDb(): Promise<void> {
  if (db) return
  db = await Database.load('sqlite:glimt.db')
  await runMigrations(db)
}

/** Map a DB row (snake_case columns) to an Idea (camelCase fields). */
function rowToIdea(row: Record<string, unknown>): Idea {
  return {
    id: row.id as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    text: row.text as string,
    title: (row.title as string) ?? null,
    archived: (row.archived as number) === 1,
    sourceApp: (row.source_app as string) ?? null,
    markdownPath: (row.markdown_path as string) ?? null,
  }
}

export async function createIdea(text: string): Promise<Idea> {
  const conn = await getDb()
  const id = crypto.randomUUID()
  const now = Date.now()
  await conn.execute(
    'INSERT INTO ideas (id, created_at, updated_at, text) VALUES ($1, $2, $3, $4)',
    [id, now, now, text],
  )
  return {
    id,
    createdAt: now,
    updatedAt: now,
    text,
    title: null,
    archived: false,
    sourceApp: null,
    markdownPath: null,
  }
}

export async function getIdeas(options?: { archived?: boolean }): Promise<Idea[]> {
  const conn = await getDb()
  const archived = options?.archived ? 1 : 0
  const rows = await conn.select<Record<string, unknown>[]>(
    'SELECT * FROM ideas WHERE archived = $1 ORDER BY created_at DESC',
    [archived],
  )
  return rows.map(rowToIdea)
}

export async function getIdea(id: string): Promise<Idea | null> {
  const conn = await getDb()
  const rows = await conn.select<Record<string, unknown>[]>('SELECT * FROM ideas WHERE id = $1', [
    id,
  ])
  const row = rows[0]
  return row ? rowToIdea(row) : null
}

export async function getIdeasByIds(ids: string[]): Promise<Idea[]> {
  if (ids.length === 0) return []
  const conn = await getDb()
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await conn.select<Record<string, unknown>[]>(
    `SELECT * FROM ideas WHERE id IN (${placeholders})`,
    ids,
  )
  return rows.map(rowToIdea)
}

export async function updateIdea(id: string, updates: IdeaUpdate): Promise<void> {
  const conn = await getDb()
  const now = Date.now()

  const setClauses: string[] = ['updated_at = $1']
  const params: unknown[] = [now]
  let paramIndex = 2

  if (updates.text !== undefined) {
    setClauses.push(`text = $${paramIndex}`)
    params.push(updates.text)
    paramIndex++
  }
  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex}`)
    params.push(updates.title)
    paramIndex++
  }

  params.push(id)
  await conn.execute(`UPDATE ideas SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, params)
}

export async function deleteIdea(id: string): Promise<void> {
  const conn = await getDb()
  await conn.execute('DELETE FROM ideas WHERE id = $1', [id])
}

export async function archiveIdea(id: string, archived = true): Promise<void> {
  const conn = await getDb()
  const now = Date.now()
  await conn.execute('UPDATE ideas SET archived = $1, updated_at = $2 WHERE id = $3', [
    archived ? 1 : 0,
    now,
    id,
  ])
}

export async function searchIdeasFts(query: string): Promise<Idea[]> {
  const conn = await getDb()
  const rows = await conn.select<Record<string, unknown>[]>(
    `SELECT ideas.* FROM fts_ideas
     JOIN ideas ON ideas.id = fts_ideas.id
     WHERE fts_ideas MATCH $1
     ORDER BY rank`,
    [query],
  )
  return rows.map(rowToIdea)
}

/** Store (or replace) an embedding vector for a given idea and model. */
export async function storeEmbedding(
  ideaId: string,
  model: string,
  vector: number[],
): Promise<void> {
  const conn = await getDb()
  const blob = serializeEmbedding(vector)
  await conn.execute(
    'INSERT OR REPLACE INTO embeddings (idea_id, model, dims, vector, created_at) VALUES ($1, $2, $3, $4, $5)',
    [ideaId, model, vector.length, blob, Date.now()],
  )
}

/** Retrieve all embeddings for a given model. */
export async function getAllEmbeddings(
  model: string,
): Promise<Array<{ ideaId: string; vector: Float32Array }>> {
  const conn = await getDb()
  const rows = await conn.select<Record<string, unknown>[]>(
    'SELECT idea_id, dims, vector FROM embeddings WHERE model = $1',
    [model],
  )
  return rows.flatMap((row) => {
    const dims = row.dims as number
    const vector = deserializeEmbedding(row.vector, dims)
    if (!vector) {
      console.warn(`Skipping corrupted embedding for idea ${row.idea_id as string}`)
      return []
    }
    return [{ ideaId: row.idea_id as string, vector }]
  })
}

/** Delete all embeddings for a given idea. */
export async function deleteEmbedding(ideaId: string): Promise<void> {
  const conn = await getDb()
  await conn.execute('DELETE FROM embeddings WHERE idea_id = $1', [ideaId])
}
