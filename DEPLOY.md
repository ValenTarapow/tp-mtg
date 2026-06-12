# Deploy: Vercel (frontend) + Render (backend)

## Resumen

| Parte | Dónde | Qué hace |
|-------|-------|----------|
| Frontend | Vercel | React estático |
| Backend | Render | Express + SQLite + sync diaria |

---

## 1. Backend en Render

### Opción A — Blueprint (recomendada)

El repo ya incluye `render.yaml` con todo configurado.

1. Entrá a [render.com](https://render.com) → **New** → **Blueprint**
2. Conectá el repo `tp-mtg` de GitHub
3. Render detecta `render.yaml` y crea el servicio `tp-mtg-api`
4. Antes de deployar, en **Environment** agregá manualmente:

```
FRONTEND_URL=https://TU-APP.vercel.app
```

5. **Create Blueprint** y esperá el deploy

> **Plan:** el blueprint usa `starter` porque el disco persistente para SQLite no está disponible en el plan free. Son ~USD 7/mes.

### Opción B — Manual

1. **New** → **Web Service** → repo `tp-mtg`
2. Configuración:

| Campo | Valor |
|-------|-------|
| Root Directory | `backend` |
| Build Command | `npm install && npm rebuild better-sqlite3` |
| Start Command | `npm start` |
| Plan | Starter (necesario para disco) |

3. **Disks** → Add disk:
   - Mount path: `/var/data`
   - Size: 1 GB

4. **Environment Variables**:

```
NODE_VERSION=20.18.0
DB_PATH=/var/data/mtg.db
SEARCH_MODE=cache
SYNC_MISSING_ON_START=true
SYNC_ON_START=false
FRONTEND_URL=https://TU-APP.vercel.app
```

> **Importante:** usá Node **20**, no 26. `better-sqlite3` no es compatible con Node 26 en Render.

`SYNC_MISSING_ON_START=true` sincroniza miembros sin datos al arrancar. `SYNC_ON_START=true` fuerza sync completa de todos (lento, solo si hace falta).

5. Copiá la URL del servicio (ej: `https://tp-mtg-api.onrender.com`)

### Verificar

```bash
curl https://tp-mtg-api.onrender.com/api/health
```

Respuesta esperada: `{"status":"ok",...}`

La primera sync tarda varios minutos. Seguí el progreso en **Logs**.

> Render apaga servicios free/starter tras inactividad. El primer request puede tardar ~30s en despertar.

---

## 2. Frontend en Vercel

1. Proyecto en Vercel → **Settings** → **Environment Variables**

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://tp-mtg-api.onrender.com` |

Sin barra final. Aplicá a Production, Preview y Development.

2. **Deployments** → **Redeploy**

---

## 3. Miembros del grupo

Editá `backend/src/config/members.js` y hacé push:

```js
export const MEMBERS = [
  { name: 'Oto', binderId: '...' },
  { name: 'Valen', binderId: '...' },
];
```

Render redeploya automáticamente y sincroniza miembros nuevos al arrancar.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Búsqueda falla en Vercel | Revisá `VITE_API_URL` y redeploy del frontend |
| CORS error | `FRONTEND_URL` en Render debe coincidir exacto con la URL de Vercel (`https://...`) |
| "No hay datos sincronizados" | Esperá la sync en Logs, o poné `SYNC_ON_START=true` y redeploy |
| Base vacía tras redeploy | Falta el disco en `/var/data` |
| Request muy lento | Render despertando el servicio; el plan pago evita sleep prolongado |
