import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'gh_helper_token'

export interface JwtPayload {
  sub: string
  githubId: number
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
  } catch {
    return null
  }
}

export function setAuthCookie(token: string) {
  const isProduction = process.env.APP_ENV === 'fat'
  const res = NextResponse.json({ code: 0, message: 'ok' })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })
  return res
}

export async function getAuthUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = verifyJwt(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: BigInt(payload.sub) },
  })
  return user
}

export function unauthorized() {
  return NextResponse.json(
    { code: 1, message: 'Unauthorized', errorCode: 'UNAUTHORIZED' },
    { status: 401 }
  )
}

export function forbidden() {
  return NextResponse.json(
    { code: 1, message: 'Forbidden', errorCode: 'FORBIDDEN' },
    { status: 403 }
  )
}

export function notFound(msg = 'Not found') {
  return NextResponse.json(
    { code: 1, message: msg, errorCode: 'NOT_FOUND' },
    { status: 404 }
  )
}

export function badRequest(msg: string) {
  return NextResponse.json(
    { code: 1, message: msg, errorCode: 'VALIDATION_ERROR' },
    { status: 400 }
  )
}

export function conflict(msg: string) {
  return NextResponse.json(
    { code: 1, message: msg, errorCode: 'CONFLICT' },
    { status: 409 }
  )
}

export function ok(data: unknown = null) {
  return NextResponse.json({ code: 0, message: 'ok', data }, { status: 200 })
}

export function created(data: unknown = null) {
  return NextResponse.json({ code: 0, message: 'ok', data }, { status: 201 })
}
