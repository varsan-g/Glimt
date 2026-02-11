/** Serialize a float vector to a byte array for SQLite BLOB storage. */
export function serializeEmbedding(vector: number[]): number[] {
  return Array.from(new Uint8Array(new Float32Array(vector).buffer))
}

/** Deserialize a SQLite BLOB back to a Float32Array with validation. */
export function deserializeEmbedding(raw: unknown, expectedDims: number): Float32Array | null {
  if (!Array.isArray(raw)) return null

  const expectedBytes = expectedDims * 4
  if (raw.length !== expectedBytes) return null

  const bytes = new Uint8Array(raw)
  const aligned = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

  return new Float32Array(aligned)
}
