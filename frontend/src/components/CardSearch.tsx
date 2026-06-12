import { CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Collapse, Empty, Input, Spin, Tag, Typography } from 'antd';
import { useState } from 'react';
import { searchCard, type SearchResult } from '../api/client';

const { Text } = Typography;

export default function CardSearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  const handleSearch = async (value: string) => {
    const query = value.trim();
    if (!query) return;

    setLoading(true);
    setError(null);
    setLastQuery(query);

    try {
      const data = await searchCard(query);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const collapseItems =
    result?.cards.map((card) => ({
      key: card.cardName,
      label: (
        <span>
          <Text strong>{card.cardName}</Text>{' '}
          <Tag color="purple">{card.owners.length} dueño{card.owners.length !== 1 ? 's' : ''}</Tag>
        </span>
      ),
      children: (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {card.owners.map((owner) => (
            <li key={owner.name}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text strong>
                {owner.name} ({owner.quantity})
              </Text>
            </li>
          ))}
        </ul>
      ),
    })) ?? [];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Input.Search
        placeholder="Ej: Rhystic, Mana Drain, bolt..."
        enterButton={
          <>
            <SearchOutlined /> Search
          </>
        }
        size="large"
        loading={loading}
        onSearch={handleSearch}
        allowClear
      />

      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
        Búsqueda parcial: no hace falta escribir el nombre completo
      </Text>

      <div style={{ marginTop: 32, minHeight: 120 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="Buscando en colección local..." />
          </div>
        )}

        {!loading && error && (
          <Alert type="error" message={error} showIcon style={{ marginTop: 16 }} />
        )}

        {!loading && result?.warnings && result.warnings.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 16, marginBottom: 16 }}
            message="Datos de sincronización incompletos"
            description={result.warnings.join(' ')}
          />
        )}

        {!loading && result?.errors && result.errors.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 16, marginBottom: 16 }}
            message="Algunas colecciones no pudieron consultarse"
            description={result.errors.map((e) => `${e.name}: ${e.error}`).join(' · ')}
          />
        )}

        {!loading && result && !error && (
          <>
            {result.cards.length === 0 ? (
              <Empty
                description={
                  <Text type="secondary">
                    Nadie del grupo tiene cartas que coincidan con <strong>{lastQuery}</strong>
                  </Text>
                }
                style={{ marginTop: 32 }}
              />
            ) : (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  {result.cards.length} carta{result.cards.length !== 1 ? 's' : ''} para{' '}
                  <strong>{result.query}</strong>
                  {result.source === 'cache' && result.cache?.newestSyncAt && (
                    <> · cache del {new Date(result.cache.newestSyncAt).toLocaleString('es-AR')}</>
                  )}
                  {result.source === 'live' && <> · tiempo real</>}
                </Text>
                <Collapse items={collapseItems} defaultActiveKey={result.cards.length === 1 ? [result.cards[0].cardName] : undefined} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
