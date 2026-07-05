#!/usr/bin/env bun
import { extname, join, normalize, resolve, sep } from 'node:path';

type TunnelMode = 'auto' | 'ngrok' | 'cloudflared' | 'none';

type Options = {
  dir: string;
  port: number;
  tunnel: TunnelMode;
  dryRun: boolean;
  host: string;
};

const REQUIRED_FILES = ['deck.json', 'speaker.html', 'attendee.html', 'speaker-notes.md'];
const EVENT_ID = 'live-deck';
const MAX_CAPTION_LENGTH = 600;
const MAX_TRANSLATION_LENGTH = 600;

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const options = parseArgs(Bun.argv.slice(2));
  const root = resolve(options.dir);
  await validateDeckPackage(root);

  const tunnel = chooseTunnel(options.tunnel);
  if (options.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      root,
      port: options.port,
      tunnel,
      urls: urlsFor(`http://${options.host}:${options.port}`),
    }, null, 2));
    return;
  }

  const server = Bun.serve({
    hostname: options.host,
    port: options.port,
    async fetch(request) {
      const url = new URL(request.url);
      const apiResponse = await handleApi(root, request, url);
      if (apiResponse) return apiResponse;
      const response = await serveStatic(root, url.pathname);
      return response ?? new Response('Not found', { status: 404 });
    },
  });

  const localBase = `http://${server.hostname}:${server.port}`;
  printUrls('LOCAL', localBase);

  let tunnelProcess: ReturnType<typeof Bun.spawn> | undefined;
  if (tunnel === 'ngrok') {
    tunnelProcess = Bun.spawn(['ngrok', 'http', String(server.port)], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const publicUrl = await waitForNgrokUrl();
    printUrls('PUBLIC', publicUrl);
  } else if (tunnel === 'cloudflared') {
    tunnelProcess = Bun.spawn(['cloudflared', 'tunnel', '--url', localBase], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const publicUrl = await waitForCloudflaredUrl(tunnelProcess);
    printUrls('PUBLIC', publicUrl);
  } else {
    console.log('PUBLIC: no tunnel binary found. Install ngrok or cloudflared, or rerun with --tunnel none for local-only.');
  }

  console.log('Press Ctrl+C to stop publishing.');

  const stop = () => {
    tunnelProcess?.kill();
    server.stop(true);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await new Promise(() => {});
}

function parseArgs(args: string[]): Options {
  let dir = '';
  let port = Number(process.env.PORT ?? 8976);
  let tunnel: TunnelMode = 'auto';
  let dryRun = false;
  let host = process.env.HOST ?? '127.0.0.1';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--port') {
      port = Number(args[++i]);
      continue;
    }
    if (arg === '--host') {
      host = args[++i] ?? host;
      continue;
    }
    if (arg === '--tunnel') {
      const value = args[++i] as TunnelMode | undefined;
      if (!value || !['auto', 'ngrok', 'cloudflared', 'none'].includes(value)) {
        throw new Error('Invalid --tunnel. Use auto, ngrok, cloudflared, or none.');
      }
      tunnel = value;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (dir) throw new Error(`Unexpected argument: ${arg}`);
    dir = arg;
  }

  if (!dir) throw new Error('Usage: gstack-deck-publish <deck-output-dir> [--port 8976] [--tunnel auto|ngrok|cloudflared|none]');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
  return { dir, port, tunnel, dryRun, host };
}

async function validateDeckPackage(root: string): Promise<void> {
  const missing: string[] = [];
  for (const file of REQUIRED_FILES) {
    if (!(await Bun.file(join(root, file)).exists())) missing.push(file);
  }
  if (missing.length) throw new Error(`Deck package is missing required files: ${missing.join(', ')}`);

  const deck = await Bun.file(join(root, 'deck.json')).json();
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  if (!deck.title || !Array.isArray(deck.sections) || slides.length === 0) {
    throw new Error('deck.json must include title, sections, and at least one slide.');
  }

  const requiredSlideFields = ['id', 'type', 'title', 'purpose', 'speakerIntent', 'attendeeTakeaway', 'content', 'notes', 'adaptationHints'];
  const missingFields: string[] = [];
  for (const slide of slides) {
    for (const field of requiredSlideFields) {
      if (!(field in slide)) missingFields.push(`${slide.id ?? '(unknown)'}.${field}`);
    }
  }
  if (missingFields.length) throw new Error(`deck.json slides are missing fields: ${missingFields.join(', ')}`);
}

type Deck = {
  title: string;
  slides: Slide[];
};

type Slide = {
  id: string;
  type: string;
  title: string;
  attendeeTakeaway: string;
  content: {
    headline?: string;
    bullets?: string[];
    columns?: Array<{ label: string; items: string[] }>;
    nextAction?: string;
  };
  notes: string;
  adaptationHints?: {
    deepDiveTags?: string[];
  };
};

type Preferences = {
  language: 'en' | 'ja';
  fontScale: number;
  detail: 'normal' | 'detailed';
  contrast: 'default' | 'high';
  level: 'standard' | 'beginner' | 'expert';
};

type CaptionProvider = 'cactus' | 'browser' | 'manual';

type CaptionState = {
  text: string;
  sourceLanguage: 'en' | 'ja';
  provider: CaptionProvider;
  isFinal: boolean;
  seq: number;
  updatedAt: string;
};

const defaultPreferences: Preferences = {
  language: 'en',
  fontScale: 1,
  detail: 'normal',
  contrast: 'default',
  level: 'standard',
};

const presetPreferences: Record<string, Preferences> = {
  standard: defaultPreferences,
  jaLarge: { language: 'ja', fontScale: 1.35, detail: 'normal', contrast: 'default', level: 'standard' },
  beginner: { language: 'en', fontScale: 1.15, detail: 'normal', contrast: 'default', level: 'beginner' },
  highContrast: { language: 'en', fontScale: 1.25, detail: 'normal', contrast: 'high', level: 'standard' },
  expert: { language: 'en', fontScale: 1, detail: 'detailed', contrast: 'default', level: 'expert' },
};

let liveDeck: Deck | undefined;
let currentSlideId = '';
const listeners = new Set<(data: unknown) => void>();
let captionState: CaptionState = emptyCaptionState();
let cactusProcess: ReturnType<typeof Bun.spawn> | undefined;

async function handleApi(root: string, request: Request, url: URL): Promise<Response | undefined> {
  if (!url.pathname.startsWith('/api/')) return undefined;
  const deck = await getLiveDeck(root);

  if (url.pathname === '/api/session') {
    return json(sessionState());
  }

  if (url.pathname === '/api/caption/providers') {
    return json(captionProviders());
  }

  if (url.pathname === '/api/caption/cactus/start' && request.method === 'POST') {
    return startCactusCaptions();
  }

  if (url.pathname === '/api/caption/cactus/stop' && request.method === 'POST') {
    stopCactusCaptions();
    return json(captionProviders());
  }

  if (url.pathname === '/api/translate' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as {
      text?: string;
      sourceLanguage?: 'en' | 'ja';
      targetLanguage?: 'en' | 'ja';
    };
    const text = sanitizeCaption(body.text ?? '');
    if (!text) return json({ error: 'Translation text is required.' }, 400);
    if ((body.text ?? '').length > MAX_TRANSLATION_LENGTH) {
      return json({ error: `Translation text must be ${MAX_TRANSLATION_LENGTH} characters or fewer.` }, 400);
    }
    const sourceLanguage = body.sourceLanguage === 'ja' ? 'ja' : 'en';
    const targetLanguage = body.targetLanguage === 'ja' ? 'ja' : 'en';
    return json(await translateCaption(text, sourceLanguage, targetLanguage));
  }

  if (url.pathname === '/api/session/caption' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as {
      text?: string;
      sourceLanguage?: 'en' | 'ja';
      provider?: CaptionProvider;
      isFinal?: boolean;
    };
    const text = sanitizeCaption(body.text ?? '');
    if (!text) return json({ error: 'Caption text is required.' }, 400);
    if ((body.text ?? '').length > MAX_CAPTION_LENGTH) {
      return json({ error: `Caption text must be ${MAX_CAPTION_LENGTH} characters or fewer.` }, 400);
    }
    updateCaption({
      text,
      sourceLanguage: body.sourceLanguage === 'ja' ? 'ja' : 'en',
      provider: body.provider === 'cactus' || body.provider === 'manual' ? body.provider : 'browser',
      isFinal: body.isFinal !== false,
    });
    return json(sessionState());
  }

  if (url.pathname === '/api/session/slide' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as { slideId?: string; direction?: 'next' | 'prev' };
    const nextId = body.slideId ?? adjacentSlideId(deck, body.direction ?? 'next');
    if (!deck.slides.some(slide => slide.id === nextId)) {
      return json({ error: 'Invalid slide id' }, 400);
    }
    currentSlideId = nextId;
    const state = sessionState();
    for (const listener of listeners) listener(state);
    return json(state);
  }

  if (url.pathname === '/api/adapt' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as {
      requestText?: string;
      preset?: string;
      currentPreferences?: Partial<Preferences>;
    };
    const base = normalizePreferences(body.currentPreferences ?? preferencesForPreset(body.preset ?? 'standard'));
    return json(body.requestText ? adaptRequest(body.requestText, base) : {
      ...preferencesForPreset(body.preset ?? 'standard'),
      explanation: 'Applied preference preset.',
    });
  }

  if (url.pathname === '/api/render' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as {
      slideId?: string;
      preferences?: Partial<Preferences>;
    };
    return json(renderPersonalizedSlide(deck, body.slideId ?? currentSlideId, normalizePreferences(body.preferences)));
  }

  if (url.pathname === '/api/events') {
    return sse();
  }

  return undefined;
}

async function getLiveDeck(root: string): Promise<Deck> {
  if (!liveDeck) {
    liveDeck = await Bun.file(join(root, 'deck.json')).json();
    currentSlideId = liveDeck.slides[0]?.id ?? '';
  }
  return liveDeck;
}

function sessionState(): Record<string, unknown> {
  return {
    eventId: EVENT_ID,
    currentSlideId,
    caption: captionState,
    updatedAt: new Date().toISOString(),
  };
}

function emptyCaptionState(): CaptionState {
  return {
    text: '',
    sourceLanguage: 'en',
    provider: 'manual',
    isFinal: true,
    seq: 0,
    updatedAt: new Date().toISOString(),
  };
}

function captionProviders(): Record<string, unknown> {
  const cactusAvailable = Boolean(Bun.which('cactus'));
  return {
    preferred: cactusAvailable ? 'cactus' : 'browser',
    cactus: {
      available: cactusAvailable,
      running: Boolean(cactusProcess),
      command: 'cactus transcribe',
    },
    browser: {
      available: true,
      command: 'SpeechRecognition',
    },
    manual: {
      available: true,
    },
  };
}

function updateCaption(next: Omit<CaptionState, 'seq' | 'updatedAt'>): CaptionState {
  captionState = {
    ...next,
    seq: captionState.seq + 1,
    updatedAt: new Date().toISOString(),
  };
  const state = sessionState();
  for (const listener of listeners) listener(state);
  return captionState;
}

function sanitizeCaption(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CAPTION_LENGTH);
}

