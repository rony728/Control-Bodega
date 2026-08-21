# Control Bodega

Aplicación PWA local para registrar dispositivos en mal estado que serán enviados a bodega. Permite trabajar por gestiones, consultar y editar registros, configurar modelos/estados/fallas, generar Excel y PDF y crear copias de seguridad JSON.

## Tecnologías

React, Vite, JavaScript, CSS responsive, IndexedDB, SheetJS/XLSX, jsPDF y jsPDF-AutoTable. No utiliza backend ni servicios externos.

## Uso local

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev
```

Para generar producción: `npm run build`. Para revisar el build: `npm run preview`.

Los datos se guardan en IndexedDB del navegador, dentro de la base local `control-bodega-db`. Se mantienen aunque se cierre el navegador, pero son propios de cada dispositivo/navegador.

## PWA y copias

Con la aplicación abierta en Chrome o Edge, usa el icono de instalar en la barra de direcciones. En Android, abre la aplicación en Chrome y elige “Instalar aplicación” o “Añadir a pantalla de inicio”. Tras la primera carga, el service worker permite abrir la interfaz sin Internet.

En Configuración puedes exportar un JSON completo. Para restaurarlo, selecciona un archivo generado previamente y confirma; la restauración reemplaza los datos locales actuales.
