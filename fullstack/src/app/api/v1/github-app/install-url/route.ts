import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'
import { GITHUB_APP_SLUG } from '@/lib/constants'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const appSlug = GITHUB_APP_SLUG
  const base = process.env.APP_BASE_URL!
  const redirectUrl = encodeURIComponent(`${base}/dashboard`)
  const url = `https://github.com/apps/${appSlug}/installations/new?redirect_url=${redirectUrl}`
  return ok({ url })
}
