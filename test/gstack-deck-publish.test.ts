import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BIN = join(import.meta.dir, '..', 'bin', 'gstack-deck-publish');
const createdDirs: string[] = [];

afterEach(async () => {
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