function startCactusCaptions(): Response {
  if (!Bun.which('cactus')) {
    return json({ error: 'cactus is not installed or not on PATH.', ...captionProviders() }, 404);
  }
  if (cactusProcess) return json(captionProviders());

  cactusProcess = Bun.spawn(['cactus', 'transcribe'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  void readCactusCaptionStream(cactusProcess.stdout);
  void readCactusDiagnostics(cactusProcess.stderr);
  void cactusProcess.exited.finally(() => {
    cactusProcess = undefined;
  });

  return json(captionProviders());
}

function stopCactusCaptions(): void {
  cactusProcess?.kill();
  cactusProcess = undefined;
}

async function readCactusCaptionStream(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) return;
  const decoder = new TextDecoder();
  let pending = '';
  for await (const chunk of stream) {
    pending += decoder.decode(chunk, { stream: true });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const text = extractCactusCaption(line);
      if (text) {
        updateCaption({
          text,
          sourceLanguage: 'en',
          provider: 'cactus',
          isFinal: true,
        });
      }
    }
  }
}

async function readCactusDiagnostics(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) return;
  for await (const _chunk of stream) {
    // Drain stderr so the Cactus subprocess cannot block on a full pipe.
  }
}

function extractCactusCaption(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidates = [
      parsed.text,
      parsed.transcript,
      parsed.caption,
      parsed.response,
      Array.isArray(parsed.segments)
        ? parsed.segments.map(segment => typeof segment === 'object' && segment ? (segment as Record<string, unknown>).text : '').join(' ')
        : '',
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && sanitizeCaption(candidate)) return sanitizeCaption(candidate);
    }
  } catch {
    // Plain text CLI output is the common path.
  }
  return sanitizeCaption(trimmed.replace(/^(transcript|caption|text)\s*[:=-]\s*/i, ''));
}

