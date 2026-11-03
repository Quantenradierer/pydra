import { DatabaseSync } from 'node:sqlite';
import type { FeedbackCreated, FeedbackEntry } from '@pydra/shared';

/** Feedback entries in SQLite. Pass ':memory:' for tests. */
export class FeedbackStore {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  add(text: string, createdAt: Date): FeedbackCreated {
    const iso = createdAt.toISOString();
    const result = this.db.prepare('INSERT INTO feedback (text, created_at) VALUES (?, ?)').run(text, iso);
    return { id: Number(result.lastInsertRowid), createdAt: iso };
  }

  /** All entries, newest first. */
  list(): FeedbackEntry[] {
    const rows = this.db.prepare('SELECT id, text, created_at FROM feedback ORDER BY id DESC').all() as {
      id: number;
      text: string;
      created_at: string;
    }[];
    return rows.map((r) => ({ id: r.id, text: r.text, createdAt: r.created_at }));
  }

  /** Throws if the database cannot be queried. */
  ping(): void {
    this.db.prepare('SELECT 1').get();
  }

  close(): void {
    this.db.close();
  }
}
