import { getAllUsers } from '../db/database.js';
import { hasCacheData, searchCardInCache, searchListInCache } from '../db/cards.js';
import { searchCardAcrossUsers } from './moxfield.js';

const SEARCH_MODE = process.env.SEARCH_MODE || 'cache';

function attachCacheWarnings(result) {
  if (!hasCacheData()) {
    result.warnings = ['No hay datos sincronizados. Ejecutá una sincronización primero.'];
  } else if (result.cache.syncedUsers < result.cache.totalUsers) {
    result.warnings = [
      `Solo ${result.cache.syncedUsers} de ${result.cache.totalUsers} miembros tienen colección sincronizada.`,
    ];
  } else {
    result.warnings = [];
  }
  return result;
}

export async function searchCard(cardName) {
  const users = getAllUsers();

  if (users.length === 0) {
    const error = new Error('No users configured. Add group members first.');
    error.status = 404;
    throw error;
  }

  const useCache = SEARCH_MODE === 'cache' || (SEARCH_MODE === 'auto' && hasCacheData());

  if (useCache) {
    return attachCacheWarnings(searchCardInCache(cardName));
  }

  const live = await searchCardAcrossUsers(users, cardName);
  return { ...live, source: 'live', warnings: [] };
}

export async function searchList(lines) {
  const users = getAllUsers();

  if (users.length === 0) {
    const error = new Error('No users configured. Add group members first.');
    error.status = 404;
    throw error;
  }

  if (lines.length === 0) {
    const error = new Error('La lista está vacía');
    error.status = 400;
    throw error;
  }

  const useCache = SEARCH_MODE === 'cache' || (SEARCH_MODE === 'auto' && hasCacheData());

  if (useCache) {
    return attachCacheWarnings(searchListInCache(lines));
  }

  const results = [];
  for (const line of lines) {
    const live = await searchCardAcrossUsers(users, line);
    const best = live.cards.length === 1 ? live.cards[0] : live.cards.find(
      (c) => c.cardName.toLowerCase() === line.toLowerCase(),
    );

    if (best) {
      results.push({
        query: line,
        cardName: best.cardName,
        owners: best.owners,
        found: best.owners.length > 0,
      });
    } else if (live.cards.length === 0) {
      results.push({ query: line, cardName: null, owners: [], found: false });
    } else {
      results.push({
        query: line,
        cardName: null,
        owners: [],
        found: false,
        ambiguous: live.cards,
      });
    }
  }

  const found = results.filter((r) => r.found).length;

  return {
    results,
    summary: { total: results.length, found, missing: results.length - found },
    source: 'live',
    warnings: [],
    searchedAt: new Date().toISOString(),
  };
}
