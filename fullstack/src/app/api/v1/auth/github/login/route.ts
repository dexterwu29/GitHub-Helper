import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID!
  const base = process.env.APP_BASE_URL!
  const redirectUri = `${base}/api/v1/auth/github/callback`
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email`
  return NextResponse.redirect(url)
}
