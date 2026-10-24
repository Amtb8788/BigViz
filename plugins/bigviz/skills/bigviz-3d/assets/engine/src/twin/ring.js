// Fixed-size ring buffer (telemetry history for sparklines, alarm history).

export class Ring {
  constructor(size = 120) {
    this.size = size
    this.buf = new Array(size)
    this.n = 0
    this.head = 0
  }

  push(v) {
    this.buf[this.head] = v
    this.head = (this.head + 1) % this.size
    if (this.n < this.size) this.n++
    return v
  }

  /** oldest -> newest */
  toArray() {
    const out = new Array(this.n)
    const start = (this.head - this.n + this.size) % this.size
    for (let i = 0; i < this.n; i++) out[i] = this.buf[(start + i) % this.size]
    return out
  }

  last(k = 0) {
    if (k >= this.n) return undefined
    return this.buf[(this.head - 1 - k + this.size * 2) % this.size]
  }

  get length() {
    return this.n
  }

  clear() {
    this.n = 0
    this.head = 0
  }
}
