// Однократное переключение этапа. Старые строки reading_progress остаются
// под прежними plan_id и не участвуют в баллах нового плана.
export function applyPlanTransition(db, { transitionId, planId, startedAt }) {
  if (!transitionId) return 0;
  db.exec(`CREATE TABLE IF NOT EXISTS plan_transitions (
    id TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS archived_plan_memberships (
    transition_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    plan_started_at TEXT,
    archived_at INTEGER NOT NULL,
    PRIMARY KEY (transition_id, user_id)
  )`);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (db.prepare('SELECT id FROM plan_transitions WHERE id = ?').get(transitionId)) {
      db.exec('COMMIT');
      return 0;
    }
    const now = Date.now();
    db.prepare(`INSERT INTO archived_plan_memberships
      (transition_id, user_id, plan_id, plan_started_at, archived_at)
      SELECT ?, id, plan_id, plan_started_at, ? FROM users
      WHERE plan_id IS NOT NULL AND plan_id <> ?`).run(transitionId, now, planId);
    const result = db.prepare(`UPDATE users SET plan_id = ?, plan_started_at = ?
      WHERE plan_id IS NULL OR plan_id <> ?`).run(planId, startedAt, planId);
    db.prepare('INSERT INTO plan_transitions (id, applied_at) VALUES (?, ?)').run(transitionId, now);
    db.exec('COMMIT');
    return result.changes;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Отдельная метка нужна для баз, в которых переключение плана уже выполнено.
// Архив хранит все исходные поля, включая связи ответов и лайков; активные
// таблицы очищаются только в той же транзакции, что и копирование.
export function archiveStageContent(db, transitionId) {
  if (!transitionId) return 0;
  db.exec(`CREATE TABLE IF NOT EXISTS content_archive_runs (
    transition_id TEXT PRIMARY KEY,
    archived_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS archived_stage_content (
    transition_id TEXT NOT NULL,
    source_table TEXT NOT NULL,
    source_rowid INTEGER NOT NULL,
    row_data TEXT NOT NULL,
    PRIMARY KEY (transition_id, source_table, source_rowid)
  )`);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (db.prepare('SELECT 1 FROM content_archive_runs WHERE transition_id = ?').get(transitionId)) {
      db.exec('COMMIT');
      return 0;
    }
    const tables = ['likes', 'answer_likes', 'question_answers', 'notes', 'questions'];
    const insert = db.prepare(`INSERT INTO archived_stage_content
      (transition_id, source_table, source_rowid, row_data) VALUES (?, ?, ?, ?)`);
    let count = 0;
    for (const table of tables) {
      for (const { archive_rowid, ...row } of db.prepare(`SELECT rowid AS archive_rowid, * FROM ${table}`).all()) {
        insert.run(transitionId, table, archive_rowid, JSON.stringify(row));
        count++;
      }
    }
    // Сначала зависимые строки: внешние ключи остаются включёнными.
    for (const table of tables) db.exec(`DELETE FROM ${table}`);
    db.prepare('INSERT INTO content_archive_runs (transition_id, archived_at) VALUES (?, ?)').run(transitionId, Date.now());
    db.exec('COMMIT');
    return count;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
