import { EVENT_ID, slides } from './deck';
import type { SessionState } from './types';

type Listener = (state: SessionState) => void;

export class LiveDeckSession {
  private state: SessionState = {
    eventId: EVENT_ID,
    currentSlideId: slides[0]!.id,
    updatedAt: new Date().toISOString(),
  };

  private listeners = new Set<Listener>();

  getState(): SessionState {
    return { ...this.state };
  }

  setSlide(slideId: string): SessionState {
    if (!slides.some(slide => slide.id === slideId)) {
      throw new Error(`Unknown slide id: ${slideId}`);
    }
    this.state = {
      ...this.state,
      currentSlideId: slideId,
      updatedAt: new Date().toISOString(),
    };
    this.emit();
    return this.getState();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}
