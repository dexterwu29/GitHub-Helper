import { getAuthUser, unauthorized, badRequest, ok, created, conflict } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { encrypt, fingerprint } from '@/lib/server/crypto'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const keys = await prisma.userApiKey.findMany({
    where: { userId: user.id },
    orderBy: { id: 'desc' },
  })

  return ok(
    keys.map((k) => ({
      id: k.id.toString(),
      label: `${k.provider}:${k.keyFingerprint.slice(0, 8)}`,
      fingerprint: k.keyFingerprint,
    }))
  )
}

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const { apiKey } = body
  if (!apiKey) return badRequest('apiKey is required')

  const fp = fingerprint(apiKey)

  const existing = await prisma.userApiKey.findFirst({
    where: { userId: user.id, keyFingerprint: fp },
  })
  if (existing) return conflict('This API key already exists')

  const encrypted = encrypt(apiKey)
  const key = await prisma.userApiKey.create({
    data: {
      userId: user.id,
      provider: 'openrouter',
      encryptedKey: encrypted,
      keyFingerprint: fp,
    },
  })

  return created({
    id: key.id.toString(),
    label: `${key.provider}:${key.keyFingerprint.slice(0, 8)}`,
    fingerprint: key.keyFingerprint,
  })
}
