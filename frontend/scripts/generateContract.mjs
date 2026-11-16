/** @description 从后端实际 OpenAPI 生成前端类型，检查模式拒绝手动修改或过期的产物。 */
import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

const checking = process.argv.includes('--check')
const result = spawnSync(
  'uv',
  ['run', 'python', '-m', 'scripts.export_contract', ...(checking ? ['--check'] : [])],
  {
    cwd: new URL('../../backend', import.meta.url),
    stdio: 'inherit',
  },
)
if (result.status !== 0) process.exit(result.status ?? 1)
const ast = await openapiTS(new URL('../../backend/openapi.json', import.meta.url))
const text =
  '/** @description 由后端 OpenAPI 自动生成，请通过 npm run contract:generate 更新。 */\n' +
  astToString(ast)
const output = new URL('../src/api/generated.ts', import.meta.url)
if (checking) {
  if ((await readFile(output, 'utf8').catch(() => '')) !== text) {
    console.error('前端类型已过期，请执行 npm run contract:generate')
    process.exit(1)
  }
} else {
  await writeFile(output, text)
}
