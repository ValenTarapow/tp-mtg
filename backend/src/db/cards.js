import db from './database.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS collection_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    card_name_normalized TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, card_name_normalized)
  );

  CREATE INDEX IF NOT EXISTS idx_collection_cards_name ON collection_cards(card_name_normalized);

  CREATE TABLE IF NOT EXISTS user_sync_status (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_sync_at TEXT,
    last_sync_status TEXT,
    last_sync_error TEXT,
    card_count INTEGER DEFAULT 0,
    pages_synced INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sync_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    triggered_by TEXT NOT NULL DEFAULT 'manual',
    users_total INTEGER DEFAULT 0,
    users_synced INTEGER DEFAULT 0,
    error_message TEXT
  );
`);

export function normalizeCardName(name) {
  return name.trim().toLowerCase();
}

export function clearUserCards(userId) {
  db.prepare('DELETE FROM collection_cards WHERE user_id = ?').run(userId);
}

export function insertUserCards(userId, cards) {
  const insert = db.prepare(`
    INSERT INTO collection_cards (user_id, card_name, card_name_normalized, quantity)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((entries) => {
    for (const { cardName, quantity } of entries) {
      insert.run(userId, cardName, normalizeCardName(cardName), quantity);
    }
  });

  insertMany(cards);
}

export function upsertUserSyncStatus(userId, { status, error = null, cardCount = 0, pagesSynced = 0 }) {
  db.prepare(`
    INSERT INTO user_sync_status (user_id, last_sync_at, last_sync_status, last_sync_error, card_count, pages_synced)
    VALUES (?, datetime('now'), ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      last_sync_at = datetime('now'),
      last_sync_status = excluded.last_sync_status,
      last_sync_error = excluded.last_sync_error,
      card_count = excluded.card_count,
      pages_synced = excluded.pages_synced
  `).run(userId, status, error, cardCount, pagesSynced);
}

export function getUserSyncStatus(userId) {
  return db
    .prepare(`
      SELECT
        u.id as userId,
        u.name,
        s.last_sync_at as lastSyncAt,
        s.last_sync_status as lastSyncStatus,
        s.last_sync_error as lastSyncError,
        s.card_count as cardCount,
        s.pages_synced as pagesSynced
      FROM users u
      LEFT JOIN user_sync_status s ON s.user_id = u.id
      WHERE u.id = ?
    `)
    .get(userId);
}

export function getAllSyncStatus() {
  return db
    .prepare(`
      SELECT
        u.id as userId,
        u.name,
        s.last_sync_at as lastSyncAt,
        s.last_sync_status as lastSyncStatus,
        s.last_sync_error as lastSyncError,
        s.card_count as cardCount,
        s.pages_synced as pagesSynced
      FROM users u
      LEFT JOIN user_sync_status s ON s.user_id = u.id
      ORDER BY u.name
    `)
    .all();
}

export function escapeLikePattern(value) {
  return value.replace(/[%_\\]/g, '\\$&');
}

function getCacheMeta() {
  const lastSync = db
    .prepare(`
      SELECT MIN(last_sync_at) as oldestSync, MAX(last_sync_at) as newestSync
      FROM user_sync_status
      WHERE last_sync_status = 'success'
    `)
    .get();

  const syncedUserCount = db
    .prepare(`SELECT COUNT(*) as count FROM user_sync_status WHERE last_sync_status = 'success'`)
    .get().count;

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  return {
    syncedUsers: syncedUserCount,
    totalUsers,
    oldestSyncAt: lastSync?.oldestSync || null,
    newestSyncAt: lastSync?.newestSync || null,
  };
}

