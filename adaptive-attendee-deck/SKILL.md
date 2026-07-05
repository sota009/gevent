---
name: adaptive-attendee-deck
preamble-tier: 2
version: 0.1.0
description: Personalize an attendee-facing Adaptive Live Deck from deck.json, a preset, and a natural-language attendee request. (gstack)
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
triggers:
  - personalize this deck
  - adapt the attendee deck
  - make a shorter deck for me
  - turn this deck into my view
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->


## When to invoke this skill

Produces preference JSON and
rendering guidance for attendee.html while preserving the speaker-authored
semantic slide IR. Documents the future MCP/ChatGPT/Claude tool boundary.
Use when asked to "personalize this deck", "adapt the attendee deck", "make
a shorter deck for me", or "turn this deck into my view".

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
echo '{"skill":"adaptive-attendee-deck","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(_repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null | tr -cd 'a-zA-Z0-9._-'); echo "${_repo:-unknown}")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
```

# /adaptive-attendee-deck — Attendee Personalization Pass

Turn a speaker-authored `deck.json` into attendee-specific preferences and
rendering guidance. This skill adapts presentation, emphasis, and depth; it does
not mutate the source deck unless the speaker explicitly asks.

## Inputs

Required:

- `deck.json` from `/speaker-deck-builder`.
- Preset, such as `quick`, `deep-dive`, `technical`, `executive`,
  `beginner`, or `action-items`.
- Natural-language attendee request, such as "I have 5 minutes", "make this
  technical", "I am new to the topic", or "show only decisions and next steps".

If a preset is missing, infer one from the request and state the inference. If
both preset and request are missing, ask one question for the attendee goal.

## Outputs

Produce:

- Preference JSON: stable, machine-readable attendee preferences.
- Personalized rendering guidance: how `attendee.html` should include, hide,
  summarize, expand, or annotate slides.

Do not rewrite `deck.json` by default. Keep personalization as a reversible layer.

## User Journey

1. Speaker builds a source deck with `/speaker-deck-builder`.
2. Attendee opens the default `attendee.html`.
3. Attendee asks for a version that fits their time, role, knowledge, or goal.
4. Skill reads `deck.json`, preset, and request.
5. Skill emits preference JSON plus rendering guidance.
6. Renderer applies the preferences to the attendee view without changing the
   speaker view.

## Step 1 — Validate the Deck IR

Read `deck.json` and confirm:

- `title`, `sections`, and `slides` exist.
- Slide ids are unique.
- Section slide references resolve.
- Slides have `purpose`, `speakerIntent`, `attendeeTakeaway`, and `content`.

If validation fails, report the smallest fix needed and stop. Do not personalize
an ambiguous IR.

## Step 2 — Interpret the Attendee Request

Map the preset and natural language into preferences:

```json
{
  "version": "0.1",
  "deckId": "optional-or-derived",
  "preset": "quick",
  "attendeeGoal": "Understand the core argument in 5 minutes",
  "constraints": {
    "timeMinutes": 5,
    "knowledgeLevel": "beginner",
    "role": "investor"
  },
  "rendering": {
    "density": "compact",
    "includeSpeakerNotes": false,
    "showTakeaways": true,
    "showActions": true
  },
  "slidePolicy": {
    "include": ["thesis", "decision", "action"],
    "summarize": ["context", "example"],
    "expandTags": ["market"],
    "hideTags": []
  }
}
```

Use the deck's `adaptationHints` when present. If hints are missing, derive
policy from slide `type`, `purpose`, and `attendeeTakeaway`.

## Step 3 — Generate Rendering Guidance

Write guidance that a renderer or agent can apply deterministically:

- Slide inclusion order and any skipped slide ids.
- Per-slide treatment: full, summary, hidden, expanded, annotated, action-only.
- Replacement copy for attendee-facing summaries when needed.
- Warnings where the attendee request conflicts with the speaker's intended arc.
- Accessibility notes if the personalization increases density.

Keep guidance renderer-neutral. It may be consumed by static HTML, an MCP tool,
ChatGPT, Claude, or another agent.

## Preset Semantics

- `quick`: shortest coherent path; preserve thesis, decisions, and actions.
- `deep-dive`: include examples, caveats, and expandable technical notes.
- `technical`: emphasize architecture, data flow, tradeoffs, and APIs.
- `executive`: emphasize thesis, business impact, risks, and decisions.
- `beginner`: add context and define terms; reduce jargon and assumed knowledge.
- `action-items`: show decisions, next steps, owners, deadlines, and open questions.

## Handoff Points

- Speaker boundary: `deck.json` remains the authored source of truth.
- Attendee boundary: preference JSON belongs to one attendee/session.
- Renderer boundary: `attendee.html` or a future renderer applies preferences.
- Tool boundary: future MCP/ChatGPT/Claude tools may read `deck.json`, create
  preference JSON, and request a render. They should not directly edit the deck
  IR unless operating in an explicit speaker/editor mode.
- Feedback boundary: if an attendee discovers a source-deck issue, report it as
  suggested speaker feedback instead of silently patching the IR.

## Done Criteria

- Preference JSON is valid JSON.
- Rendering guidance references real slide ids.
- Personalization is reversible and does not require modifying `deck.json`.
- Any inferred preset, time limit, or audience role is stated.
- Future MCP/ChatGPT/Claude integration boundary is clear in the output.

## Learning Log

If you discovered something reusable, append one compact note to the project
learning log when available. Keep the skill output itself focused on deck
personalization.
