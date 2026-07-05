# gevent

**Skills for making tech events better** — a fork of [gstack](https://github.com/garrytan/gstack) that adds event-focused skills to Coding agents. Everything below is a slash command.

`gevent` keeps all of gstack's engineering skills and adds three event tools.


## 1. Accessible live-slide website (the main feature)

Turn rough talk notes into a **live presentation website where every attendee gets their own accessible, personalized view** — no app to install, just a URL.

The speaker drives the slides. Each attendee's browser adapts the *same* slide to them in real time:

- **Language** — English or Japanese, per attendee
- **Reading level** — beginner / standard / expert wording of the same slide
- **Font scaling** for readability
- **High-contrast mode** for low-vision attendees

**How it works**
- **`/speaker-deck-builder`** parses notes into a semantic slide IR (`deck.json`) — the source of truth, decoupled from any one rendering. It emits `speaker.html`, `attendee.html`, and presenter notes.
- **`/adaptive-attendee-deck`** turns a natural-language attendee request ("make it shorter and in Japanese") into a preference profile that re-renders the slide from the same IR.
- The runtime (`adaptive-live-deck/`) is a **Bun HTTP server in TypeScript**: `Bun.serve` hosts a live session, syncs the speaker's current slide to all attendees, and renders each slide per that attendee's preferences. Output is plain static HTML with no external dependencies, publishable over an **ngrok / cloudflared tunnel** via `bin/gstack-deck-publish`.

Built for a ~3-hour hackathon flow: a boring, inspectable static deck over a heavy presentation platform.

## 2. `/event-creator`

Turns event details into a ready-to-publish **Luma** and/or **connpass** event page — including timetable — driving your already-logged-in browser session. Mirrors one event across both platforms, with safety gates before anything goes live.

## 3. `/event-researcher`

Given a Luma URL or event name, researches the event (speakers, links, official details), enriches it with web search, cites sources, and produces structured Markdown notes.


## Install

```bash
git clone --single-branch --depth 1 https://github.com/sota009/gevent.git ~/.claude/skills/gevent && cd ~/.claude/skills/gevent && ./setup
```

Requirements: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+.
