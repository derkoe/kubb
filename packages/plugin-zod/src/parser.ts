import transformers from '@kubb/core/transformers'
import type { SchemaObject } from '@kubb/oas'

import type { Schema, SchemaKeywordBase, SchemaMapper } from '@kubb/plugin-oas'
import { isKeyword, SchemaGenerator, type SchemaKeywordMapper, type SchemaTree, schemaKeywords } from '@kubb/plugin-oas'

const zodKeywordMapper = {
  any: () => 'z.any()',
  unknown: () => 'z.unknown()',
  void: () => 'z.void()',
  number: (coercion?: boolean, min?: number, max?: number) => {
    return [coercion ? 'z.coerce.number()' : 'z.number()', min !== undefined ? `.min(${min})` : undefined, max !== undefined ? `.max(${max})` : undefined]
      .filter(Boolean)
      .join('')
  },
  integer: (coercion?: boolean, min?: number, max?: number, version: '3' | '4' = '3') => {
    return [
      coercion ? 'z.coerce.number().int()' : version === '4' ? 'z.int()' : 'z.number().int()',
      min !== undefined ? `.min(${min})` : undefined,
      max !== undefined ? `.max(${max})` : undefined,
    ]
      .filter(Boolean)
      .join('')
  },
  interface: (value?: string, strict?: boolean) => {
    if (strict) {
      return `z.strictInterface({
    ${value}
    })`
    }
    return `z.interface({
    ${value}
    })`
  },
  object: (value?: string, strict?: boolean, version: '3' | '4' = '3') => {
    if (version === '4' && strict) {
      return `z.strictObject({
    ${value}
    })`
    }

    if (strict) {
      return `z.object({
    ${value}
    }).strict()`
    }

    return `z.object({
    ${value}
    })`
  },
  string: (coercion?: boolean, min?: number, max?: number) => {
    return [coercion ? 'z.coerce.string()' : 'z.string()', min !== undefined ? `.min(${min})` : undefined, max !== undefined ? `.max(${max})` : undefined]
      .filter(Boolean)
      .join('')
  },
  //support for discriminatedUnion
  boolean: () => 'z.boolean()',
  undefined: () => 'z.undefined()',
  nullable: () => '.nullable()',
  null: () => 'z.null()',
  nullish: () => '.nullish()',
  array: (items: string[] = [], min?: number, max?: number, unique?: boolean) => {
    return [
      `z.array(${items?.join('')})`,
      min !== undefined ? `.min(${min})` : undefined,
      max !== undefined ? `.max(${max})` : undefined,
      unique ? `.refine(items => new Set(items).size === items.length, { message: "Array entries must be unique" })` : undefined,
    ]
      .filter(Boolean)
      .join('')
  },
  tuple: (items: string[] = []) => `z.tuple([${items?.join(', ')}])`,
  enum: (items: string[] = []) => `z.enum([${items?.join(', ')}])`,
  union: (items: string[] = []) => `z.union([${items?.join(', ')}])`,
  const: (value?: string | number | boolean) => `z.literal(${value ?? ''})`,
  /**
   * ISO 8601
   */
  datetime: (offset = false, local = false, version: '3' | '4' = '3') => {
    if (offset) {
      return version === '4' ? `z.iso.datetime({ offset: ${offset} })` : `z.string().datetime({ offset: ${offset} })`
    }

    if (local) {
      return version === '4' ? `z.iso.datetime({ local: ${local} })` : `z.string().datetime({ local: ${local} })`
    }

    return 'z.string().datetime()'
  },
  /**
   * Type `'date'` Date
   * Type `'string'` ISO date format (YYYY-MM-DD)
   * @default ISO date format (YYYY-MM-DD)
   */
  date: (type: 'date' | 'string' = 'string', coercion?: boolean, version: '3' | '4' = '3') => {
    if (type === 'string') {
      return version === '4' ? 'z.iso.date()' : 'z.string().date()'
    }

    if (coercion) {
      return 'z.coerce.date()'
    }

    return 'z.date()'
  },
  /**
   * Type `'date'` Date
   * Type `'string'` ISO time format (HH:mm:ss[.SSSSSS])
   * @default ISO time format (HH:mm:ss[.SSSSSS])
   */
  time: (type: 'date' | 'string' = 'string', coercion?: boolean, version: '3' | '4' = '3') => {
    if (type === 'string') {
      return version === '4' ? 'z.iso.time()' : 'z.string().time()'
    }

    if (coercion) {
      return 'z.coerce.date()'
    }

    return 'z.date()'
  },
  uuid: (coercion?: boolean, version: '3' | '4' = '3') =>
    version === '4' ? (coercion ? 'z.coerce.string().uuid()' : 'z.uuid()') : coercion ? 'z.coerce.string().uuid()' : 'z.string().uuid()',
  url: (coercion?: boolean, version: '3' | '4' = '3') =>
    version === '4' ? (coercion ? 'z.coerce.string().url()' : 'z.url()') : coercion ? 'z.coerce.string().url()' : 'z.string().url()',
  default: (value?: string | number | true | object) => {
    if (typeof value === 'object') {
      return '.default({})'
    }
    return `.default(${value ?? ''})`
  },
  and: (items: string[] = []) => items?.map((item) => `.and(${item})`).join(''),
  describe: (value = '') => `.describe(${value})`,
  min: (value?: number) => `.min(${value ?? ''})`,
  max: (value?: number) => `.max(${value ?? ''})`,
  optional: () => '.optional()',
  matches: (value = '', coercion?: boolean) => (coercion ? `z.coerce.string().regex(${value})` : `z.string().regex(${value})`),
  email: (coercion?: boolean, version: '3' | '4' = '3') =>
    version === '4' ? (coercion ? 'z.coerce.string().email()' : 'z.email()') : coercion ? 'z.coerce.string().email()' : 'z.string().email()',
  firstName: undefined,
  lastName: undefined,
  password: undefined,
  phone: undefined,
  readOnly: undefined,
  writeOnly: undefined,
  ref: (value?: string, version: '3' | '4' = '3') => {
    if (!value) {
      return undefined
    }

    return version === '4' ? value : `z.lazy(() => ${value})`
  },
  blob: () => 'z.instanceof(File)',
  deprecated: undefined,
  example: undefined,
  schema: undefined,
  catchall: (value?: string) => (value ? `.catchall(${value})` : undefined),
  name: undefined,
} satisfies SchemaMapper<string | null | undefined>

