import { describe, expect, it, vi } from 'vitest'

// Mock modules with side effects to prevent Worker instantiation
vi.mock('@/lib/ai/embeddings', () => ({
  embedForQuery: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getAllEmbeddings: vi.fn(),
  getIdeasByIds: vi.fn(),
}))

import { cosineSimilarity } from '../search'

describe('cosineSimilarity', () => {
  it('returns 1 for identical number[] vectors', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10)
  })

  it('returns 1 for identical Float32Array vectors', () => {
    const v = new Float32Array([0.5, -0.3, 0.8])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10)
  })

  it('returns 0 for three-dimensional orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 0, 1]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10)
  })

  it('returns 0 when first vector is zero', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  it('returns 0 when second vector is zero', () => {
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0)
  })

  it('returns 0 when both vectors are zero', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0]
    const b = [-1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10)
  })

  it('handles mixed number[] and Float32Array inputs', () => {
    const a = [1, 2, 3]
    const b = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5)
  })

  it('iterates over a.length when a is shorter than b (extra b elements ignored)', () => {
    // a=[1,0], b=[1,0,999] → loop runs 2 times, b[2]=999 is never read
    // dot=1, normA=1, normB=1 → result=1
    const a = [1, 0]
    const b = [1, 0, 999]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10)
  })

  it('treats missing b elements as 0 when b is shorter than a', () => {
    // a=[1,0,0], b=[1,0] → loop runs 3 times, b[2]=undefined → 0
    // dot=1, normA=1, normB=1 → result=1
    const a = [1, 0, 0]
    const b = [1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10)
  })

  it('does not throw on mismatched lengths', () => {
    expect(() => cosineSimilarity([1, 2, 3], [1])).not.toThrow()
    expect(() => cosineSimilarity([1], [1, 2, 3])).not.toThrow()
  })
})
