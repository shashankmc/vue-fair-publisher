import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), dts({ include: ['src'], insertTypesEntry: true })],
  test: {
    environment: 'jsdom',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueFairPublisher',
      fileName: (format) => `vue-fair-publisher.${format}.js`,
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
        exports: 'named',
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'style.css' : '[name][extname]'),
      },
    },
  },
})
