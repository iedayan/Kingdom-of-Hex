import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const fullReloadAlways = {
  name: 'full-reload-always',
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" })
    return []
  },
}

export default defineConfig({
  root: '',
  base: './',
  plugins: [fullReloadAlways, basicSsl()],
  server: {
    port: 5176,
    watch: {
      ignored: ['**/*.md', '**/*.txt', '**/docs/**'],
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/')) return 'vendor-three'
          if (id.includes('/gsap/')) return 'vendor-gsap'
          if (id.includes('/zod/')) return 'vendor-zod'
          return 'vendor'
        },
      },
    },
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
