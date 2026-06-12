export interface Owner {
  name: string;
  quantity: number;
  binderId: string;
}

export interface CardMatch {
  cardName: string;
  owners: Owner[];
}

export interface SearchResult {
  query: string;
  cards: CardMatch[];
  errors?: { name: string; error: string }[];
  warnings?: string[];
  source?: 'cache' | 'live';
  cache?: {
    syncedUsers: number;
    totalUsers: number;
    oldestSyncAt: string | null;
    newestSyncAt: string | null;
  };
  searchedAt: string;
}

export interface ListSearchLine {
  query: string;
  cardName: string | null;
  owners: Owner[];
  found: boolean;
  ambiguous?: CardMatch[];
}

export interface ListSearchResult {
  results: ListSearchLine[];
  summary: {
    total: number;
    found: number;
    missing: number;
  };
  warnings?: string[];
  source?: 'cache' | 'live';
  cache?: SearchResult['cache'];
  searchedAt: string;
}

export async function searchCard(cardName: string): Promise<SearchResult> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(cardName)}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Search failed (${response.status})`);
  }

  return response.json();
}

export async function searchCardList(list: string): Promise<ListSearchResult> {
  const response = await fetch('/api/search/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Search failed (${response.status})`);
  }

  return response.json();
}
