import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'
import { listAppInstallations } from '@/lib/server/github'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

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
}
