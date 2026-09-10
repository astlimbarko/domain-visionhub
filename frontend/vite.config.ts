import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    watch: {
      // Config explicita en vez de depender solo de la env var
      // CHOKIDAR_USEPOLLING (docker-compose.yml): en Docker Desktop sobre
      // Windows, el bind mount (./frontend:/app) no siempre propaga los
      // eventos nativos de fs.watch al contenedor -- el proceso de Vite se
      // queda "ciego" a los cambios hasta que se reinicia a mano. Con
      // polling explicito, Vite revisa el mtime de los archivos por
      // intervalo en vez de esperar un evento del SO: funciona igual en
      // Docker, WSL2 o nativo, sin depender de que la env var se propague
      // bien en cada arranque del contenedor.
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    // No precargar en el <head> del arranque los vendors pesados que SOLO
    // usan páginas lazy (recharts, jspdf, framer-motion, @xyflow, el zoom de
    // Anuncios). rolldown-vite los hoisteaba al modulepreload del HTML porque
    // son compartidos por varias rutas lazy -- resultado: ~250-400 kB gzip
    // descargándose en la primera pantalla (login/dashboard) aunque no haya
    // ningún gráfico/PDF/diagrama a la vista (autopsia 2026-09-10, pega
    // fuerte en gama baja/redes lentas). Quitar el HINT de preload no rompe
    // nada: el chunk se sigue cargando solo, pero recién cuando su ruta lazy
    // se abre. `hostType === 'html'` acota el filtro al HTML de arranque -- la
    // precarga runtime de cada ruta lazy (hostType 'js') se mantiene intacta.
    modulePreload: {
      resolveDependencies: (_filename, deps, { hostType }) => {
        if (hostType !== 'html') return deps;
        const soloLazyPesado = /vendor-(charts|pdf|motion|flow|zoom)-/;
        return deps.filter((d) => !soloLazyPesado.test(d));
      },
    },
    rolldownOptions: {
      output: {
        // Separa las dependencias pesadas en chunks propios: quedan cacheadas
        // por el navegador independiente del código de la app (que cambia en
        // cada deploy), y las páginas que no las usan no las descargan.
        codeSplitting: {
          groups: [
            // Utils diminutos compartidos por TODA la app (clsx/tailwind-merge/
            // cva = el helper `cn`; use-sync-external-store lo usan zustand y
            // react-redux). Sin este grupo, rolldown los metía dentro de
            // vendor-charts (recharts también los usa) -- resultado: 53 chunks
            // de páginas que no tienen ningún gráfico importaban vendor-charts
            // (129 kB gzip de recharts) SOLO para usar `cn`, y el chunk se
            // precargaba en el arranque (login incluido). Con su propio grupo
            // eager y chico, `cn` sale de vendor-charts y recharts queda 100%
            // bajo demanda (autopsia 2026-09-10). Va PRIMERO para ganarle la
            // asignación a los grupos de abajo. tiny-invariant/use-sync-...
            // son deps de recharts pero también livianas y compartidas.
            { name: 'vendor-utils', test: /node_modules[\\/](clsx|tailwind-merge|class-variance-authority|tiny-invariant|use-sync-external-store)[\\/]/ },
            // Libs livianas que SÍ se usan en el arranque (Toaster=sonner,
            // tema=next-themes, stores=zustand, editor de foto=react-easy-crop
            // vía Cuenta que es eager). Sacarlas del catch-all 'vendor' de
            // abajo hace que ESE chunk quede solo con código de páginas lazy
            // -- así deja de cargarse en el arranque y de arrastrar sus
            // puentes de 1 símbolo hacia vendor-charts/vendor-pdf, que era lo
            // último que mantenía recharts+jspdf en el camino crítico
            // (autopsia 2026-09-10).
            { name: 'vendor-core', test: /node_modules[\\/](sonner|next-themes|zustand|react-easy-crop)[\\/]/ },
            // recharts v3 arrastra toda una máquina de estado Redux
            // (@reduxjs/toolkit, react-redux, immer, reselect, es-toolkit,
            // eventemitter3) que NO estaba en este grupo -- caía en el
            // catch-all 'vendor' de abajo, que se carga en CUALQUIER ruta
            // (login incluido) por libs livianas como sonner/zustand. Eso
            // metía ~40-60 kB gzip de Redux + un puente hacia recharts en el
            // camino crítico de arranque, aunque no hubiera ningún gráfico
            // (autopsia 2026-09-10). La app no usa ninguna de esas libs
            // directo (solo recharts), así que meterlas acá deja el chunk de
            // gráficos 100% autocontenido y solo se descarga cuando abre una
            // página con gráficos (todas lazy).
            { name: 'vendor-charts', test: /node_modules[\\/](recharts|d3-[\w-]+|victory-vendor|decimal\.js-light|internmap|delaunator|robust-predicates|@reduxjs[\\/]toolkit|react-redux|immer|reselect|es-toolkit|eventemitter3)[\\/]/ },
            { name: 'vendor-radix', test: /node_modules[\\/](radix-ui|@radix-ui|cmdk)[\\/]/ },
            { name: 'vendor-i18n', test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            // Estos 3 caian en el balde catch-all 'vendor' de abajo, mezclados
            // con paquetes livianos usados en el login/dashboard (ej.
            // lucide-react) -- como un chunk es un solo archivo, eso forzaba
            // a descargar @xyflow/react + jspdf + html-to-image + framer-motion
            // enteros en la carga inicial aunque solo se usan en paginas ya
            // lazy (Constructor, exportar PDF/imagen, GestionSubliderVista)
            // que la mayoria de sesiones nunca abre en el primer login (bug
            // real de rendimiento, reportado 2026-08-17). Separados en su
            // propio chunk, solo se piden cuando esa pagina puntual carga.
            { name: 'vendor-flow', test: /node_modules[\\/]@xyflow[\\/]/ },
            { name: 'vendor-pdf', test: /node_modules[\\/](jspdf|jspdf-autotable|html-to-image)[\\/]/ },
            { name: 'vendor-motion', test: /node_modules[\\/]framer-motion[\\/]/ },
            // Solo se usa en el zoom de imagen de Anuncios (ImagenAnuncioZoom.tsx).
            { name: 'vendor-zoom', test: /node_modules[\\/]react-zoom-pan-pinch[\\/]/ },
            // Zod + react-hook-form + resolvers y los ~120 íconos de lucide-react
            // (usados en toda la app, incluidas páginas lazy) caían en el balde
            // catch-all de abajo -- un chunk "cajón de sastre" que crecía sin
            // límite y se descargaba entero en CUALQUIER ruta, aunque esa página
            // no usara formularios ni la mayoría de esos íconos (reportado
            // 2026-09-04, lag de carga inicial en gama baja). Separados en su
            // propio chunk para que quede cacheado aparte del resto.
            { name: 'vendor-forms', test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
})
