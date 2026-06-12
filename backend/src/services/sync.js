import { getAllUsers } from '../db/database.js';
import {
  clearUserCards,
  createSyncJob,
  finishSyncJob,
  getRunningSyncJob,
  getUsersWithoutSuccessfulSync,
  insertUserCards,
  normalizeCardName,
  upsertUserSyncStatus,
} from '../db/cards.js';
import { searchBinder } from './moxfield.js';

const PAGE_SIZE = Number(process.env.SYNC_PAGE_SIZE) || 50;
const PAGE_DELAY_MS = Number(process.env.SYNC_PAGE_DELAY_MS) || 300;
const USER_DELAY_MS = Number(process.env.SYNC_USER_DELAY_MS) || 500;

let syncInProgress = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aggregatePageCards(cardMap, items) {
  for (const item of items) {
    const cardName = item?.card?.name;
    if (!cardName) continue;

    const key = normalizeCardName(cardName);
    const existing = cardMap.get(key);
    const quantity = item.quantity || 0;

    if (existing) {
      existing.quantity += quantity;
    } else {
      cardMap.set(key, { cardName, quantity });
    }
  }
}

/**
 * Download full binder from Moxfield and store aggregated cards in SQLite.
 */
export async function syncUserBinder(user) {
  const cardMap = new Map();
  let pageNumber = 1;
  let totalPages = 1;
  let pagesSynced = 0;

  upsertUserSyncStatus(user.id, { status: 'running', error: null, cardCount: 0, pagesSynced: 0 });

  try {
    do {
      const result = await searchBinder(user.binderId, { pageNumber, pageSize: PAGE_SIZE });
      totalPages = result.totalPages || 1;
      aggregatePageCards(cardMap, result.data || []);
      pagesSynced = pageNumber;
      pageNumber += 1;

      if (pageNumber <= totalPages) {
        await delay(PAGE_DELAY_MS);
      }
    } while (pageNumber <= totalPages);

    const cards = Array.from(cardMap.values());
    clearUserCards(user.id);
    insertUserCards(user.id, cards);

    upsertUserSyncStatus(user.id, {
      status: 'success',
      error: null,
      cardCount: cards.length,
      pagesSynced,
    });

    return { userId: user.id, name: user.name, cardCount: cards.length, pagesSynced };
  } catch (err) {
    upsertUserSyncStatus(user.id, {
      status: 'error',
      error: err.message,
      cardCount: 0,
      pagesSynced,
    });
    throw err;
  }
}

/**
 * Sync all group members sequentially.
 */
export async function syncAllUsers({ triggeredBy = 'manual' } = {}) {
  if (syncInProgress) {
    const running = getRunningSyncJob();
    throw new Error(running ? `Sync already in progress (job #${running.id})` : 'Sync already in progress');
  }

  const users = getAllUsers();
  if (users.length === 0) {
    throw new Error('No users configured');
  }

  syncInProgress = true;
  const jobId = createSyncJob(triggeredBy, users.length);
  let usersSynced = 0;
  const results = [];
  const errors = [];

  try {
    for (const user of users) {
      try {
        const result = await syncUserBinder(user);
        results.push(result);
        usersSynced += 1;
      } catch (err) {
        errors.push({ name: user.name, error: err.message });
      }

      await delay(USER_DELAY_MS);
    }

    const status = errors.length === users.length ? 'error' : errors.length > 0 ? 'partial' : 'success';
    finishSyncJob(jobId, {
      status,
      usersSynced,
      error: errors.length ? errors.map((e) => `${e.name}: ${e.error}`).join('; ') : null,
    });

    return { jobId, status, usersSynced, usersTotal: users.length, results, errors };
  } catch (err) {
    finishSyncJob(jobId, { status: 'error', usersSynced, error: err.message });
    throw err;
  } finally {
    syncInProgress = false;
  }
}

export async function syncMissingUsers({ triggeredBy = 'missing' } = {}) {
  const users = getUsersWithoutSuccessfulSync();

  if (users.length === 0) {
    return { status: 'skipped', usersSynced: 0, usersTotal: 0, results: [], errors: [] };
  }

  if (syncInProgress) {
    return { status: 'skipped', reason: 'sync in progress' };
  }

  syncInProgress = true;
  const jobId = createSyncJob(triggeredBy, users.length);
  let usersSynced = 0;
  const results = [];
  const errors = [];

  try {
    for (const user of users) {
      try {
        const result = await syncUserBinder(user);
        results.push(result);
        usersSynced += 1;
      } catch (err) {
        errors.push({ name: user.name, error: err.message });
      }

      await delay(USER_DELAY_MS);
    }

    const status = errors.length === users.length ? 'error' : errors.length > 0 ? 'partial' : 'success';
    finishSyncJob(jobId, {
      status,
      usersSynced,
      error: errors.length ? errors.map((e) => `${e.name}: ${e.error}`).join('; ') : null,
    });

    return { jobId, status, usersSynced, usersTotal: users.length, results, errors };
  } catch (err) {
    finishSyncJob(jobId, { status: 'error', usersSynced, error: err.message });
    throw err;
  } finally {
    syncInProgress = false;
  }
}

export function isSyncInProgress() {
  return syncInProgress;
}
