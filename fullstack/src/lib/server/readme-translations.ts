import { GITHUB_APP_DISPLAY_NAME, GITHUB_APP_URL } from '@/lib/constants'

const LANG_LABELS: Record<string, string> = {
  en: 'en', ja: 'ja', ko: 'ko', 'zh-CN': 'zh', es: 'es', fr: 'fr', de: 'de', pt: 'pt', ru: 'ru', ar: 'ar',
}

const SECTION_HEADER = `## Translations · by [${GITHUB_APP_DISPLAY_NAME}](${GITHUB_APP_URL})`

export type DocLinks = Record<string, string> // lang -> outputPath

/** 校验 path 是否为有效的翻译输出路径 */
function isValidOutputPath(path: string): boolean {
  return typeof path === 'string' && path.length > 0 && (path.includes('_i18n/') || path.startsWith('_i18n/'))
}

/** 将路径编码为可安全用于 Markdown 链接的形式（空格、括号等） */
function encodePathForLink(path: string): string {
  return path.split('/').map((seg) => encodeURIComponent(seg)).join('/')
}

/** 从现有 README 的 Translations 区块解析出 doc -> { lang: path }，仅解析树形格式 */
export function parseReadmeTranslationsSection(readme: string): Map<string, DocLinks> {
  const result = new Map<string, DocLinks>()
  const sectionRe = /^## Translations[^\n]*\n([\s\S]*?)(?=\n## |\Z)/m
  const match = readme.match(sectionRe)
  if (!match) return result

  const body = match[1]
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  const dirBlockRe = /^### ([^\n]*?)\/?\s*\n((?:(?:- \*\*[^*]+\*\*[^\n]*\n\s*[^\n]+\n?)+))/gm
  let blockMatch
  while ((blockMatch = dirBlockRe.exec(body)) !== null) {
    let dir = blockMatch[1].trim()
    if (dir === '(根目录)' || dir === '') dir = ''
    const block = blockMatch[2]
    const fileRe = /^- \*\*(.+?)\*\*[^\n]*\n\s*([^\n]+)/g
    let fileMatch
    while ((fileMatch = fileRe.exec(block)) !== null) {
      const filename = fileMatch[1].trim()
      const sourcePath = dir ? `${dir}/${filename}` : filename
      const linkLine = fileMatch[2]
      const links: DocLinks = {}
      linkRe.lastIndex = 0
      let m
      while ((m = linkRe.exec(linkLine)) !== null) {
        const label = m[1].trim()
        const path = m[2].trim()
        if (isValidOutputPath(path)) links[label] = path
      }
      if (Object.keys(links).length > 0) result.set(sourcePath, links)
    }
  }

  return result
}

/** 合并已有翻译与本次任务完成的项，仅保留有效路径 */
export function mergeTranslations(
  existing: Map<string, DocLinks>,
  completedItems: { sourcePath: string; targetLanguage: string; outputPath: string }[]
): Map<string, DocLinks> {
  const merged = new Map<string, DocLinks>()
  for (const [doc, links] of existing) {
    const filtered: DocLinks = {}
    for (const [lang, path] of Object.entries(links)) {
      if (isValidOutputPath(path)) filtered[lang] = path
    }
    if (Object.keys(filtered).length > 0) merged.set(doc, filtered)
  }
  for (const i of completedItems) {
    if (!isValidOutputPath(i.outputPath)) continue
    const cur = merged.get(i.sourcePath) ?? {}
    merged.set(i.sourcePath, { ...cur, [i.targetLanguage]: i.outputPath })
  }
  return merged
}

