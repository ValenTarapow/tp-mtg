import { Router } from 'express';
import { searchCard, searchList } from '../services/localSearch.js';
import { parseCardList } from '../utils/parseList.js';

const router = Router();

router.get('/', async (req, res) => {
  const cardName = (req.query.q || '').trim();

  if (!cardName) {
    return res.status(400).json({ error: 'Query parameter "q" (card name) is required' });
  }

  try {
    const result = await searchCard(cardName);
    res.json(result);
  } catch (err) {
    console.error('Search error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to search collections' });
  }
});

router.post('/list', async (req, res) => {
  const lines = Array.isArray(req.body?.lines)
    ? req.body.lines.map((l) => String(l).trim()).filter(Boolean)
    : parseCardList(req.body?.list || '');

  if (lines.length === 0) {
    return res.status(400).json({ error: 'Enviá al menos una carta (una por línea)' });
  }

  if (lines.length > 200) {
    return res.status(400).json({ error: 'Máximo 200 cartas por búsqueda' });
  }

  try {
    const result = await searchList(lines);
    res.json(result);
  } catch (err) {
    console.error('List search error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to search list' });
  }
});

export default router;
