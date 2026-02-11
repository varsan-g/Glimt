import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Idea } from '../types'
import { serializeEmbedding } from '../embedding-codec'

// --- Mocks ---

const mockSelect = vi.fn().mockResolvedValue([])
const mockExecute = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      select: (...args: unknown[]) => mockSelect(...args),
      execute: (...args: unknown[]) => mockExecute(...args),
    }),
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  embedForQuery: vi.fn(),
}))

// Import after mocks are set up
import { searchIdeas } from '../search'
import { initDb, searchIdeasFts } from '../db'
import { embedForQuery } from '@/lib/ai/embeddings'

// --- Helpers ---

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'idea-1',
    created_at: 1700000000000,
    updated_at: 1700000000000,
    text: 'test idea',
    title: null,
    archived: 0,
    source_app: null,
    markdown_path: null,
    ...overrides,
  }
}

function assertIdea(idea: Idea, expected: { id: string; text: string; archived: boolean }): void {
  expect(idea.id).toBe(expected.id)
  expect(idea.text).toBe(expected.text)
  expect(idea.archived).toBe(expected.archived)
}

// --- Setup ---

beforeAll(async () => {
  await initDb()
})

beforeEach(() => {
  mockSelect.mockReset()
  mockExecute.mockReset().mockResolvedValue(undefined)
  vi.mocked(embedForQuery).mockReset()
})

// --- Tests ---

describe('FTS search', () => {
  it('returns relevant results with correct idea mapping', async () => {
    mockSelect.mockResolvedValue([
      makeRow({ id: 'fts-1', text: 'meeting notes from standup', title: 'Standup' }),
      makeRow({ id: 'fts-2', text: 'meeting agenda for Q4', title: null }),
    ])

    const results = await searchIdeasFts('meeting')

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('fts-1')
    expect(results[0].text).toBe('meeting notes from standup')
    expect(results[0].title).toBe('Standup')
    expect(results[1].id).toBe('fts-2')

    // Verify the SQL calls the FTS table
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('fts_ideas MATCH'), ['meeting'])
  })

  it('maps snake_case columns to camelCase idea fields', async () => {
    mockSelect.mockResolvedValue([
      makeRow({
        id: 'map-test',
        created_at: 1000,
        updated_at: 2000,
        source_app: 'browser',
        markdown_path: '/export/idea.md',
        archived: 1,
      }),
    ])

    const results = await searchIdeasFts('anything')

    expect(results).toHaveLength(1)
    expect(results[0].createdAt).toBe(1000)
    expect(results[0].updatedAt).toBe(2000)
    expect(results[0].sourceApp).toBe('browser')
    expect(results[0].markdownPath).toBe('/export/idea.md')
    expect(results[0].archived).toBe(true)
  })
})

describe('semantic search', () => {
  it('ranks results by cosine similarity (highest first)', async () => {
    // Query vector points in X direction
    vi.mocked(embedForQuery).mockResolvedValue([1, 0, 0])

    mockSelect.mockImplementation((sql: string) => {
      if (sql.includes('embeddings')) {
        return Promise.resolve([
          {
            idea_id: 'far',
            dims: 3,
            vector: serializeEmbedding([0, 1, 0]),
          },
          {
            idea_id: 'close',
            dims: 3,
            vector: serializeEmbedding([0.9, 0.1, 0]),
          },
          {
            idea_id: 'medium',
            dims: 3,
            vector: serializeEmbedding([0.5, 0.5, 0]),
          },
        ])
      }
      if (sql.includes('ideas')) {
        return Promise.resolve([
          makeRow({ id: 'close', text: 'close idea' }),
          makeRow({ id: 'far', text: 'far idea' }),
          makeRow({ id: 'medium', text: 'medium idea' }),
        ])
      }
      return Promise.resolve([])
    })

    const results = await searchIdeas('test query')

    expect(results).toHaveLength(3)
    expect(results[0].idea.id).toBe('close')
    expect(results[1].idea.id).toBe('medium')
    expect(results[2].idea.id).toBe('far')

    // Scores should be descending
    expect(results[0].score).toBeGreaterThan(results[1].score)
    expect(results[1].score).toBeGreaterThan(results[2].score)
  })

  it('sets source to "semantic" for all results', async () => {
    vi.mocked(embedForQuery).mockResolvedValue([1, 0])

    mockSelect.mockImplementation((sql: string) => {
      if (sql.includes('embeddings')) {
        return Promise.resolve([{ idea_id: 'id-1', dims: 2, vector: serializeEmbedding([1, 0]) }])
      }
      if (sql.includes('ideas')) {
        return Promise.resolve([makeRow({ id: 'id-1' })])
      }
      return Promise.resolve([])
    })

    const results = await searchIdeas('query')
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe('semantic')
  })
})

describe('archive filtering', () => {
  it('semantic search includes archived ideas (no archive filter in search)', async () => {
    vi.mocked(embedForQuery).mockResolvedValue([1, 0])

    mockSelect.mockImplementation((sql: string) => {
      if (sql.includes('embeddings')) {
        return Promise.resolve([
          { idea_id: 'archived-idea', dims: 2, vector: serializeEmbedding([1, 0]) },
          { idea_id: 'active-idea', dims: 2, vector: serializeEmbedding([0.8, 0.2]) },
        ])
      }
      if (sql.includes('ideas')) {
        return Promise.resolve([
          makeRow({ id: 'archived-idea', text: 'old idea', archived: 1 }),
          makeRow({ id: 'active-idea', text: 'new idea', archived: 0 }),
        ])
      }
      return Promise.resolve([])
    })

    const results = await searchIdeas('test')

    expect(results).toHaveLength(2)

    const archivedResult = results.find((r) => r.idea.id === 'archived-idea')
    const activeResult = results.find((r) => r.idea.id === 'active-idea')

    assertIdea(archivedResult!.idea, { id: 'archived-idea', text: 'old idea', archived: true })
    assertIdea(activeResult!.idea, { id: 'active-idea', text: 'new idea', archived: false })
  })

  it('FTS search includes archived ideas (no archive filter in FTS)', async () => {
    mockSelect.mockResolvedValue([
      makeRow({ id: 'archived', archived: 1, text: 'archived content' }),
      makeRow({ id: 'active', archived: 0, text: 'active content' }),
    ])

    const results = await searchIdeasFts('content')

    expect(results).toHaveLength(2)
    expect(results.some((r) => r.archived === true)).toBe(true)
    expect(results.some((r) => r.archived === false)).toBe(true)
  })
})

describe('empty query', () => {
  it('returns empty array for empty string', async () => {
    const results = await searchIdeas('')
    expect(results).toEqual([])
    expect(embedForQuery).not.toHaveBeenCalled()
  })

  it('returns empty array for whitespace-only query', async () => {
    const results = await searchIdeas('   ')
    expect(results).toEqual([])
    expect(embedForQuery).not.toHaveBeenCalled()
  })
})