/** 按目录分组的树形结构生成 Translations 区块，仅输出有效链接，标题与 App 绑定 */
function buildReadmeTranslationsSectionTree(byDoc: Map<string, DocLinks>): string {
  if (byDoc.size === 0) return ''

  const lines: string[] = [SECTION_HEADER, '']

  const byDir = new Map<string, Map<string, DocLinks>>()
  for (const [sourcePath, links] of byDoc.entries()) {
    const filtered: DocLinks = {}
    for (const [lang, path] of Object.entries(links)) {
      if (isValidOutputPath(path)) filtered[lang] = path
    }
    if (Object.keys(filtered).length === 0) continue

    const lastSlash = sourcePath.lastIndexOf('/')
    const dir = lastSlash >= 0 ? sourcePath.slice(0, lastSlash) : ''
    const filename = lastSlash >= 0 ? sourcePath.slice(lastSlash + 1) : sourcePath
    if (!byDir.has(dir)) byDir.set(dir, new Map())
    byDir.get(dir)!.set(filename, filtered)
  }

  const sortedDirs = [...byDir.keys()].sort((a, b) => {
    if (!a) return -1
    if (!b) return 1
    return a.localeCompare(b)
  })
  for (const dir of sortedDirs) {
    const files = byDir.get(dir)!
    const heading = dir ? `### ${dir}/` : '### (根目录)'
    lines.push(heading, '')

    const sortedFiles = [...files.entries()].sort(([a], [b]) => a.localeCompare(b))
    for (const [filename, links] of sortedFiles) {
      const linkParts: string[] = []
      const sortedLangs = Object.keys(links).sort()
      for (const lang of sortedLangs) {
        const path = links[lang]
        const label = LANG_LABELS[lang] || lang
        if (isValidOutputPath(path)) {
          linkParts.push(`[${label}](${encodePathForLink(path)})`)
        }
      }
      if (linkParts.length === 0) continue
      lines.push(`- **${filename}**`)
      lines.push(`  ${linkParts.join(' · ')}`)
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd()
}

/** 构建 Translations 区块（树形结构，合并已有） */
export function buildReadmeTranslationsSection(
  readmeContent: string,
  completedItems: { sourcePath: string; targetLanguage: string; outputPath: string }[]
): string {
  const existing = parseReadmeTranslationsSection(readmeContent)
  const merged = mergeTranslations(existing, completedItems)
  return buildReadmeTranslationsSectionTree(merged)
}

/**
 * 从 _i18n 目录下的文件路径列表构建 Translations 区块（全量刷新用）
 * 路径格式: {outputDir}/{lang}/{sourcePath}，如 _i18n/de/init/doc.md
 */
export function buildReadmeTranslationsSectionFromI18nPaths(
  i18nPaths: string[],
  outputDir: string
): string {
  const prefix = outputDir.endsWith('/') ? outputDir : `${outputDir}/`
  const byDoc = new Map<string, DocLinks>()
  for (const p of i18nPaths) {
    if (!p.startsWith(prefix) || !p.endsWith('.md')) continue
    const rest = p.slice(prefix.length)
    const firstSlash = rest.indexOf('/')
    if (firstSlash < 0) continue
    const lang = rest.slice(0, firstSlash)
    const sourcePath = rest.slice(firstSlash + 1)
    const cur = byDoc.get(sourcePath) ?? {}
    if (isValidOutputPath(p)) byDoc.set(sourcePath, { ...cur, [lang]: p })
  }
  return buildReadmeTranslationsSectionTree(byDoc)
}

/** 移除所有 Translations 区块（含旧表格等）并插入新的树形区块 */
export function upsertReadmeTranslationsSection(readme: string, newSection: string): string {
  if (!newSection.trim()) return readme

  const sectionRe = /^## Translations[^\n]*\n[\s\S]*?(?=\n## |\Z)/gm
  const matches = [...readme.matchAll(sectionRe)]

  if (matches.length === 0) {
    return readme.trimEnd() + '\n\n---\n\n' + newSection + '\n'
  }

  const firstStart = matches[0].index!
  const lastEnd = matches[matches.length - 1].index! + matches[matches.length - 1][0].length
  return readme.slice(0, firstStart) + newSection + '\n' + readme.slice(lastEnd)
}
