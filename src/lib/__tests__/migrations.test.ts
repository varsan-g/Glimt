import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSelect = vi.fn()
const mockExecute = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      select: (...args: unknown[]) => mockSelect(...args),
      execute: (...args: unknown[]) => mockExecute(...args),
    }),
  },
}))

import { CURRENT_SCHEMA_VERSION, runMigrations } from '../migrations'
import Database from '@tauri-apps/plugin-sql'

async function getMockDb(): Promise<InstanceType<typeof Database>> {
  return Database.load('sqlite:test.db')
}

beforeEach(() => {
  mockSelect.mockReset()
  mockExecute.mockReset().mockResolvedValue(undefined)
})

describe('runMigrations', () => {
  it('applies all migrations on fresh install (user_version = 0)', async () => {
    mockSelect.mockResolvedValue([{ user_version: 0 }])
    const db = await getMockDb()

    await runMigrations(db)

    // Should have: BEGIN, 9 DDL statements, PRAGMA user_version, COMMIT
    expect(mockExecute).toHaveBeenCalledWith('BEGIN TRANSACTION')
    expect(mockExecute).toHaveBeenCalledWith(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`)
    expect(mockExecute).toHaveBeenCalledWith('COMMIT')

    // Verify CREATE TABLE for ideas was called
    const calls = mockExecute.mock.calls.map((c) => String(c[0]))
    expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS ideas'))).toBe(true)
    expect(calls.some((sql) => sql.includes('CREATE VIRTUAL TABLE IF NOT EXISTS fts_ideas'))).toBe(
      true,
    )
    expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS embeddings'))).toBe(true)
  })

  it('applies all migrations when PRAGMA returns empty result', async () => {
    mockSelect.mockResolvedValue([])
    const db = await getMockDb()

    await runMigrations(db)

    expect(mockExecute).toHaveBeenCalledWith('BEGIN TRANSACTION')
    expect(mockExecute).toHaveBeenCalledWith(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`)
    expect(mockExecute).toHaveBeenCalledWith('COMMIT')
  })

  it('skips all migrations when already at current version', async () => {
    mockSelect.mockResolvedValue([{ user_version: CURRENT_SCHEMA_VERSION }])
    const db = await getMockDb()

    await runMigrations(db)

    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('skips all migrations when ahead of current version', async () => {
    mockSelect.mockResolvedValue([{ user_version: CURRENT_SCHEMA_VERSION + 1 }])
    const db = await getMockDb()

    await runMigrations(db)

    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('only runs pending migrations during partial upgrade', async () => {
    // Simulate V1 already applied, so nothing should run for single-migration registry
    mockSelect.mockResolvedValue([{ user_version: 1 }])
    const db = await getMockDb()

    await runMigrations(db)

    // With only V1 in registry and user_version=1, no migrations run
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('rolls back and throws on migration failure', async () => {
    mockSelect.mockResolvedValue([{ user_version: 0 }])
    let executeCallCount = 0
    mockExecute.mockImplementation(() => {
      executeCallCount++
      // First call is BEGIN TRANSACTION, second is the first DDL — fail it
      if (executeCallCount === 2) return Promise.reject(new Error('disk full'))
      return Promise.resolve(undefined)
    })
    const db = await getMockDb()

    const error = await runMigrations(db).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Migration V1')
    expect(error.message).toContain('disk full')

    // Verify ROLLBACK was called
    const calls = mockExecute.mock.calls.map((c) => String(c[0]))
    expect(calls).toContain('ROLLBACK')
  })

  it('throws original error even when rollback fails', async () => {
    mockSelect.mockResolvedValue([{ user_version: 0 }])
    let executeCallCount = 0
    mockExecute.mockImplementation((sql: string) => {
      executeCallCount++
      // Fail the first DDL statement (second execute call)
      if (executeCallCount === 2) return Promise.reject(new Error('schema error'))
      // Fail the ROLLBACK too
      if (sql === 'ROLLBACK') return Promise.reject(new Error('rollback failed'))
      return Promise.resolve(undefined)
    })
    const db = await getMockDb()

    // Should throw the original migration error, not the rollback error
    const error = await runMigrations(db).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('schema error')
    expect(error.message).not.toContain('rollback failed')
  })
})

describe('CURRENT_SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0)
    expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true)
  })
})
