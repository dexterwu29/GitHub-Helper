const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function translateMarkdown(
  content: string,
  targetLang: string,
  apiKey: string,
  model?: string
): Promise<string> {
  const actualModel = model || process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.0-flash-001'

  const systemPrompt = `You are a professional technical document translator. Translate the following Markdown document to ${targetLang}. Rules:
1. Preserve ALL Markdown formatting (headers, links, code blocks, tables, lists)
2. Do NOT translate content inside code blocks (\`\`\` or \`)
3. Do NOT translate URLs, file paths, variable names, or technical identifiers
4. Keep the same document structure and line breaks
5. Output ONLY the translated Markdown, no explanations`

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: actualModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.1,
      max_tokens: 16000,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  const raw: string = data.choices?.[0]?.message?.content || ''

  const fenceMatch = raw.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/m)
  return fenceMatch ? fenceMatch[1] : raw
}
