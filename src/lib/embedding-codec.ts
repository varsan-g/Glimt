/** Serialize a float vector to a byte array for SQLite BLOB storage. */
export function serializeEmbedding(vector: number[]): number[] {
  return Array.from(new Uint8Array(new Float32Array(vector).buffer))
}

/** Normalize raw BLOB data from tauri-plugin-sql into a byte array. */
function normalizeToBytes(raw: unknown): number[] | null {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return null
    }
  }
  if (Array.isArray(raw)) return raw
  if (raw instanceof Uint8Array) return Array.from(raw)
  if (raw instanceof ArrayBuffer) return Array.from(new Uint8Array(raw))
  return null
}

/** Deserialize a SQLite BLOB back to a Float32Array with validation. */
export function deserializeEmbedding(raw: unknown, expectedDims: number): Float32Array | null {
  const expectedBytes = expectedDims * 4

  const byteValues = normalizeToBytes(raw)
  if (!byteValues || byteValues.length !== expectedBytes) return null

  const bytes = new Uint8Array(byteValues)
  const aligned = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new Float32Array(aligned)
}