async function translateCaption(
  text: string,
  sourceLanguage: CaptionState['sourceLanguage'],
  targetLanguage: CaptionState['sourceLanguage'],
): Promise<Record<string, unknown>> {
  if (sourceLanguage === targetLanguage) {
    return { text, sourceLanguage, targetLanguage, provider: 'none', translated: true };
  }

  const external = process.env.GSTACK_TRANSLATE_PROVIDER === 'google'
    ? await translateWithGoogleWeb(text, sourceLanguage, targetLanguage).catch(() => '')
    : '';
  if (external) {
    return { text: external, sourceLanguage, targetLanguage, provider: 'google-web', translated: true };
  }

  const local = translateWithLocalFallback(text, sourceLanguage, targetLanguage);
  return {
    text: local || text,
    sourceLanguage,
    targetLanguage,
    provider: local ? 'local-fallback' : 'original',
    translated: Boolean(local),
  };
}

async function translateWithGoogleWeb(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLanguage,
    tl: targetLanguage,
    dt: 't',
    q: text,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      signal: controller.signal,
      headers: { 'user-agent': 'gstack-deck-publish/0.1' },
    });
    if (!response.ok) return '';
    const data = await response.json() as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
    return sanitizeCaption(data[0].map((part: unknown) => Array.isArray(part) ? part[0] : '').join(''));
  } finally {
    clearTimeout(timeout);
  }
}

