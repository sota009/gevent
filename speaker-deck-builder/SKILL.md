---
name: speaker-deck-builder
preamble-tier: 2
version: 0.1.0
description: Build an Adaptive Live Deck source package from scripts, Markdown, notes, title, audience, and duration. (gstack)
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
triggers:
  - make a live deck
  - build speaker slides
  - turn notes into an adaptive deck
  - prepare an attendee deck
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->


## When to invoke this skill

Produces deck.json, speaker.html,
speaker-notes.md, and attendee.html by first creating a semantic slide IR.
Optimized for a minimal 3-hour hackathon flow, not a full presentation suite.
Use when asked to "make a live deck", "build speaker slides", "turn these
notes into an adaptive deck", or "prepare an attendee deck".

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.gstack/.proactive-prompted ] && echo "yes" || echo "no")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(~/.claude/skills/gstack/bin/gstack-config get skill_prefix 2>/dev/null || echo "false")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
source <(~/.claude/skills/gstack/bin/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_SESSION_KIND=$(~/.claude/skills/gstack/bin/gstack-session-kind 2>/dev/null || echo "interactive")
case "$_SESSION_KIND" in spawned|headless|interactive) ;; *) _SESSION_KIND="interactive" ;; esac
echo "SESSION_KIND: $_SESSION_KIND"
_ACTIVATED=$([ -f ~/.gstack/.activated ] && echo "yes" || echo "no")
echo "ACTIVATED: $_ACTIVATED"
mkdir -p ~/.gstack/analytics
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
if [ "$_TEL" != "off" ]; then
echo '{"skill":"speaker-deck-builder","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(_repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null | tr -cd 'a-zA-Z0-9._-'); echo "${_repo:-unknown}")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
```

# /speaker-deck-builder — Adaptive Live Deck Source Builder

Turn rough speaker material into a small, inspectable deck package:

- `deck.json` — semantic slide IR and the source of truth.
- `speaker.html` — speaker-controlled presentation view.
- `speaker-notes.md` — presenter script, timing, and handoff cues.
- `attendee.html` — baseline attendee view rendered from the same IR.

The MVP is a hackathon path: useful in about 3 hours, easy to inspect, and easy
to hand to `/adaptive-attendee-deck`. Prefer a boring static output over a broad
deck platform.

## Inputs

Accept any combination of:

- Script text, Markdown, outline, meeting notes, or pasted bullets.
- Title or working title.
- Audience: who attends, what they already know, what they need next.
- Duration: total minutes, talk style, Q&A allocation, and any hard timing.
- Existing brand constraints or visual preferences, if provided.

If required inputs are missing, ask only for the smallest unblocker:

1. Topic/title.
2. Audience.
3. Target duration.

## User Journey

1. Speaker brings rough material: notes, script, or a Markdown doc.
2. Skill extracts the talk promise, audience model, and section arc.
3. Skill creates semantic slide IR before any HTML.
4. Speaker reviews `speaker-notes.md` for timing and flow.
5. Speaker opens `speaker.html` for delivery.
6. Attendees open `attendee.html` or later request personalization through
   `/adaptive-attendee-deck`.

## Step 1 — Normalize Source Material

Read the supplied files or pasted content. Extract:

- Core promise: one sentence the audience should remember.
- Audience model: role, prior knowledge, desired outcome, likely objections.
- Timing budget: total minutes, per-section rough allocation, Q&A.
- Content inventory: stories, claims, examples, demos, diagrams, citations.

Do not preserve source order blindly. Reorder into a coherent talk arc when it
helps the audience.

## Step 2 — Create Semantic Slide IR

Build `deck.json` first. It is not a screenshot description; it is semantic
structure that other renderers can adapt.

Recommended shape:

```json
{
  "version": "0.1",
  "title": "Talk title",
  "audience": {
    "role": "Founders",
    "priorKnowledge": "Knows AI tools, not agent protocols",
    "desiredOutcome": "Can explain the wedge and next action"
  },
  "durationMinutes": 20,
  "sections": [
    {
      "id": "opening",
      "purpose": "earn-attention",
      "timeMinutes": 3,
      "slides": ["s1", "s2"]
    }
  ],
  "slides": [
    {
      "id": "s1",
      "type": "thesis",
      "title": "The shift",
      "purpose": "frame",
      "speakerIntent": "Make the audience feel the old workflow breaking",
      "attendeeTakeaway": "Agents need service-native handoff",
      "content": {
        "headline": "Services need an agent entrance",
        "bullets": ["Human UI stays", "Agent path becomes first-class"]
      },
      "notes": "Open with the concrete before/after.",
      "adaptationHints": {
        "canShorten": true,
        "deepDiveTags": ["architecture", "market"]
      }
    }
  ]
}
```

Every slide needs:

- `id`, `type`, `title`, `purpose`.
- `speakerIntent`: why the slide exists.
- `attendeeTakeaway`: what should survive without the speaker.
- `content`: renderer-neutral text/data.
- `notes`: presenter guidance.
- `adaptationHints`: how attendee renderers may shorten, expand, or reframe.

## Step 3 — Plan the 3-Hour Hackathon Flow

Keep the output intentionally narrow:

- Hour 1: parse inputs and draft `deck.json`.
- Hour 2: render simple `speaker.html` and `attendee.html` from the IR.
- Hour 3: tighten `speaker-notes.md`, add navigation, test locally, and hand off.

Defer theme builders, collaborative editing, analytics, multi-speaker support,
and runtime personalization. Document any deferment in `speaker-notes.md` under
`MVP boundaries`.

## Step 4 — Render Artifacts

Create all four artifacts in the user's requested or current working directory.

`speaker.html`:

- Keyboard navigation: next, previous, and reset.
- Shows current slide, next slide title, speaker notes, and elapsed/remaining time.
- Uses `deck.json` semantics; do not duplicate deck content by hand.

`attendee.html`:

- Readable standalone HTML for attendees.
- Keeps slide order and section hierarchy.
- Includes takeaways and optional deeper notes from `adaptationHints`.
- Marks the future personalization handoff point.

`speaker-notes.md`:

- Talk summary.
- Per-slide notes and timing.
- Places to pause, ask questions, or branch.
- Handoff instructions for `/adaptive-attendee-deck`.

## Handoff Points

- Speaker review: after `deck.json` and before rendering, ask the user to check
  the story arc if the source was ambiguous.
- Delivery handoff: `speaker.html` is what the speaker runs live.
- Attendee handoff: `attendee.html` is the default view.
- Personalization handoff: pass `deck.json` plus attendee request to
  `/adaptive-attendee-deck`.
- Future tooling handoff: MCP/ChatGPT/Claude tools should consume `deck.json`
  and emit preferences or render instructions, not rewrite the source IR unless
  the speaker explicitly asks.

## Done Criteria

- `deck.json` validates as JSON.
- Each slide has purpose, speaker intent, attendee takeaway, and notes.
- `speaker.html` and `attendee.html` render without external services.
- `speaker-notes.md` includes timing and handoff points.
- The result can be personalized later without reading the speaker HTML.

## Learning Log

If you discovered something reusable, append one compact note to the project
learning log when available. Keep the skill output itself focused on the deck.
