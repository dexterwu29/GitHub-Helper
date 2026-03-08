import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const appSlug = 'dexter-translator-helper-app'
  const base = process.env.APP_BASE_URL!
  const redirectUrl = encodeURIComponent(`${base}/dashboard`)
  const url = `https://github.com/apps/${appSlug}/installations/new?redirect_url=${redirectUrl}`
  return ok({ url })
}