function translateWithLocalFallback(
  text: string,
  sourceLanguage: CaptionState['sourceLanguage'],
  targetLanguage: CaptionState['sourceLanguage'],
): string {
  if (sourceLanguage === 'en' && targetLanguage === 'ja') return translateEnglishCaptionToJapanese(text);
  if (sourceLanguage === 'ja' && targetLanguage === 'en') return translateJapaneseCaptionToEnglish(text);
  return '';
}

function translateEnglishCaptionToJapanese(text: string): string {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const exact: Record<string, string> = {
    hello: 'こんにちは。',
    'hello everyone': 'みなさん、こんにちは。',
    'welcome to the talk': 'このトークへようこそ。',
    'the web needs an agent entrance': 'Webにはエージェント用の入口が必要です。',
    'services need an agent entrance': 'サービスにはエージェント用の入口が必要です。',
    'human ui stays': '人間向けUIは残ります。',
    'agent path becomes first class': 'エージェント向けの経路が第一級になります。',
    'deck json is the source of truth': 'deck.jsonが信頼できる情報源です。',
    'speaker html is for delivery': 'speaker.htmlは発表用です。',
    'attendee html is for participants': 'attendee.htmlは参加者用です。',
    'inspect deck json first': 'まずdeck.jsonを確認してください。',
    'real device tunnel smoke test': '実機トンネルのスモークテストです。',
  };
  if (exact[normalized]) return exact[normalized];

  let translated = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bagents?\b/gi, 'エージェント'],
    [/\bagent entrance\b/gi, 'エージェント用の入口'],
    [/\bhuman ui\b/gi, '人間向けUI'],
    [/\bspeaker view\b/gi, 'スピーカー表示'],
    [/\battendee view\b/gi, '参加者表示'],
    [/\bparticipant(s)?\b/gi, '参加者'],
    [/\bspeaker\b/gi, 'スピーカー'],
    [/\bslide(s)?\b/gi, 'スライド'],
    [/\bcaption(s)?\b/gi, '字幕'],
    [/\btranslation\b/gi, '翻訳'],
    [/\blive\b/gi, 'ライブ'],
    [/\bweb\b/gi, 'Web'],
    [/\bservice(s)?\b/gi, 'サービス'],
    [/\bdeck json\b/gi, 'deck.json'],
    [/\bsource of truth\b/gi, '信頼できる情報源'],
    [/\bhello\b/gi, 'こんにちは'],
    [/\bwelcome\b/gi, 'ようこそ'],
    [/\bneeds?\b/gi, '必要です'],
  ];
  for (const [pattern, replacement] of replacements) translated = translated.replace(pattern, replacement);
  if (translated === text) return '';
  return sanitizeCaption(translated);
}

