import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 16
const TAG_LEN = 16

function getKey(): Buffer {
  return Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}

export function fingerprint(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex').slice(0, 16)
}
