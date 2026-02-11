import { describe, expect, it } from 'vitest'
import { deserializeEmbedding, serializeEmbedding } from '../embedding-codec'

describe('serializeEmbedding / deserializeEmbedding', () => {
  it('roundtrips a vector through serialize → deserialize', () => {
    const original = [0.1, 0.2, 0.3, -0.5, 1.0]
    const blob = serializeEmbedding(original)
    const result = deserializeEmbedding(blob, original.length)

    expect(result).toBeInstanceOf(Float32Array)
    expect(result!.length).toBe(original.length)
    // Float32 precision: compare against the same float32 cast
    expect(Array.from(result!)).toEqual(Array.from(new Float32Array(original)))
  })

  it('preserves known float32 values exactly', () => {
    const values = [0, 1, -1, 0.5, 3.140000104904175]
    const blob = serializeEmbedding(values)
    const result = deserializeEmbedding(blob, values.length)

    expect(result).not.toBeNull()
    expect(Array.from(result!)).toEqual(Array.from(new Float32Array(values)))
  })

  it('roundtrips a 384-dim vector', () => {
    const original = Array.from({ length: 384 }, (_, i) => (i - 192) / 192)
    const blob = serializeEmbedding(original)
    const result = deserializeEmbedding(blob, 384)

    expect(result).toBeInstanceOf(Float32Array)
    expect(result!.length).toBe(384)
    expect(Array.from(result!)).toEqual(Array.from(new Float32Array(original)))
  })

  it('roundtrips an empty vector', () => {
    const blob = serializeEmbedding([])
    const result = deserializeEmbedding(blob, 0)

    expect(result).toBeInstanceOf(Float32Array)
    expect(result!.length).toBe(0)
  })
})

describe('deserializeEmbedding validation', () => {
  it('returns null for dimension mismatch', () => {
    const blob = serializeEmbedding([1, 2, 3])
    expect(deserializeEmbedding(blob, 5)).toBeNull()
  })

  it('returns null for truncated blob', () => {
    const blob = serializeEmbedding([1, 2, 3])
    const truncated = blob.slice(0, blob.length - 2)
    expect(deserializeEmbedding(truncated, 3)).toBeNull()
  })

  it('returns null for non-array input: string', () => {
    expect(deserializeEmbedding('not an array', 3)).toBeNull()
  })

  it('returns null for non-array input: null', () => {
    expect(deserializeEmbedding(null, 3)).toBeNull()
  })

  it('returns null for non-array input: undefined', () => {
    expect(deserializeEmbedding(undefined, 3)).toBeNull()
  })

  it('returns null for non-array input: object', () => {
    expect(deserializeEmbedding({ length: 12 }, 3)).toBeNull()
  })

  it('returns null for non-array input: number', () => {
    expect(deserializeEmbedding(42, 3)).toBeNull()
  })
})

describe('serializeEmbedding', () => {
  it('produces the correct byte count', () => {
    const blob = serializeEmbedding([1, 2, 3])
    expect(blob.length).toBe(3 * 4)
  })

  it('produces a plain number array', () => {
    const blob = serializeEmbedding([1.5])
    expect(Array.isArray(blob)).toBe(true)
    for (const b of blob) {
      expect(typeof b).toBe('number')
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(255)
    }
  })
})
