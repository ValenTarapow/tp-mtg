import { ConfigProvider, Layout, Tabs, Typography, theme } from 'antd';
import CardSearch from './components/CardSearch';
import ListSearch from './components/ListSearch';
import './App.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6b2d5c',
          borderRadius: 8,
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            MTG Collection Search
          </Title>
        </Header>

        <Content style={{ padding: '48px 24px' }}>
          <Tabs
            centered
            items={[
              { key: 'single', label: 'Single', children: <CardSearch /> },
              { key: 'list', label: 'List', children: <ListSearch /> },
            ]}
          />
        </Content>

        <Footer style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Búsqueda local en SQLite · Sincronización diaria desde la API de Moxfield
          </Text>
        </Footer>
      </Layout>
    </ConfigProvider>
  );
}