function translateJapaneseCaptionToEnglish(text: string): string {
  let translated = text;
  const replacements: Array<[RegExp, string]> = [
    [/エージェント/g, 'agent'],
    [/人間向けUI/g, 'human UI'],
    [/スピーカー/g, 'speaker'],
    [/参加者/g, 'participants'],
    [/スライド/g, 'slides'],
    [/字幕/g, 'captions'],
    [/翻訳/g, 'translation'],
    [/ライブ/g, 'live'],
    [/サービス/g, 'services'],
    [/信頼できる情報源/g, 'source of truth'],
    [/こんにちは/g, 'hello'],
    [/ようこそ/g, 'welcome'],
  ];
  for (const [pattern, replacement] of replacements) translated = translated.replace(pattern, replacement);
  if (translated === text) return '';
  return sanitizeCaption(translated);
}

function adjacentSlideId(deck: Deck, direction: 'next' | 'prev'): string {
  const index = Math.max(0, deck.slides.findIndex(slide => slide.id === currentSlideId));
  const nextIndex = direction === 'prev'
    ? Math.max(index - 1, 0)
    : Math.min(index + 1, deck.slides.length - 1);
  return deck.slides[nextIndex]?.id ?? currentSlideId;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function sse(): Response {
  const encoder = new TextEncoder();
  let send = (_data: unknown) => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      send = data => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      listeners.add(send);
      send(sessionState());
    },
    cancel() {
      listeners.delete(send);
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}

function preferencesForPreset(name: string): Preferences {
  return { ...(presetPreferences[name] ?? defaultPreferences) };
}

function normalizePreferences(value: Partial<Preferences> | undefined): Preferences {
  const fontScale = typeof value?.fontScale === 'number' && Number.isFinite(value.fontScale)
    ? value.fontScale
    : defaultPreferences.fontScale;
  return {
    language: value?.language === 'ja' ? 'ja' : 'en',
    fontScale: Math.max(0.9, Math.min(1.8, Number(fontScale.toFixed(2)))),
    detail: value?.detail === 'detailed' ? 'detailed' : 'normal',
    contrast: value?.contrast === 'high' ? 'high' : 'default',
    level: value?.level === 'beginner' || value?.level === 'expert' ? value.level : 'standard',
  };
}

function adaptRequest(requestText: string, current: Preferences): Preferences & { explanation: string } {
  const text = requestText.trim().toLowerCase();
  const patch: Partial<Preferences> = {};
  const reasons: string[] = [];

  if (includesAny(text, ['日本語', '翻訳', 'ja', 'japanese'])) {
    patch.language = 'ja';
    reasons.push('Japanese');
  }
  if (includesAny(text, ['英語', 'en', 'english'])) {
    patch.language = 'en';
    reasons.push('English');
  }
  if (includesAny(text, ['もっと大きく', 'さらに大きく', 'huge', 'bigger'])) {
    patch.fontScale = Math.max(current.fontScale + 0.35, 1.55);
    reasons.push('larger text');
  } else if (includesAny(text, ['大きく', '読みやすく', '見やすく', 'large'])) {
    patch.fontScale = Math.max(current.fontScale + 0.2, 1.3);
    reasons.push('large text');
  }
  if (includesAny(text, ['小さく', 'compact', 'smaller'])) {
    patch.fontScale = 1;
    reasons.push('standard text size');
  }
  if (includesAny(text, ['初心者', 'やさしく', '優しく', 'わかりやすく', '分かりやすく', 'beginner'])) {
    patch.level = 'beginner';
    patch.detail = 'normal';
    reasons.push('beginner explanation');
  }
  if (includesAny(text, ['専門', '詳しく', '深く', 'expert', 'technical', 'detail'])) {
    patch.level = 'expert';
    patch.detail = 'detailed';
    reasons.push('expert detail');
  }
  if (includesAny(text, ['暗く', '高コントラスト', 'コントラスト', 'dark', 'contrast'])) {
    patch.contrast = 'high';
    reasons.push('high contrast');
  }
  if (includesAny(text, ['標準', '普通', 'standard', 'reset'])) {
    return { ...defaultPreferences, explanation: 'Reset to the standard attendee view.' };
  }

  return {
    ...normalizePreferences({ ...current, ...patch }),
    explanation: reasons.length ? `Updated for ${reasons.join(', ')}.` : 'Kept the current attendee view.',
  };
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some(needle => text.includes(needle.toLowerCase()));
}

function renderPersonalizedSlide(deck: Deck, slideId: string, preferences: Preferences): Record<string, unknown> {
  const slide = deck.slides.find(item => item.id === slideId) ?? deck.slides[0]!;
  const bulletText = slide.content.bullets?.join(' ') ?? '';
  const columnText = slide.content.columns
    ?.map(column => `${column.label}: ${column.items.join(', ')}`)
    .join(' ')
    ?? '';
  const body = [slide.content.headline, bulletText, columnText, slide.content.nextAction]
    .filter(Boolean)
    .join(' ');
  const terms = (slide.adaptationHints?.deepDiveTags ?? []).map(tag => ({
    label: tag,
    body: preferences.language === 'ja'
      ? `${tag} に関係する補足ポイントです。`
      : `Related expansion point for ${tag}.`,
  }));

  return {
    slide: { id: slide.id, title: slide.title },
    title: preferences.language === 'ja' ? `${slide.title}（日本語ビュー）` : slide.title,
    body: preferences.language === 'ja'
      ? localizeForJapanese(body, preferences.level)
      : adaptBodyForLevel(body, preferences.level),
    takeaway: preferences.language === 'ja'
      ? `要点: ${slide.attendeeTakeaway}`
      : slide.attendeeTakeaway,
    terms: preferences.detail === 'detailed' || preferences.level !== 'standard' ? terms : [],
    className: preferences.contrast === 'high' ? 'theme-high' : '',
    style: `--font-scale:${preferences.fontScale}`,
  };
}

function adaptBodyForLevel(body: string, level: Preferences['level']): string {
  if (level === 'beginner') return `${body} In plain terms: keep the human page, and add a cleaner path for trusted agents.`;
  if (level === 'expert') return `${body} Technical angle: the semantic deck data keeps rendering separate from the contract future agents consume.`;
  return body;
}

function localizeForJapanese(body: string, level: Preferences['level']): string {
  const suffix = level === 'beginner'
    ? ' つまり、人間向け画面は残しつつ、エージェント向けの安全な入口を足すということです。'
    : level === 'expert'
      ? ' 技術的には、意味データをHTMLから分離して、後続のエージェントが扱える契約として残します。'
      : '';
  return `${body}${suffix}`;
}

async function serveStatic(root: string, pathname: string): Promise<Response | undefined> {
  const requested = decodeURIComponent(pathname === '/' ? '/attendee.html' : pathname);
  const candidate = normalize(join(root, requested));
  if (!isInside(root, candidate)) return new Response('Forbidden', { status: 403 });

  const file = Bun.file(candidate);
  if (!(await file.exists())) return undefined;
  return new Response(file, {
    headers: {
      'content-type': contentType(candidate),
      'cache-control': 'no-store',
    },
  });
}

function isInside(root: string, candidate: string): boolean {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate === root || candidate.startsWith(normalizedRoot);
}

function contentType(path: string): string {
  const ext = extname(path);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}

function chooseTunnel(mode: TunnelMode): Exclude<TunnelMode, 'auto'> {
  if (mode === 'none') return 'none';
  if (mode === 'ngrok' || mode === 'cloudflared') {
    if (!Bun.which(mode)) throw new Error(`${mode} is not installed or not on PATH.`);
    return mode;
  }
  if (Bun.which('ngrok')) return 'ngrok';
  if (Bun.which('cloudflared')) return 'cloudflared';
  return 'none';
}

async function waitForNgrokUrl(): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels');
      const data = await response.json() as { tunnels?: Array<{ public_url?: string; proto?: string }> };
      const url = data.tunnels?.find(tunnel => tunnel.proto === 'https')?.public_url
        ?? data.tunnels?.find(tunnel => tunnel.public_url?.startsWith('https://'))?.public_url;
      if (url) return url;
    } catch {
      // ngrok starts its local API after the tunnel process boots.
    }
    await Bun.sleep(300);
  }
  throw new Error('Timed out waiting for ngrok public URL.');
}

