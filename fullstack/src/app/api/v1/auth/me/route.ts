import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  return ok({
    id: user.id.toString(),
    githubId: user.githubUserId,
    login: user.githubLogin,
    avatarUrl: user.githubAvatarUrl,
  })
}
