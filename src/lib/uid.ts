// ============================================================
// ULID — time-sortable unique event ids.
//
// A UUID would be unique but arbitrary; the event log wants ids that sort in
// creation order, because that is the fold's final tiebreak when two events
// share a timestamp. ULIDs give both: 48 bits of millisecond timestamp then
// 80 bits of randomness, Crockford base32, lexicographically ordered.
//
// Uniqueness also does the sync layer's deduplication for it — the same event
// pushed twice collides on primary key and is ignored, which is what makes
// at-least-once delivery safe.
// ============================================================

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32: no I, L, O, U
const TIME_LEN = 10
const RANDOM_LEN = 16

function encodeTime(ms: number): string {
  let out = ''
  let n = ms
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    out = ENCODING[n % 32] + out
    n = Math.floor(n / 32)
  }
  return out
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RANDOM_LEN)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ENCODING[b % 32]
  return out
}

/** A new ULID. Pass `ms` only in tests, where determinism is wanted. */
export function ulid(ms: number = Date.now()): string {
  return encodeTime(ms) + encodeRandom()
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function isUlid(s: string): boolean {
  return ULID_RE.test(s)
}