/**
 * @link based on https://github.com/cellular/oazapfts/blob/7ba226ebb15374e8483cc53e7532f1663179a22c/src/codegen/generate.ts#L398
 */

export function sort(items?: Schema[]): Schema[] {
  const order: string[] = [
    schemaKeywords.string,
    schemaKeywords.datetime,
    schemaKeywords.date,
    schemaKeywords.time,
    schemaKeywords.tuple,
    schemaKeywords.number,
    schemaKeywords.object,
    schemaKeywords.enum,
    schemaKeywords.url,
    schemaKeywords.email,
    schemaKeywords.firstName,
    schemaKeywords.lastName,
    schemaKeywords.password,
    schemaKeywords.matches,
    schemaKeywords.uuid,
    schemaKeywords.null,
    schemaKeywords.min,
    schemaKeywords.max,
    schemaKeywords.default,
    schemaKeywords.describe,
    schemaKeywords.optional,
    schemaKeywords.nullable,
    schemaKeywords.nullish,
  ]

  if (!items) {
    return []
  }

  return transformers.orderBy(items, [(v) => order.indexOf(v.keyword)], ['asc'])
}

const shouldCoerce = (coercion: ParserOptions['coercion'] | undefined, type: 'dates' | 'strings' | 'numbers'): boolean => {
  if (coercion === undefined) {
    return false
  }
  if (typeof coercion === 'boolean') {
    return coercion
  }

  return !!coercion[type]
}

type ParserOptions = {
  name: string
  typeName?: string
  description?: string
  keysToOmit?: string[]
  mapper?: Record<string, string>
  coercion?: boolean | { dates?: boolean; strings?: boolean; numbers?: boolean }
  wrapOutput?: (opts: { output: string; schema: any }) => string | undefined
  rawSchema: SchemaObject
  version: '3' | '4'
}

