import { CheckCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Input, List, Spin, Statistic, Tag, Typography } from 'antd';
import { useState } from 'react';
import { searchCardList, type ListSearchResult } from '../api/client';

const { Title, Text } = Typography;

export default function ListSearch() {
  const [list, setList] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ListSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const text = list.trim();
    if (!text) return;

    setLoading(true);
    setError(null);

    try {
      const data = await searchCardList(text);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        Search list
      </Title>

      <Input.TextArea
        rows={8}
        placeholder={'Una carta por línea, por ejemplo:\n\nrhystic study\nkrenko, mob boss\n1 Sol Ring'}
        value={list}
        onChange={(e) => setList(e.target.value)}
        style={{ fontFamily: 'monospace' }}
      />

      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        Podés pegar una decklist. Se ignora la cantidad al inicio (ej: `1x`, `2`).
      </Text>

      <Button
        type="primary"
        size="large"
        icon={<SearchOutlined />}
        loading={loading}
        onClick={handleSearch}
        block
        style={{ marginTop: 16 }}
      >
        Search list
      </Button>

      <div style={{ marginTop: 32, minHeight: 120 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="Buscando en colección local..." />
          </div>
        )}

        {!loading && error && <Alert type="error" message={error} showIcon style={{ marginTop: 16 }} />}

        {!loading && result?.warnings && result.warnings.length > 0 && (
          <Alert type="warning" showIcon message="Datos incompletos" description={result.warnings.join(' ')} style={{ marginBottom: 16 }} />
        )}

        {!loading && result && !error && (
          <>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 24 }}>
              <Statistic title="Total" value={result.summary.total} />
              <Statistic title="Disponibles" value={result.summary.found} valueStyle={{ color: '#52c41a' }} />
              <Statistic title="Faltantes" value={result.summary.missing} valueStyle={{ color: '#cf1322' }} />
            </div>

            <List
              bordered
              dataSource={result.results}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      item.found ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 22 }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#cf1322', fontSize: 22 }} />
                      )
                    }
                    title={
                      <span>
                        <Text strong>{item.cardName || item.query}</Text>
                        {item.cardName && item.cardName.toLowerCase() !== item.query.toLowerCase() && (
                          <Text type="secondary"> · buscaste: {item.query}</Text>
                        )}
                      </span>
                    }
                    description={
                      item.found ? (
                        item.owners.map((o) => `${o.name} (${o.quantity})`).join(' · ')
                      ) : item.ambiguous?.length ? (
                        <span>
                          Varias coincidencias:{' '}
                          {item.ambiguous.map((c) => (
                            <Tag key={c.cardName}>{c.cardName}</Tag>
                          ))}
                        </span>
                      ) : (
                        <Text type="secondary">Nadie la tiene</Text>
                      )
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
