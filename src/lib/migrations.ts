import type Database from '@tauri-apps/plugin-sql'

interface Migration {
  readonly version: number
  readonly description: string
  readonly up: (db: Database) => Promise<void>
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema — ideas, FTS, embeddings, indices, triggers',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ideas (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          text TEXT NOT NULL,
          title TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          source_app TEXT,
          markdown_path TEXT
        )
      `)

      await db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_ideas
        USING fts5(id, title, text, content='ideas', content_rowid='rowid')
      `)

      await db.execute(`
        CREATE TABLE IF NOT EXISTS embeddings (
          idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
          model TEXT NOT NULL,
          dims INTEGER NOT NULL,
          vector BLOB NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (idea_id, model)
        )
      `)

      await db.execute('CREATE INDEX IF NOT EXISTS idx_ideas_archived ON ideas(archived)')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at)')
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_ideas_archived_created ON ideas(archived, created_at)',
      )

      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS ideas_ai AFTER INSERT ON ideas BEGIN
          INSERT INTO fts_ideas(id, title, text) VALUES (new.id, new.title, new.text);
        END
      `)
      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS ideas_ad AFTER DELETE ON ideas BEGIN
          INSERT INTO fts_ideas(fts_ideas, id, title, text) VALUES('delete', old.id, old.title, old.text);
        END
      `)
      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS ideas_au AFTER UPDATE ON ideas BEGIN
          INSERT INTO fts_ideas(fts_ideas, id, title, text) VALUES('delete', old.id, old.title, old.text);
          INSERT INTO fts_ideas(id, title, text) VALUES (new.id, new.title, new.text);
        END
      `)
    },
  },
]

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export async function runMigrations(db: Database): Promise<void> {
  const rows = await db.select<Array<Record<string, number>>>('PRAGMA user_version')
  const currentVersion = rows[0]?.user_version ?? 0

  if (currentVersion >= CURRENT_SCHEMA_VERSION) return

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion)

  for (const migration of pending) {
    await db.execute('BEGIN TRANSACTION')
    try {
      await migration.up(db)
      await db.execute(`PRAGMA user_version = ${migration.version}`)
      await db.execute('COMMIT')
    } catch (error) {
      try {
        await db.execute('ROLLBACK')
      } catch {
        // Rollback failed — still throw the original migration error
      }
      throw new Error(
        `Migration V${migration.version} ("${migration.description}") failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
