# Deploy: Vercel (frontend) + Railway (backend)

## Resumen

| Parte | Dónde | Qué hace |
|-------|-------|----------|
| Frontend | Vercel | React estático |
| Backend | Railway | Express + SQLite + sync diaria |

---

## 1. Backend en Railway

### Crear el servicio

1. Entrá a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Elegí el repo `tp-mtg`
3. En el servicio → **Settings** → **Root Directory** → `backend`
4. **Settings** → **Networking** → **Generate Domain** (copiá la URL, ej: `https://tp-mtg-production.up.railway.app`)

### Volumen para SQLite (importante)

Sin esto, la base se borra en cada redeploy.

1. En el servicio → pestaña **Volumes** → **Add Volume**
2. Mount path: `/app/data`
3. En **Variables**, agregá:

```
DB_PATH=/app/data/mtg.db
SEARCH_MODE=cache
SYNC_MISSING_ON_START=true
SYNC_ON_START=true
FRONTEND_URL=https://TU-APP.vercel.app
```

`SYNC_ON_START=true` solo la primera vez (descarga todas las colecciones). Después podés ponerlo en `false`.

### Verificar

```bash
curl https://TU-BACKEND.up.railway.app/api/health
```

Debería responder `{"status":"ok",...}`.

La primera sync tarda varios minutos (miles de cartas por miembro). Mirá los **Logs** en Railway.

---

## 2. Frontend en Vercel

### Variable de entorno

En el proyecto de Vercel → **Settings** → **Environment Variables**:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://TU-BACKEND.up.railway.app` |

Sin barra final. Aplicá a Production, Preview y Development.

### Redeploy

**Deployments** → los tres puntos del último deploy → **Redeploy**.

Vercel ya tiene `vercel.json` configurado para buildear el frontend.

---

## 3. Miembros del grupo

Los binders están en código, no en la UI:

`backend/src/config/members.js`

```js
export const MEMBERS = [
  { name: 'Oto', binderId: '...' },
  { name: 'Valen', binderId: '...' },
];
```

Cada cambio requiere push a GitHub. Railway redeploya solo y sincroniza miembros nuevos al arrancar.

---

## Alternativa: Render

1. [render.com](https://render.com) → **New Web Service** → repo `tp-mtg`
2. Root Directory: `backend`
3. Build: `npm install` · Start: `npm start`
4. Agregá un **Disk** montado en `/var/data` y `DB_PATH=/var/data/mtg.db`
5. Mismas variables de entorno que Railway
6. Usá la URL de Render en `VITE_API_URL` de Vercel

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Búsqueda falla en Vercel | Revisá `VITE_API_URL` y redeploy del frontend |
| CORS error | `FRONTEND_URL` en Railway debe coincidir exacto con la URL de Vercel (con `https://`) |
| "No hay datos sincronizados" | Esperá la sync en Logs, o poné `SYNC_ON_START=true` y redeploy |
| Base vacía tras redeploy | Falta el volumen en Railway/Render |
