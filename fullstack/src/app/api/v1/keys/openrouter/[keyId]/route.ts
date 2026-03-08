import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { keyId } = await params
  const key = await prisma.userApiKey.findUnique({
    where: { id: BigInt(keyId) },
  })
  if (!key || key.userId !== user.id) return notFound('Key not found')

  await prisma.userApiKey.delete({ where: { id: key.id } })
  return ok(null)
}
