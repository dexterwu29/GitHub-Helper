import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly defaultModel: string;

  constructor(private config: ConfigService) {
    this.defaultModel = config.get<string>('OPENROUTER_DEFAULT_MODEL', 'google/gemini-2.0-flash-001');
  }

  async translate(
    markdown: string,
    sourceLang: string,
    targetLang: string,
    apiKey: string,
    sourcePath?: string,
  ): Promise<string> {
    const prompt = this.buildPrompt(markdown, sourceLang, targetLang, sourcePath);

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github-helper.app',
        'X-Title': 'GitHub Helper',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: this.systemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 16384,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`OpenRouter API error: ${res.status} ${err}`);
      throw new Error(`OpenRouter API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenRouter');

    return this.extractMarkdown(content);
  }

  private systemPrompt(): string {
    return `You are a professional technical document translator. Your task is to translate Markdown documents while:
1. Preserving ALL Markdown formatting (headers, links, code blocks, tables, images, etc.)
2. NOT translating code blocks, URLs, file paths, or technical identifiers
3. Maintaining the original document structure exactly
4. Using natural, fluent language appropriate for technical documentation
5. Keeping any existing front matter (YAML between ---) unchanged
6. Outputting ONLY the translated Markdown, no explanations or extra text`;
  }

  private buildPrompt(markdown: string, sourceLang: string, targetLang: string, sourcePath?: string): string {
    const fileInfo = sourcePath ? `\nSource file: ${sourcePath}` : '';
    return `Translate the following Markdown document from ${sourceLang} to ${targetLang}.${fileInfo}

---BEGIN DOCUMENT---
${markdown}
---END DOCUMENT---`;
  }

  private extractMarkdown(content: string): string {
    const fenceMatch = content.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    return content.trim();
  }
}