function findCardsInCache(query) {
  const normalized = normalizeCardName(query);
  const pattern = `%${escapeLikePattern(normalized)}%`;

  const rows = db
    .prepare(`
      SELECT c.card_name as cardName, u.name, u.binder_id as binderId, c.quantity
      FROM collection_cards c
      JOIN users u ON u.id = c.user_id
      WHERE c.card_name_normalized LIKE ? ESCAPE '\\'
      ORDER BY c.card_name, u.name
      LIMIT 500
    `)
    .all(pattern);

  const cardsMap = new Map();
  for (const row of rows) {
    if (!cardsMap.has(row.cardName)) {
      cardsMap.set(row.cardName, { cardName: row.cardName, owners: [] });
    }
    cardsMap.get(row.cardName).owners.push({
      name: row.name,
      quantity: row.quantity,
      binderId: row.binderId,
    });
  }

  return Array.from(cardsMap.values());
}

function pickBestCardMatch(query, cards) {
  if (cards.length === 0) return null;

  const normalized = normalizeCardName(query);
  const exact = cards.find((c) => normalizeCardName(c.cardName) === normalized);
  if (exact) return exact;

  if (cards.length === 1) return cards[0];

  const startsWith = cards.filter((c) => normalizeCardName(c.cardName).startsWith(normalized));
  if (startsWith.length === 1) return startsWith[0];

  return null;
}

export function searchCardInCache(query) {
  const cards = findCardsInCache(query).slice(0, 100);

  return {
    query,
    cards,
    source: 'cache',
    cache: getCacheMeta(),
    searchedAt: new Date().toISOString(),
  };
}

export function searchLineInCache(lineQuery) {
  const cards = findCardsInCache(lineQuery);
  const best = pickBestCardMatch(lineQuery, cards);

  if (best) {
    return {
      query: lineQuery,
      cardName: best.cardName,
      owners: best.owners,
      found: best.owners.length > 0,
    };
  }

  if (cards.length === 0) {
    return {
      query: lineQuery,
      cardName: null,
      owners: [],
      found: false,
    };
  }

  return {
    query: lineQuery,
    cardName: null,
    owners: [],
    found: false,
    ambiguous: cards.slice(0, 10),
  };
}

export function searchListInCache(lines) {
  const results = lines.map((line) => searchLineInCache(line));
  const found = results.filter((r) => r.found).length;

  return {
    results,
    summary: {
      total: results.length,
      found,
      missing: results.length - found,
    },
    source: 'cache',
    cache: getCacheMeta(),
    searchedAt: new Date().toISOString(),
  };
}

export function getUsersWithoutSuccessfulSync() {
  return db
    .prepare(`
      SELECT u.id, u.name, u.binder_id as binderId
      FROM users u
      LEFT JOIN user_sync_status s ON s.user_id = u.id
      WHERE s.last_sync_status IS NULL OR s.last_sync_status != 'success'
      ORDER BY u.name
    `)
    .all();
}

export function hasCacheData() {
  const row = db.prepare('SELECT COUNT(*) as count FROM collection_cards').get();
  return row.count > 0;
}

export function createSyncJob(triggeredBy, usersTotal) {
  const result = db
    .prepare(`
      INSERT INTO sync_jobs (triggered_by, users_total, status)
      VALUES (?, ?, 'running')
    `)
    .run(triggeredBy, usersTotal);

  return result.lastInsertRowid;
}

export function finishSyncJob(jobId, { status, usersSynced, error = null }) {
  db.prepare(`
    UPDATE sync_jobs
    SET finished_at = datetime('now'), status = ?, users_synced = ?, error_message = ?
    WHERE id = ?
  `).run(status, usersSynced, error, jobId);
}

export function getLatestSyncJob() {
  return db
    .prepare(`
      SELECT
        id,
        started_at as startedAt,
        finished_at as finishedAt,
        status,
        triggered_by as triggeredBy,
        users_total as usersTotal,
        users_synced as usersSynced,
        error_message as errorMessage
      FROM sync_jobs
      ORDER BY id DESC
      LIMIT 1
    `)
    .get();
}

export function getRunningSyncJob() {
  return db
    .prepare(`
      SELECT id, started_at as startedAt, status, triggered_by as triggeredBy
      FROM sync_jobs
      WHERE status = 'running'
      ORDER BY id DESC
      LIMIT 1
    `)
    .get();
}
