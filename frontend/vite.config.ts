/** @description 配置 React、UnoCSS 和同源代理，前端开发服务仅绑定本机。 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [UnoCSS(), react()],
  build: {
    rollupOptions: {
      output: {
        // 稳定第三方实现单独缓存，避免每次业务修改都使 React 和运行时校验器失效。
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (
            /\/node_modules\/(ajv|ajv-formats|fast-uri|fast-deep-equal|json-schema-traverse)\//.test(
              id,
            )
          )
            return 'vendor-validation'
        },
      },
    },
  },
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8000' } } },
})
