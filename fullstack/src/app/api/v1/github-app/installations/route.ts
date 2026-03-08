import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'
import { listAppInstallations } from '@/lib/server/github'
import { NextResponse } from 'next/server'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  try {
    const allInstallations = await listAppInstallations()
    const userGithubId = Number(user.githubUserId)
    const installations = allInstallations.filter(
      (i) => i.account && 'id' in i.account && i.account.id === userGithubId
    )

    const list = installations.map((i) => ({
      installationId: i.id,
      account: i.account && 'login' in i.account ? i.account.login : null,
      targetType: i.target_type,
      repositorySelection: i.repository_selection,
    }))
    return ok(list)
  } catch (err) {
    console.error('[installations] Failed to list app installations:', err)
    return NextResponse.json(
      { code: 500, message: 'Failed to verify GitHub App installation. Check GITHUB_APP_PRIVATE_KEY configuration.' },
      { status: 500 }
    )
  }
}
