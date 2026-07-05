import { describe, expect, test } from 'bun:test';
import { adaptRequest, mergePreferences, preferencesForPreset } from '../adaptive-live-deck/src/adapt';
import { defaultPreferences, slides } from '../adaptive-live-deck/src/deck';
import { renderPersonalizedSlide } from '../adaptive-live-deck/src/render';
import { LiveDeckSession } from '../adaptive-live-deck/src/session';

describe('adaptive live deck preferences', () => {
  test('Japanese large beginner request maps to attendee preferences', () => {
    const result = adaptRequest('日本語で大きく初心者向け');
    expect(result.language).toBe('ja');
    expect(result.fontScale).toBeGreaterThan(1);
    expect(result.level).toBe('beginner');
    expect(result.detail).toBe('normal');
  });

  test('English expert detail request maps to detailed expert preferences', () => {
    const result = adaptRequest('Switch back to English with technical detail for experts', {
      ...defaultPreferences,
      language: 'ja',
      level: 'beginner',
    });
    expect(result.language).toBe('en');
    expect(result.level).toBe('expert');
    expect(result.detail).toBe('detailed');
  });

  test('preset selection maps to expected preference objects', () => {
    expect(preferencesForPreset('jaLarge')).toMatchObject({
      language: 'ja',
      contrast: 'default',
    });
    expect(preferencesForPreset('highContrast')).toMatchObject({
      contrast: 'high',
    });
    expect(preferencesForPreset('expert')).toMatchObject({
      detail: 'detailed',
      level: 'expert',
    });
  });

  test('preference merging preserves existing values on partial updates', () => {
    const merged = mergePreferences(
      { ...defaultPreferences, language: 'ja', contrast: 'high' },
      { fontScale: 1.42 },
    );
    expect(merged.language).toBe('ja');
    expect(merged.contrast).toBe('high');
    expect(merged.fontScale).toBe(1.42);
  });
});

describe('adaptive live deck synchronization and rendering', () => {
  test('speaker next changes current slide from slide 1 to slide 2', () => {
    const session = new LiveDeckSession();
    const seenSlideIds: string[] = [];
    const unsubscribe = session.subscribe(state => seenSlideIds.push(state.currentSlideId));
    expect(session.getState().currentSlideId).toBe(slides[0]!.id);

    session.setSlide(slides[1]!.id);
    unsubscribe();

    expect(session.getState().currentSlideId).toBe(slides[1]!.id);
    expect(seenSlideIds).toEqual([slides[0]!.id, slides[1]!.id]);
  });

  test('attendee renders the current slide state', () => {
    const session = new LiveDeckSession();
    session.setSlide(slides[1]!.id);

    const rendered = renderPersonalizedSlide(session.getState().currentSlideId, defaultPreferences);

    expect(rendered.slide.id).toBe(slides[1]!.id);
    expect(rendered.title).toBe(slides[1]!.title);
  });

  test('two attendees render different variants for the same slide', () => {
    const slideId = slides[2]!.id;
    const japaneseBeginner = renderPersonalizedSlide(slideId, preferencesForPreset('beginner'));
    const expert = renderPersonalizedSlide(slideId, preferencesForPreset('expert'));

    expect(japaneseBeginner.body).toBe(slides[2]!.beginner);
    expect(expert.body).toBe(slides[2]!.expert);
    expect(japaneseBeginner.className).not.toBe(expert.className);
  });

  test('in-deck customize updates only that attendee preferences object', () => {
    const attendeeA = preferencesForPreset('standard');
    const attendeeB = preferencesForPreset('standard');

    const updatedB = adaptRequest('日本語で、もっと大きく、初心者向けにして', attendeeB);

    expect(attendeeA.language).toBe('en');
    expect(attendeeA.fontScale).toBe(1);
    expect(updatedB.language).toBe('ja');
    expect(updatedB.fontScale).toBeGreaterThan(attendeeA.fontScale);
    expect(updatedB.level).toBe('beginner');
  });
});
