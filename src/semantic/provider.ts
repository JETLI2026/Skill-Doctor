export interface CompletionRequest { system: string; user: string; json?: boolean }
export interface Completion { text: string; usage?: { promptTokens: number; completionTokens: number }; durationMs: number }
export interface LlmProvider { readonly identity: string; complete(request: CompletionRequest): Promise<Completion> }
export interface HttpProviderOptions { endpoint: string; model: string; apiKey?: string; timeoutMs?: number; retries?: number; fetch?: typeof fetch }

async function readLimited(response: Response, max = 2_000_000): Promise<string> {
  if (!response.body) throw new Error('LLM 返回空响应。');
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error('LLM 响应超过大小限制。');
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => undefined); }
}
/** Chat Completions protocol adapter; no SDK, tool execution or implicit network calls. */
export class HttpLlmProvider implements LlmProvider {
  readonly identity: string;
  private readonly options: HttpProviderOptions;
  constructor(options: HttpProviderOptions) {
    const url = new URL(options.endpoint);
    if (url.username || url.password || url.search || url.hash) throw new Error('LLM endpoint 不能含凭据、查询参数或片段。');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('远程 LLM endpoint 必须使用 HTTPS；本地服务可使用 HTTP。');
    if (!options.model.trim()) throw new Error('缺少 LLM model。');
    this.options = options;
    this.identity = `${url.host}/${options.model}`;
  }
  async complete(request: CompletionRequest): Promise<Completion> {
    const start = performance.now(), retries = this.options.retries ?? 1;
    for (let attempt = 0; attempt <= retries; attempt++) {
      let response: Response;
      try {
        response = await (this.options.fetch ?? fetch)(this.options.endpoint, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(this.options.timeoutMs ?? 30000),
          headers: { 'Content-Type': 'application/json', ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}) },
          body: JSON.stringify({ model: this.options.model, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }], ...(request.json ? { response_format: { type: 'json_object' } } : {}) }),
        });
      } catch { throw new Error('LLM 连接失败或超时；检查 endpoint、网络及 timeout。'); }
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`LLM HTTP ${response.status}；响应内容已隐藏，避免泄露凭据。`); }
      let data: { choices?: { message?: { content?: unknown }; finish_reason?: string }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
      try { data = JSON.parse(await readLimited(response)); }
      catch { throw new Error('LLM 响应不是有效 JSON 或超过大小限制。'); }
      if (!data || typeof data !== 'object' || !Array.isArray(data.choices)) throw new Error('LLM 响应缺少有效 choices 数组。');
      const choice = data.choices[0];
      if (choice?.finish_reason === 'length') throw new Error('LLM 输出被截断，不能作为完整审查结果。');
      if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('LLM 未返回文本内容。');
      const usage = data.usage;
      return { text: choice.message.content, durationMs: Math.round(performance.now() - start), ...(typeof usage?.prompt_tokens === 'number' && typeof usage.completion_tokens === 'number' ? { usage: { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens } } : {}) };
    }
    throw new Error('LLM 重试次数耗尽。');
  }
}
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): HttpLlmProvider {
  if (!env.SKILL_DOCTOR_ENDPOINT || !env.SKILL_DOCTOR_MODEL) throw new Error('请设置 SKILL_DOCTOR_ENDPOINT（完整 /chat/completions URL）与 SKILL_DOCTOR_MODEL。');
  return new HttpLlmProvider({ endpoint: env.SKILL_DOCTOR_ENDPOINT, model: env.SKILL_DOCTOR_MODEL, apiKey: env.SKILL_DOCTOR_API_KEY });
}
