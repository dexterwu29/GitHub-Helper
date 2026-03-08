import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const appSlug = 'GitHub-translator-helper-app'
  const url = `https://github.com/apps/${appSlug}/installations/new`
  return ok({ url })
}
