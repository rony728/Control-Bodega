# Control Bodega

PWA offline-first para registrar dispositivos en mal estado y sincronizarlos con la API propia de Control Bodega.

## Desarrollo

```bash
pnpm install
pnpm dev
```

La URL de la API se configura con `VITE_API_URL`. El valor esperado para producción es:

```dotenv
VITE_API_URL=https://api-control-bodega.rtdev.uk
```

## Sincronización

La aplicación escribe primero en IndexedDB (`control-bodega-db`, versión 2), conserva registros `pending`/`error`, y ejecuta PUSH antes de PULL. Mantiene cursores independientes `lastSuccessfulSync:{entidad}`, aplica Last Write Wins mediante `updated_at`, conserva `server_updated_at` y procesa soft deletes.

La sesión guarda localmente el JWT y los datos básicos del usuario. Con Internet se solicita autenticación; sin Internet se puede continuar trabajando con los datos locales y sincronizar al recuperar la conexión.

## Funciones conservadas

Incluye PWA, backup/restauración JSON, exportación Excel y PDF, configuración de catálogos, reconciliación por clave natural y remapeo de gestiones en dispositivos.

Los scripts SQL de `supabase/` se conservan únicamente como referencia histórica y no participan en el frontend.
