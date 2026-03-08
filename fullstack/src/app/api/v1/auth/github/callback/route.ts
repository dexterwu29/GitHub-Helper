import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getGitHubUser } from '@/lib/server/github'
import { prisma } from '@/lib/server/prisma'
import { signJwt } from '@/lib/server/auth'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/?error=missing_code`)
  }

  try {
    const accessToken = await exchangeCodeForToken(code)
    const ghUser = await getGitHubUser(accessToken)

    const user = await prisma.user.upsert({
      where: { githubUserId: ghUser.id },
      update: {
        githubLogin: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
      },
      create: {
        githubUserId: ghUser.id,
        githubLogin: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
      },
    })

    const token = signJwt({ sub: user.id.toString(), githubId: Number(user.githubUserId) })
    const isProduction = process.env.APP_ENV === 'fat'

    const redirectUrl = `${process.env.APP_BASE_URL}/dashboard`
    const res = NextResponse.redirect(redirectUrl)
    res.cookies.set('gh_helper_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return res
  } catch (err) {
    console.error('GitHub OAuth error:', err)
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/?error=auth_failed`)
  }
}
