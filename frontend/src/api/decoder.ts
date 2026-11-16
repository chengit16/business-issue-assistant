/**
 * @description 使用后端生成的 JSON Schema 校验未知响应，类型与校验规则来自同一 OpenAPI。
 */
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import contract from './contract.json'
import type { components } from './generated'

type Schemas = components['schemas']
const validator = new Ajv2020({ strict: false, allErrors: true })
addFormats(validator)
validator.addSchema(contract)
const references = new Map(
  Object.keys(contract.$defs).map((name) => [name, { $ref: `${contract.$id}#/$defs/${name}` }]),
)

/** 服务端响应与公开契约不一致，禁止把未知数据作为已校验业务对象返回。 */
export class ContractError extends Error {
  constructor(schema: string) {
    super(`服务返回格式有误，请联系维护人核对 ${schema} 契约`)
    this.name = 'ContractError'
  }
}

/** 按生成的 Schema 校验响应，成功后返回可信类型，失败抛出 ContractError。 */
export function decode<K extends keyof Schemas>(schema: K, value: unknown): Schemas[K] {
  const reference = references.get(schema)
  if (!reference) throw new ContractError(schema)
  const check = validator.compile<Schemas[K]>(reference)
  if (!check(value)) throw new ContractError(schema)
  return value
}
