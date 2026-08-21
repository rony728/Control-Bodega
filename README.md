# Control Bodega

PWA offline-first para registrar dispositivos en mal estado, organizar envíos a bodega y compartir la información entre dispositivos mediante Supabase cuando existe conexión.

## Arquitectura

- React + Vite + PWA, desplegable en GitHub Pages.
- IndexedDB como fuente inmediata y almacenamiento local offline.
- Supabase Auth, PostgreSQL, RLS y Realtime para sincronización opcional.
- `sync_status` local (`synced`, `pending`, `error`) y eliminación lógica con `deleted_at`.
- Conflictos con estrategia Last Write Wins usando `updated_at`.
- Cursor incremental de sincronización usando `server_updated_at`, independiente del reloj del dispositivo.

La versión sin variables Supabase continúa funcionando en modo local. Si Supabase está configurado, el inventario online requiere una sesión válida; sin conexión se puede seguir trabajando localmente.

## Instalación local

Requiere Node.js 20+ y pnpm 9+.

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm run dev
```

En `.env.local` coloca únicamente los valores públicos del proyecto:

```text
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

Nunca coloques `service_role`, secret keys ni la contraseña de la base de datos en el frontend.

## Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Abre **SQL Editor** y ejecuta completo [`supabase/schema.sql`](supabase/schema.sql).
3. En **Project Settings > API**, copia **Project URL** y la **Publishable key** a `.env.local`.
4. En **Authentication > Users**, crea manualmente los usuarios permitidos. La aplicación no incluye registro público.
5. Verifica que RLS esté habilitado y que el usuario pueda consultar las cinco tablas.
6. Ejecuta `pnpm run dev`, inicia sesión y usa **Configuración > Sincronización > Sincronizar ahora**.

El SQL crea `gestiones`, `dispositivos`, `modelos`, `estados` y `fallas`, sus índices, restricciones RLS autenticadas y la publicación Realtime. La serie de dispositivos tiene un índice único case-insensitive para registros activos; una eliminación lógica permite conservar históricos.

`updated_at` lo asigna el cliente para conservar el momento real de la modificación offline. `server_updated_at` lo asigna PostgreSQL mediante triggers y funciona como cursor incremental. Si la base ya existía, ejecuta [`supabase/fix-sync-timestamps.sql`](supabase/fix-sync-timestamps.sql) y después [`supabase/add-server-updated-at.sql`](supabase/add-server-updated-at.sql); ambos scripts son seguros y no eliminan tablas ni datos.

## Migración y sincronización

IndexedDB se actualizó a la versión 2. Los registros antiguos se migran durante la actualización: reciben UUID, las relaciones `gestionId` se corrigen, se conservan sus campos y quedan `pending` para subirlos después del login.

Cada alta, edición o eliminación escribe primero en IndexedDB y no se bloquea por falta de Internet. Al conectar, el motor sube primero gestiones y catálogos, después dispositivos; luego consulta cambios remotos desde `lastSuccessfulSync`. La cola evita sincronizaciones simultáneas. Realtime dispara una sincronización adicional, pero no es requisito para guardar.

En un conflicto, gana el registro con `updated_at` más reciente. Si PostgreSQL rechaza una serie duplicada, el registro local no se borra: queda con `sync_status = error` y el estado de sincronización muestra el error para corregirlo.

La decisión LWW está aislada en `src/services/syncConflict.js` mediante `compareUpdatedAt()` y `resolveLastWriteWins()`, por lo que puede verificarse sin conexión ni credenciales.

## Backup

En **Configuración** puedes exportar un JSON que incluye los cinco stores y los campos de sincronización, incluidos eliminados lógicamente. Restaurar escribe primero en IndexedDB, asigna estado `pending` y solo después puede sincronizarse con Supabase.

## Build y GitHub Pages

```bash
pnpm run build
pnpm run preview
```

Vite usa `base: '/Control-Bodega/'`, por lo que la URL esperada es:

<https://rony728.github.io/Control-Bodega/>

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) instala dependencias, construye y publica `dist` en GitHub Pages. En GitHub configura **Settings > Secrets and variables > Actions > Variables** con:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Después habilita Pages con **Source: GitHub Actions**. No subas `.env` ni `.env.local`; están excluidos por `.gitignore`.

## PWA

Después de la primera carga en Chrome o Edge, usa el icono de instalación. En Android, abre la URL en Chrome y elige **Instalar aplicación** o **Añadir a pantalla de inicio**. La interfaz y los datos locales siguen disponibles offline; al recuperar conexión se reintentan los cambios pendientes.
