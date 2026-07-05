import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BIN = join(import.meta.dir, '..', 'bin', 'gstack-deck-publish');
const createdDirs: string[] = [];
const processes: Array<ReturnType<typeof Bun.spawn>> = [];

afterEach(async () => {
  for (const proc of processes.splice(0)) {
    proc.kill();
    await proc.exited.catch(() => {});
  }
  for (const dir of createdDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('gstack-deck-publish', () => {
  test('validates a speaker-deck-builder package in dry-run mode', async () => {
    const dir = await makeDeckPackage();
    const result = Bun.spawnSync([BIN, dir, '--dry-run', '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout.toString());
    expect(data.ok).toBe(true);
    expect(data.tunnel).toBe('none');
    expect(data.urls.attendee).toEndWith('/attendee.html');
    expect(data.urls.deck).toEndWith('/deck.json');
  });

  test('rejects packages missing required generated files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-publish-missing-'));
    createdDirs.push(dir);
    await writeFile(join(dir, 'deck.json'), '{}');

    const result = Bun.spawnSync([BIN, dir, '--dry-run', '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('missing required files');
    expect(result.stderr.toString()).toContain('speaker.html');
  });

  test('rejects slides that are missing semantic IR fields', async () => {
    const dir = await makeDeckPackage({
      slides: [
        {
          id: 's1',
          type: 'thesis',
          title: 'Incomplete slide',
        },
      ],
    });

    const result = Bun.spawnSync([BIN, dir, '--dry-run', '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('slides are missing fields');
    expect(result.stderr.toString()).toContain('s1.speakerIntent');
  });

  test('publishes caption updates through session state', async () => {
    const dir = await makeDeckPackage();
    const port = randomPort();
    const proc = Bun.spawn([BIN, dir, '--port', String(port), '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    processes.push(proc);
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(`${base}/api/session`);

    const response = await fetch(`${base}/api/session/caption`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Agents should receive live captions.',
        provider: 'manual',
        sourceLanguage: 'en',
        isFinal: true,
      }),
    });

    expect(response.status).toBe(200);
    const state = await response.json() as { caption: { text: string; provider: string; seq: number } };
    expect(state.caption.text).toBe('Agents should receive live captions.');
    expect(state.caption.provider).toBe('manual');
    expect(state.caption.seq).toBe(1);

    const session = await fetch(`${base}/api/session`).then(result => result.json()) as typeof state;
    expect(session.caption.text).toBe('Agents should receive live captions.');
  });

  test('rejects oversized caption updates', async () => {
    const dir = await makeDeckPackage();
    const port = randomPort();
    const proc = Bun.spawn([BIN, dir, '--port', String(port), '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    processes.push(proc);
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(`${base}/api/session`);

    const response = await fetch(`${base}/api/session/caption`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(700), provider: 'manual' }),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Caption text must be');
  });

  test('reports Cactus and fallback caption providers', async () => {
    const dir = await makeDeckPackage();
    const port = randomPort();
    const proc = Bun.spawn([BIN, dir, '--port', String(port), '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    processes.push(proc);
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(`${base}/api/session`);

    const providers = await fetch(`${base}/api/caption/providers`).then(result => result.json()) as {
      preferred: string;
      cactus: { available: boolean; command: string };
      browser: { available: boolean; command: string };
      manual: { available: boolean };
    };

    expect(['cactus', 'browser']).toContain(providers.preferred);
    expect(providers.cactus.command).toBe('cactus transcribe');
    expect(providers.browser.available).toBe(true);
    expect(providers.manual.available).toBe(true);
  });

  test('translates captions through the server fallback for mobile attendees', async () => {
    const dir = await makeDeckPackage();
    const port = randomPort();
    const proc = Bun.spawn([BIN, dir, '--port', String(port), '--tunnel', 'none'], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        GSTACK_TRANSLATE_PROVIDER: 'local',
      },
    });
    processes.push(proc);
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(`${base}/api/session`);

    const response = await fetch(`${base}/api/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'The web needs an agent entrance',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
      }),
    });

    expect(response.status).toBe(200);
    const result = await response.json() as { text: string; translated: boolean; provider: string };
    expect(result.translated).toBe(true);
    expect(result.provider).toBe('local-fallback');
    expect(result.text).toContain('エージェント用の入口');
  });
});

async function makeDeckPackage(deckOverrides: Record<string, unknown> = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'deck-publish-'));
  createdDirs.push(dir);
  const deck = {
    version: '0.1',
    title: 'Live Deck',
    audience: {
      role: 'Builders',
      priorKnowledge: 'Knows web apps',
      desiredOutcome: 'Can open attendee.html',
    },
    durationMinutes: 5,
    sections: [
      {
        id: 'opening',
        purpose: 'earn-attention',
        timeMinutes: 5,
        slides: ['s1'],
      },
    ],
    slides: [
      {
        id: 's1',
        type: 'thesis',
        title: 'The shift',
        purpose: 'frame',
        speakerIntent: 'Frame the talk.',
        attendeeTakeaway: 'Semantic deck data matters.',
        content: {
          headline: 'One source, many views',
          bullets: ['Speaker view', 'Attendee view'],
        },
        notes: 'Open with the point.',
        adaptationHints: {
          canShorten: true,
          deepDiveTags: ['walkthrough'],
        },
      },
    ],
    ...deckOverrides,
  };

  await writeFile(join(dir, 'deck.json'), `${JSON.stringify(deck, null, 2)}\n`);
  await writeFile(join(dir, 'speaker.html'), '<!doctype html><title>speaker</title>');
  await writeFile(join(dir, 'attendee.html'), '<!doctype html><title>attendee</title>');
  await writeFile(join(dir, 'speaker-notes.md'), '# Notes\n');
  return dir;
}

function randomPort(): number {
  return 19_000 + Math.floor(Math.random() * 20_000);
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await Bun.sleep(50);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
