/**
 * Tiny boundary validators shared by the screen data modules. Each returns the typed value or
 * throws a ShapeError naming the exact field path, so a malformed response fails loudly instead
 * of rendering NaN.
 */

export class ShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`Invalid screen data at "${path}": expected ${expected}`)
    this.name = 'ShapeError'
  }
}

export type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export const obj = (v: unknown, path: string): Obj => {
  if (!isObj(v)) throw new ShapeError(path, 'object')
  return v
}
export const num = (v: unknown, path: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ShapeError(path, 'finite number')
  return v
}
export const str = (v: unknown, path: string, max = 200): string => {
  if (typeof v !== 'string' || v.length > max) throw new ShapeError(path, `string ≤ ${max} chars`)
  return v
}
export const arr = <T>(v: unknown, path: string, item: (x: unknown, p: string) => T, max = 500): T[] => {
  if (!Array.isArray(v) || v.length > max) throw new ShapeError(path, `array ≤ ${max} items`)
  return v.map((x, i) => item(x, `${path}[${i}]`))
}
/** One of a fixed set of string literals */
export const oneOf = <T extends string>(v: unknown, path: string, allowed: readonly T[]): T => {
  if (!allowed.includes(v as T)) throw new ShapeError(path, allowed.join(' | '))
  return v as T
}
/** Number clamped to a range check (inclusive) */
export const numIn = (v: unknown, path: string, min: number, max: number): number => {
  const n = num(v, path)
  if (n < min || n > max) throw new ShapeError(path, `number in [${min}, ${max}]`)
  return n
}
