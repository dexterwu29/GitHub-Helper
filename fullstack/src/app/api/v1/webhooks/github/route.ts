import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/server/prisma'

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.GITHUB_WEBHOOK_SECRET!
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const event = req.headers.get('x-github-event')
  const deliveryId = req.headers.get('x-github-delivery') || crypto.randomUUID()

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  await prisma.webhookDelivery.create({
    data: {
      deliveryId,
      eventType: event || 'unknown',
      payload: JSON.parse(body),
      processedStatus: 'received',
    },
  })

  if (event === 'push') {
    const payload = JSON.parse(body)
    const fullName = payload.repository?.full_name
    if (!fullName) return NextResponse.json({ ok: true })

    const repo = await prisma.repository.findFirst({
      where: { fullName },
    })
    if (!repo) return NextResponse.json({ ok: true })

    const config = await prisma.translationConfig.findUnique({
      where: { repoId: repo.id },
    })
    if (!config) return NextResponse.json({ ok: true })

    const commits = payload.commits || []
    const outPrefix = `${config.outputDir}/`
    const changedMds = new Set<string>()
    for (const commit of commits) {
      for (const f of [...(commit.added || []), ...(commit.modified || [])]) {
        if (typeof f === 'string' && f.endsWith('.md') && !f.startsWith(outPrefix)) {
          changedMds.add(f)
        }
      }
    }

    if (changedMds.size === 0) return NextResponse.json({ ok: true })

    const trackedDocs = await prisma.trackedDocument.findMany({
      where: { repoId: repo.id },
    })
    const trackedPaths = new Set(trackedDocs.map((d) => d.sourcePath))
    const toTranslate = [...changedMds].filter((p) => trackedPaths.has(p))

    if (toTranslate.length === 0) return NextResponse.json({ ok: true })

    const dedupeKey = `push-${deliveryId}`
    const targetLangs = config.targetLanguages as string[]

    const job = await prisma.translationJob.create({
      data: {
        repoId: repo.id,
        triggerType: 'webhook_push',
        status: 'pending',
        dedupeKey,
        sourceCommitSha: payload.after || null,
      },
    })

    type ItemData = {
      jobId: bigint; repoId: bigint; sourcePath: string;
      targetLanguage: string; outputPath: string; status: string
    }
    const items: ItemData[] = []
    for (const path of toTranslate) {
      for (const lang of targetLangs) {
        items.push({
          jobId: job.id,
          repoId: repo.id,
          sourcePath: path,
          targetLanguage: lang,
          outputPath: `${config.outputDir}/${lang}/${path}`,
          status: 'pending',
        })
      }
    }
    await prisma.translationJobItem.createMany({ data: items })

    await prisma.webhookDelivery.update({
      where: { deliveryId },
      data: { repoId: repo.id, processedStatus: 'processed', processedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true })
}