async function waitForCloudflaredUrl(proc: ReturnType<typeof Bun.spawn>): Promise<string> {
  const decoder = new TextDecoder();
  const pattern = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
  const streams = [proc.stdout, proc.stderr].filter(Boolean) as ReadableStream<Uint8Array>[];
  const deadline = Date.now() + 15_000;

  return await new Promise((resolveUrl, reject) => {
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for cloudflared public URL.'));
      }
    }, 250);

    for (const stream of streams) {
      void (async () => {
        for await (const chunk of stream) {
          const text = decoder.decode(chunk);
          const match = text.match(pattern);
          if (match) {
            clearInterval(timer);
            resolveUrl(match[0]);
            return;
          }
        }
      })();
    }
  });
}

function printUrls(label: string, base: string): void {
  const urls = urlsFor(base);
  console.log(`${label}: ${base}`);
  console.log(`  speaker:  ${urls.speaker}`);
  console.log(`  attendee: ${urls.attendee}`);
  console.log(`  deck:     ${urls.deck}`);
}

function urlsFor(base: string): Record<string, string> {
  return {
    speaker: `${base}/speaker.html`,
    attendee: `${base}/attendee.html`,
    deck: `${base}/deck.json`,
  };
}

function printHelp(): void {
  console.log(`Publish a speaker-deck-builder output folder.

Usage:
  gstack-deck-publish <deck-output-dir> [--port 8976] [--tunnel auto|ngrok|cloudflared|none]

Required files:
  ${REQUIRED_FILES.join(', ')}

Examples:
  gstack-deck-publish adaptive-live-deck/examples/agent-entrance-live
  gstack-deck-publish ./deck --port 8980 --tunnel ngrok
  gstack-deck-publish ./deck --tunnel none
`);
}
