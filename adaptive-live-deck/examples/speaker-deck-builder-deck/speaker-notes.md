# Speaker Notes: The Web Needs an Agent Entrance

## Talk Summary

This 20-minute live deck argues that the web needs a service-owned entrance for
personal agents beside the human UI. The deck itself shows the same idea:
meaning lives in `deck.json`, while `speaker.html` and `attendee.html` are only
renderings.

Core line to preserve:

> Keep the human UI, but give agents a service-owned entrance with structured
> handoff and consent.

## Timing

| Section | Minutes | Slides |
| --- | ---: | --- |
| Opening | 2 | s01 |
| Problem | 4 | s02-s03 |
| Thesis | 5 | s04-s05 |
| Walkthrough | 5 | s06-s07 |
| Trust | 2 | s08 |
| Close | 2 | s09 |

Q&A happens after the talk.

## Per-Slide Notes

### s01: The user already told their agent

Open with the human pain. The user already told their personal agent what they
want, but the service still asks them to retype the same information. Avoid
protocol terms here.

Pause after: "The form still asks the human to start over."

### s02: Human UI is not a protocol

Make the distinction between useful browser agents and brittle layout-driven
handoff. The point is not that clicking pages is bad. The point is that a
service can offer a cleaner contract.

### s03: Two bad choices

Let the contrast land: scrape the page or make the user copy-paste. Neither is a
good default for important service workflows.

### s04: Keep the human UI. Add an agent entrance.

This is the thesis. Say it slowly and repeat it once. The agent path is additive.
It does not remove human choice.

### s05: Minimum useful agent entrance

Walk through the minimum parts: discovery, structured intake, secure submission,
and human fallback. Use "boring is the feature" to keep the scope small.

### s06: The deck follows the same rule

Bridge from services to the deck. A deck that only exists as rendered pixels is
hard for an attendee agent to adapt. A semantic source of truth makes adaptation
normal.

### s07: Four artifacts, one source

Walk through the files. Open `deck.json` first, then `speaker.html`, then
`attendee.html`. Point out `purpose`, `speakerIntent`, `attendeeTakeaway`, and
`adaptationHints`.

### s08: The trust model is scoped handoff

Answer the security concern without overclaiming. This is not "agents can do
anything." It is scoped discovery, explicit consent, structured payloads, and
service-side verification.

### s09: The next web has an entrance for agents

Close with the exact one-sentence takeaway. Tell the audience the next artifact
to inspect is `deck.json`.

## Branching Cues

- If the room is founder-heavy, spend more time on s04 and s09.
- If the room is developer-heavy, spend more time on s05 and s07.
- If the room is security-heavy, keep s08 and offer to continue in Q&A.

## Handoff Points

- Speaker review: inspect `deck.json` before changing visuals.
- Delivery handoff: open `speaker.html` and use arrow keys.
- Attendee handoff: share `attendee.html` as the default reader view.
- Personalization handoff: pass `deck.json` plus attendee preferences to
  `/adaptive-attendee-deck`.

## MVP Boundaries

This package intentionally does not include collaborative editing, theme builders,
analytics, multi-speaker support, or runtime personalization. The useful MVP is
static, inspectable, and local.
