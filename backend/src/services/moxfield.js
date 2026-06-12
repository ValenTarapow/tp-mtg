import { gotScraping } from 'got-scraping';

const MOXFIELD_API = 'https://api2.moxfield.com/v1';

function buildHeaders() {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://www.moxfield.com',
    Referer: 'https://www.moxfield.com/',
  };

  if (process.env.MOXFIELD_COOKIE) {
    headers.Cookie = process.env.MOXFIELD_COOKIE;
  }

  return headers;
}

/**
 * @param {string} binderId
 * @param {object} options
 * @param {string} [options.q]
 * @param {number} [options.pageNumber]
 * @param {number} [options.pageSize]
 */
export async function searchBinder(binderId, { q, pageNumber = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });

  if (q) {
    params.set('q', q);
  }

  const url = `${MOXFIELD_API}/trade-binders/${binderId}/search?${params}`;

  try {
    const response = await gotScraping({
      url,
      headers: buildHeaders(),
      responseType: 'text',
      timeout: { request: 30000 },
    });

    if (response.statusCode !== 200) {
      const error = new Error(`Moxfield API error (${response.statusCode})`);
      error.status = response.statusCode;
      error.body = String(response.body).slice(0, 500);
      throw error;
    }

    const body = String(response.body);
    if (!body.startsWith('{') && !body.startsWith('[')) {
      const error = new Error('Moxfield returned non-JSON (possible Cloudflare block)');
      error.status = 502;
      error.body = body.slice(0, 200);
      throw error;
    }

    return JSON.parse(body);
  } catch (err) {
    if (err.status) throw err;

    const status = err.response?.statusCode;
    if (status) {
      const error = new Error(`Moxfield API error (${status})`);
      error.status = status;
      error.body = String(err.response?.body || '').slice(0, 500);
      throw error;
    }

    throw err;
  }
}

function normalizeCardName(name) {
  return name.trim().toLowerCase();
}

function matchesCardName(cardName, searchQuery) {
  return normalizeCardName(cardName).includes(normalizeCardName(searchQuery));
}

function collectMatchingCards(data, searchQuery) {
  const cardMap = new Map();

  for (const item of data || []) {
    const cardName = item?.card?.name;
    if (!cardName || !matchesCardName(cardName, searchQuery)) continue;

    const key = normalizeCardName(cardName);
    const existing = cardMap.get(key);
    const quantity = item.quantity || 0;

    if (existing) {
      existing.quantity += quantity;
    } else {
      cardMap.set(key, { cardName, quantity });
    }
  }

  return Array.from(cardMap.values());
}

/**
 * Search a single binder for cards whose name contains the query.
 */
export async function searchCardInBinder(binderId, searchQuery) {
  const result = await searchBinder(binderId, { q: searchQuery, pageSize: 50 });
  return { cards: collectMatchingCards(result.data, searchQuery) };
}

/**
 * Search all group members in parallel.
 * @param {Array<{name: string, binderId: string}>} users
 * @param {string} cardName
 */
export async function searchCardAcrossUsers(users, searchQuery) {
  const searches = users.map(async (user) => {
    try {
      const { cards } = await searchCardInBinder(user.binderId, searchQuery);
      return { name: user.name, binderId: user.binderId, cards, error: null };
    } catch (err) {
      return { name: user.name, binderId: user.binderId, cards: [], error: err.message };
    }
  });

  const results = await Promise.all(searches);
  const cardsMap = new Map();

  for (const { name, binderId, cards } of results) {
    for (const { cardName, quantity } of cards) {
      if (!cardsMap.has(cardName)) {
        cardsMap.set(cardName, { cardName, owners: [] });
      }
      cardsMap.get(cardName).owners.push({ name, quantity, binderId });
    }
  }

  return {
    query: searchQuery,
    cards: Array.from(cardsMap.values()).sort((a, b) => a.cardName.localeCompare(b.cardName)),
    errors: results.filter((r) => r.error).map(({ name, error }) => ({ name, error })),
    searchedAt: new Date().toISOString(),
  };
}
