# tp-mtg

Aplicación web para buscar quién del grupo posee una carta en sus colecciones públicas de [Moxfield](https://www.moxfield.com).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React, Vite, Ant Design, TypeScript |
| Backend | Node.js, Express |
| Base de datos | SQLite (miembros del grupo) |

## Arquitectura (Opción B — sincronización diaria)

```
Cron diario (03:00) o sync manual
       ↓
Backend descarga todos los binders página por página
       ↓
Guarda cartas agregadas en SQLite
       ↓
Usuario busca carta → GET /api/search?q=Mana+Drain
       ↓
Búsqueda local instantánea en SQLite
       ↓
Devuelve: Gonza (1), Vale (2), ...
```

Ventajas: más rápido, menos requests a Moxfield. Los datos pueden estar desactualizados hasta la próxima sync.

Para volver a búsqueda en tiempo real, configurá `SEARCH_MODE=live` en `backend/.env`.

## API de Moxfield

Endpoint utilizado:

```
GET https://api2.moxfield.com/v1/trade-binders/{binderId}/search
```

Parámetros conocidos:

| Parámetro | Descripción |
|-----------|-------------|
| `pageNumber` | Página (default: 1) |
| `pageSize` | Resultados por página (default: 50) |
| `q` | Búsqueda por nombre de carta (hipótesis validada en diseño; el backend filtra coincidencia exacta) |

## Endpoints del backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/search?q=` | Buscar carta (local en SQLite por defecto) |
| GET | `/api/sync/status` | Estado de sincronización por miembro |
| POST | `/api/sync` | Disparar sincronización manual de todas las colecciones |

## Esquema SQLite

```sql
users (id, name, binder_id, created_at)
collection_cards (user_id, card_name, card_name_normalized, quantity)
user_sync_status (user_id, last_sync_at, last_sync_status, card_count, ...)
sync_jobs (id, started_at, finished_at, status, triggered_by, ...)
groups (id, name, created_at)          -- futuro: múltiples grupos
group_members (group_id, user_id)      -- futuro: múltiples grupos
```

## Inicio rápido

```bash
# Instalar dependencias
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Copiar variables de entorno (opcional)
cp backend/.env.example backend/.env

# Levantar backend + frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Configurar miembros

Los binders se definen en código, en `backend/src/config/members.js`:

```js
export const MEMBERS = [
  { name: 'Gonza', binderId: 'fez622JZd0Se7srDoo_Y0Q' },
  { name: 'Vale', binderId: 'tu-binder-id-aqui' },
];
```

Al reiniciar el backend, se sincronizan automáticamente con la base de datos. No hay UI pública para agregar miembros.

## Sincronización

- **Automática**: todos los días a las 03:00 (`SYNC_CRON=0 3 * * *`)
- **Manual**: pestaña **Sincronización** en la app o `POST /api/sync`
- **Al iniciar**: opcional con `SYNC_ON_START=true` (útil la primera vez)

## Mejoras futuras

- **Comparar decklist**: input de lista de cartas → disponibilidad por carta + resumen (82/100 disponibles).
- **Múltiples grupos**: usar tablas `groups` y `group_members` ya preparadas.
- **Rate limiting / caché en memoria**: reducir requests repetidos a Moxfield.

## Nota sobre Cloudflare

Moxfield protege su API con Cloudflare. El backend envía headers de navegador; si recibís errores 502, probá desde tu red local (no desde CI/servidores bloqueados).