export function parse({ parent, current, name, siblings }: SchemaTree, options: ParserOptions): string | undefined {
  const value = zodKeywordMapper[current.keyword as keyof typeof zodKeywordMapper]

  if (!value) {
    return undefined
  }

  if (isKeyword(current, schemaKeywords.union)) {
    // zod union type needs at least 2 items
    if (Array.isArray(current.args) && current.args.length === 1) {
      return parse({ parent, name: name, current: current.args[0] as Schema, siblings }, options)
    }
    if (Array.isArray(current.args) && !current.args.length) {
      return ''
    }

    return zodKeywordMapper.union(
      sort(current.args)
        .map((schema, _index, siblings) => parse({ parent: current, name: name, current: schema, siblings }, options))
        .filter(Boolean),
    )
  }

  if (isKeyword(current, schemaKeywords.and)) {
    const items = sort(current.args)
      .filter((schema: Schema) => {
        return ![schemaKeywords.optional, schemaKeywords.describe].includes(schema.keyword as typeof schemaKeywords.describe)
      })
      .map((schema: Schema, _index, siblings) => parse({ parent: current, name: name, current: schema, siblings }, options))
      .filter(Boolean)

    return `${items.slice(0, 1)}${zodKeywordMapper.and(items.slice(1))}`
  }

  if (isKeyword(current, schemaKeywords.array)) {
    return zodKeywordMapper.array(
      sort(current.args.items)
        .map((schemas, _index, siblings) => parse({ parent: current, name: name, current: schemas, siblings }, options))
        .filter(Boolean),
      current.args.min,
      current.args.max,
      current.args.unique,
    )
  }

  if (isKeyword(current, schemaKeywords.enum)) {
    if (current.args.asConst) {
      if (current.args.items.length === 1) {
        const child = {
          keyword: schemaKeywords.const,
          args: current.args.items[0],
        }
        return parse({ parent: current, name: name, current: child, siblings: [child] }, options)
      }

      return zodKeywordMapper.union(
        current.args.items
          .map((schema) => ({
            keyword: schemaKeywords.const,
            args: schema,
          }))
          .map((schema, _index, siblings) => {
            return parse({ parent: current, name: name, current: schema, siblings }, options)
          })
          .filter(Boolean),
      )
    }

    return zodKeywordMapper.enum(
      current.args.items.map((schema) => {
        if (schema.format === 'boolean') {
          return transformers.stringify(schema.value)
        }

        if (schema.format === 'number') {
          return transformers.stringify(schema.value)
        }
        return transformers.stringify(schema.value)
      }),
    )
  }

  if (isKeyword(current, schemaKeywords.ref)) {
    return zodKeywordMapper.ref(current.args?.name, options.version)
  }

  if (isKeyword(current, schemaKeywords.object)) {
    const propertyEntries = Object.entries(current.args?.properties || {}).filter((item) => {
      const schema = item[1]
      return schema && typeof schema.map === 'function'
    })

    const properties = propertyEntries
      .map(([name, schemas]) => {
        const nameSchema = schemas.find((schema) => schema.keyword === schemaKeywords.name) as SchemaKeywordMapper['name']
        const mappedName = nameSchema?.args || name

        // custom mapper(pluginOptions)
        if (options.mapper?.[mappedName]) {
          return `"${name}": ${options.mapper?.[mappedName]}`
        }

        const baseSchemaOutput = sort(schemas)
          .map((schema) => parse({ parent: current, name, current: schema, siblings: schemas }, options))
          .filter(Boolean)
          .join('')

        const objectValue = options.wrapOutput
          ? options.wrapOutput({ output: baseSchemaOutput, schema: options.rawSchema?.properties?.[name] }) || baseSchemaOutput
          : baseSchemaOutput

        if (options.version === '4' && SchemaGenerator.find(schemas, schemaKeywords.ref)) {
          return `get ${name}(){
                return ${objectValue}
              }`
        }

        return `"${name}": ${objectValue}`
      })
      .join(',\n')

    const additionalProperties = current.args?.additionalProperties?.length
      ? current.args.additionalProperties
          .map((schema, _index, siblings) => parse({ parent: current, name: name, current: schema, siblings }, options))
          .filter(Boolean)
          .join('')
      : undefined

    const text = [
      zodKeywordMapper.object(properties, current.args?.strict, options.version),
      additionalProperties ? zodKeywordMapper.catchall(additionalProperties) : undefined,
    ].filter(Boolean)

    return text.join('')
  }

  if (isKeyword(current, schemaKeywords.tuple)) {
    return zodKeywordMapper.tuple(
      current.args.items.map((schema, _index, siblings) => parse({ parent: current, name: name, current: schema, siblings }, options)).filter(Boolean),
    )
  }

  if (isKeyword(current, schemaKeywords.const)) {
    if (current.args.format === 'number' && current.args.value !== undefined) {
      return zodKeywordMapper.const(Number(current.args.value))
    }

    if (current.args.format === 'boolean' && current.args.value !== undefined) {
      return zodKeywordMapper.const(current.args.value)
    }
    return zodKeywordMapper.const(transformers.stringify(current.args.value))
  }

  if (isKeyword(current, schemaKeywords.matches)) {
    if (current.args) {
      return zodKeywordMapper.matches(transformers.toRegExpString(current.args, null), shouldCoerce(options.coercion, 'strings'))
    }
  }

  if (isKeyword(current, schemaKeywords.default)) {
    if (current.args) {
      return zodKeywordMapper.default(current.args)
    }
  }

  if (isKeyword(current, schemaKeywords.describe)) {
    if (current.args) {
      return zodKeywordMapper.describe(transformers.stringify(current.args.toString()))
    }
  }

  if (isKeyword(current, schemaKeywords.string)) {
    return zodKeywordMapper.string(shouldCoerce(options.coercion, 'strings'))
  }

  if (isKeyword(current, schemaKeywords.uuid)) {
    return zodKeywordMapper.uuid(shouldCoerce(options.coercion, 'strings'), options.version)
  }

  if (isKeyword(current, schemaKeywords.email)) {
    return zodKeywordMapper.email(shouldCoerce(options.coercion, 'strings'), options.version)
  }

  if (isKeyword(current, schemaKeywords.url)) {
    return zodKeywordMapper.url(shouldCoerce(options.coercion, 'strings'), options.version)
  }

  if (isKeyword(current, schemaKeywords.number)) {
    return zodKeywordMapper.number(shouldCoerce(options.coercion, 'numbers'))
  }

  if (isKeyword(current, schemaKeywords.integer)) {
    return zodKeywordMapper.integer(shouldCoerce(options.coercion, 'numbers'), undefined, undefined, options.version)
  }

  if (isKeyword(current, schemaKeywords.min)) {
    return zodKeywordMapper.min(current.args)
  }
  if (isKeyword(current, schemaKeywords.max)) {
    return zodKeywordMapper.max(current.args)
  }

  if (isKeyword(current, schemaKeywords.datetime)) {
    return zodKeywordMapper.datetime(current.args.offset, current.args.local, options.version)
  }

  if (isKeyword(current, schemaKeywords.date)) {
    return zodKeywordMapper.date(current.args.type, shouldCoerce(options.coercion, 'dates'), options.version)
  }

  if (isKeyword(current, schemaKeywords.time)) {
    return zodKeywordMapper.time(current.args.type, shouldCoerce(options.coercion, 'dates'), options.version)
  }

  if (current.keyword in zodKeywordMapper && 'args' in current) {
    const value = zodKeywordMapper[current.keyword as keyof typeof zodKeywordMapper] as (typeof zodKeywordMapper)['const']

    return value((current as SchemaKeywordBase<unknown>).args as any)
  }

  if (isKeyword(current, schemaKeywords.optional)) {
    if (siblings.some((schema) => isKeyword(schema, schemaKeywords.default))) return ''

    return value()
  }

  if (current.keyword in zodKeywordMapper) {
    return value()
  }

  return undefined
}
