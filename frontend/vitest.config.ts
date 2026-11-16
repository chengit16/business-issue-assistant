/** @description 通过浏览器 DOM 替身验证客户端错误、取消和页面交互，真实浏览器验收独立执行。 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    restoreMocks: true,
    clearMocks: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
