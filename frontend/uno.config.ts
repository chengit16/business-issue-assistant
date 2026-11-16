/** @description 通过 UnoCSS 维护常规布局和面板语义，复杂响应式及视觉细节保留在受控样式中。 */
import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  shortcuts: {
    panel: 'border border-solid border-[#e5eae4] bg-white rounded-11px p-25px max-[680px]:p-20px',
  },
})
