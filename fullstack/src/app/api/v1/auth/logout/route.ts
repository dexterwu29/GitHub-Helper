import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ code: 0, message: 'ok' })
  res.cookies.set('gh_helper_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
  return res
}
