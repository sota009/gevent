# Speaker Deck Builder Input

Use this as pasted input for `/speaker-deck-builder`.

## Title

The Web Needs an Agent Entrance

## Audience

Product-minded engineers and early-stage founders who already use AI coding
tools, but have not built agent-facing service workflows yet.

They understand APIs, forms, web apps, and basic security tradeoffs. They may
not know Agent Cards, A2A-style handoff, encrypted intake, or adaptive attendee
decks.

## Duration

20 minutes total.

- 2 minutes: opening story
- 4 minutes: problem framing
- 5 minutes: product thesis
- 5 minutes: operator walkthrough
- 2 minutes: architecture and trust model
- 2 minutes: close and next action

Q&A happens after the talk, not inside the 20 minutes.

## Core Promise

By the end, the audience should understand why every serious service will need
an agent-native entrance next to the human UI, and how a semantic live deck can
explain that shift without becoming a giant presentation platform.

## Rough Talk Material

Most services still assume a human is sitting in front of a browser, reading
labels, typing into fields, and deciding what to submit.

That worked when software was mostly a conversation between a person and a web
page. It breaks when a personal AI agent is the one preparing the data, checking
the user's preferences, and trying to complete the task on their behalf.

Today, an agent often has two bad choices. It can scrape the human interface and
hope the layout has not changed, or it can ask the user to copy data back into a
form manually. Both options lose the point of having an agent.

The better shape is additive. Keep the human UI. Add an agent entrance.

An agent entrance is a service-owned path where a trusted agent can discover
what the service accepts, prepare a structured payload, preserve consent, and
hand off data in a way the service can verify.

For this run, the deck itself is also part of the story. A normal slide deck is
mostly pixels. It is hard for another agent to adapt it for a founder, a
security reviewer, or a developer who wants implementation details. An Adaptive
Live Deck starts from semantic slide data instead.

The speaker view is only one rendering. The attendee view is another rendering.
Later, an attendee-specific view can be generated from the same source of truth
without reverse-engineering the speaker HTML.

## Operator Walkthrough

1. Show a rough block of notes and explain that it is not slide-shaped yet.
2. Run `/speaker-deck-builder` to turn the notes into four artifacts.
3. Open `deck.json` and point out that each slide has purpose, speaker intent,
   attendee takeaway, content, notes, and adaptation hints.
4. Open `speaker.html` and show keyboard navigation, speaker notes, next slide,
   and timing.
5. Open `attendee.html` and show that it is readable without the speaker.
6. Explain the handoff to `/adaptive-attendee-deck`: it consumes `deck.json`,
   plus an attendee request, instead of scraping slide pixels.

## Desired Slide Arc

### Opening

Start with the familiar pain: a user already told their personal agent what they
want, but the service still asks them to type everything again.

### Problem

Human UI is not a stable protocol. Scraping is fragile, hidden, and difficult to
audit. Manual copy-paste turns the agent into a clipboard with extra steps.

### Thesis

Services need a first-class agent entrance beside the human interface.

### Product Shape

The minimum useful version is boring on purpose:

- A discoverable card that tells agents what the service accepts.
- A structured intake request with consent and schema information.
- A secure submission path that the service can verify.
- A human-readable fallback so the user stays in control.

### Live Deck Connection

The deck should model the same principle. Do not trap meaning in pixels. Keep a
semantic source of truth, render it for the current context, and make later
adaptation possible.

### Walkthrough

Walk through the generated artifacts:

- `deck.json` is the source of truth.
- `speaker.html` is for delivery.
- `speaker-notes.md` is for timing and speaker intent.
- `attendee.html` is for people who need the content after the talk.

### Trust

The trust model is not "let agents do anything." It is scoped discovery,
explicit consent, structured payloads, service-side verification, and a visible
human fallback.

### Close

The old web optimized for humans reading pages. The next web still serves
humans, but it also gives their agents a clean entrance.

## Claims To Preserve

- Human UI should remain available.
- Agent-native workflows should be additive, not a replacement for human choice.
- Semantic source data is better than reverse-engineering rendered output.
- A hackathon MVP should be inspectable static output, not a full deck platform.
- Personalization should consume `deck.json`, not rewrite `speaker.html`.

## Likely Audience Objections

### "Isn't this just an API?"

No. APIs are usually designed for developers who integrate once and maintain
code. An agent entrance is discoverable at task time, scoped to a user's intent,
and paired with consent and user-facing explanation.

### "Will this replace normal websites?"

No. The point is to add an agent path beside the human path. People still need
to inspect, override, and complete tasks directly.

### "Why not let browser agents click the form?"

Browser agents are useful, but layout-driven automation is brittle. A
service-owned entrance gives both sides a contract they can inspect.

### "Why does the deck need to be adaptive?"

Different attendees need different depth. A founder may want the wedge and
market timing. A developer may want the schema and handoff flow. A security
reviewer may want threat boundaries. The same talk should support all three.

## Visual Preferences

Use a calm technical style. Prefer high contrast, readable text, and simple
layouts. Avoid startup hype language, decorative gradients, and giant hero
slides. The deck should feel like a working artifact a builder can inspect.

## MVP Boundaries

Do not build collaborative editing, theme builders, analytics, multi-speaker
support, or runtime personalization in this first pass.

The output should be static and local:

- `deck.json`
- `speaker.html`
- `speaker-notes.md`
- `attendee.html`

## Suggested Speaker Tone

Direct, practical, and builder-to-builder. The speaker should make the audience
feel that the current form-based flow is not evil, just incomplete for the agent
era.

## Desired Next Action

After the talk, the audience should be able to explain the idea in one sentence:

"Keep the human UI, but give agents a service-owned entrance with structured
handoff and consent."

They should also know what to inspect first: `deck.json`.
