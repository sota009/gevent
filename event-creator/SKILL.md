---
name: event-creator
description: Create gstack Luma and connpass event pages from event details, including timetable sections.
triggers:
  - "Luma event"
  - "Lumaイベント"
  - "connpass event"
  - "connpassイベント"
  - "イベントページを作成"
  - "タイムテーブル込み"
  - "logged-in Luma"
  - "ログイン済みLuma"
  - "mirror this meetup to both Luma and connpass"
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->


## When to invoke this skill

Use when the user asks to make, draft, publish, or update an event page on Luma,
connpass, lu.ma, or connpass.com from structured or rough event information;
when they want Browser Use, browser-harness, webwright, or a logged-in browser
session used for event-page creation; or when they need the same event mirrored
across Luma and connpass.

# Event Creator

## Overview

Turn event information into a platform-ready Luma and/or connpass event page while preserving a source-of-truth brief, timetable, screenshots, and a final structured result.

Prefer webwright's plan and evidence workflow for standardization. Use Browser Use CLI or browser-harness for the actual authenticated browser actions when the task depends on the user's already logged-in Luma or connpass session.

## Required Context

Read `references/platform-notes.md` before operating the browser. It contains current platform behavior and official source URLs.

Collect or infer these fields before editing a live site:

- Platform target: `luma`, `connpass`, or both.
- Title, subtitle/tagline if any, date, start time, end time, timezone.
- Event type: in-person, online, or hybrid.
- Venue name/address and public map URL, or online tool name and join URL visibility.
- Organizer/calendar/group, host display name, speakers, hashtag.
- Capacity, ticket/fee model, waitlist/approval, registration questions if needed.
- Visibility and publish intent: draft only, create live after confirmation, or publish after confirmation.
- Event description and timetable, even if rough.

If key details are missing, draft sensible copy and mark the unresolved fields in the preflight summary instead of guessing silently.

## Dry Run

If the user asks for a dry run, no-browser mode, preview only, or explicitly forbids browser/file actions, do not open the browser or create run artifacts. Produce only:

- A normalized source brief.
- Platform-specific field mapping.
- The exact confirmation gates that would be hit.
- The JSON-like output with `status: "needs_human"` and empty URLs.

## Tool Priority

Use this order:

1. **webwright** for planning, reusable script shape, checkpoints, screenshots, logs, and final verification structure. Use `WORKSPACE_DIR=~/.gstack/runs/event-creator/<timestamp>-<platform>` unless the user asks for repo-local artifacts.
2. **Browser Use CLI / browser-harness** for logged-in local Chrome actions. This is the default for Luma and connpass creation because webwright's fresh Firefox does not have the user's logged-in session.
3. **gstack browse** only for quick visual QA or screenshot support when it is already the available browser surface.

Do not type account passwords or 2FA codes. If the browser is not logged in, stop and ask the user to log in manually.

## Source Brief

Before touching the site, create a source-of-truth event brief in the run log or notes:

```markdown
# <Event Title>

## Summary
<2-4 sentence event description>

## Details
- Date:
- Time:
- Timezone:
- Venue / Online:
- Organizer:
- Capacity:
- Fee:

## Timetable
| Time | Segment | Speaker / Owner | Notes |
|---|---|---|---|
| 18:30 | Doors open |  | Reception |

## Registration Notes
<approval, waitlist, ticket, attendee-only information>
```

For Japanese users, write connpass-facing copy in natural Japanese unless the user asks otherwise. Keep technical terms and speaker names exact.

## Safety Gates

- Luma events are live immediately after creation. Before clicking the final create button, show the user the preflight summary and ask for explicit confirmation.
- For Luma, default to Private/Unlisted visibility before creation unless the user explicitly asked for a Public event.
- If the user asks for a Luma draft only, do not click the final create button. Leave the filled form open when possible, or return the source brief and explain that Luma's normal create flow publishes immediately.
- connpass supports drafts before publication. Prefer creating and filling a draft, then stop before `即時公開する` unless the user explicitly asks to publish.
- Never send invitations, blasts, messages, X posts, external calendar invites, paid-ticket setup, coupons, or API-key based actions without a separate explicit confirmation.
- Treat online join URLs, Wi-Fi details, door codes, and attendee-only instructions as sensitive. Put them only in attendee-only fields when the platform supports that and the user asked for it.
- If mirroring across Luma and connpass, warn about double registration unless the user has specified which platform owns registration or how capacity is split.
- If Luma capacity, tickets, registration questions, or approval appear to be post-creation settings in the live UI, ask whether to create the event Private/Unlisted first, complete those settings, then optionally switch visibility later.

## Browser Workflow

1. Write `plan.md` with critical points: platform, login state, event title, date/time/timezone, location, registration settings, timetable, draft/live state, and final URL.
2. Open the target in a new tab:
   - Luma: `https://luma.com/create`
   - connpass: start from the logged-in connpass home or event management page and use `新規イベント作成` / `イベントを作成する`.
3. Confirm login state. If redirected to login, stop.
4. Fill fields from the source brief using visible labels and role/name selectors where possible. Avoid brittle CSS classes and raw pixel coordinates unless screenshot-driven interaction is the only working path.
5. Capture a screenshot after every critical section: basic info, date/time, location, description/timetable, registration settings, and final preflight.
6. Compare visible fields against the source brief. Fix mismatches before proceeding.
7. Stop at the relevant safety gate and ask for confirmation before any live creation/publish/send action.
8. After creation or publication, capture the final URL and a screenshot of the resulting event page or management page.

## Luma Path

Use the logged-in browser. Fill:

- Calendar/host selection.
- Event title.
- Date, start/end time, timezone.
- Event type: in-person, online, or hybrid.
- Venue or online location.
- Description, with the timetable included as a clearly labeled agenda section.
- Cover image/theme only when the user provides assets or a clear preference.
- Visibility, approval, capacity, ticket type, and waitlist if requested.

Do not assume Luma has a separate timetable object. Unless the visible UI exposes a dedicated schedule/session feature, place the timetable in the rich-text event description.

Before final creation, ask for explicit confirmation because the event becomes live after creation. If the user did not explicitly request Public visibility, set visibility to Private/Unlisted first and report that choice. If any requested registration settings cannot be finalized before creation, call that out in the confirmation request and continue only if the user accepts a Private/Unlisted create-then-configure flow. After creation, return the event URL and note any fields that still need manual review.

## Connpass Path

Use the logged-in browser. Keep a draft by default.

Important connpass details:

- Group selection can be irreversible after setting. Confirm the group before saving it.
- Many fields save when clicking nearby `保存`; some dropdowns save immediately. On an already public event, changes may publish immediately.
- Use Markdown in the event description. Put the timetable as a Markdown table or bullet schedule.
- For online events, use a public venue name like `オンライン`; put private meeting URLs in attendee-only information if they should not be public.
- connpass has no private event feature. Do not promise private visibility.
- connpass event descriptions cannot embed images; use the event image field if an image is required.

Fill or verify:

- Title and subtitle.
- Group.
- Registration method, ticket frames, capacity, fee/payment model.
- Attendee-only information if needed.
- Event image if provided and under platform limits.
- Organizer, managers, speakers, hashtag.
- Description with timetable.
- Start/end date and time, recruitment start/deadline.
- Venue or online event settings.
- Duplicate-participation setting if requested.

Stop before `即時公開する`. If the user confirms publication, enter the public comment only if provided, then click `公開` and verify the public URL.

## Output

Return a concise JSON-like summary plus any human-readable notes:

```json
{
  "status": "draft_created | live_created | published | needs_human | failed",
  "platforms": ["luma", "connpass"],
  "event_urls": {
    "luma": "",
    "connpass": ""
  },
  "title": "",
  "starts_at": "",
  "timezone": "",
  "visibility": "",
  "warnings": [],
  "requires_confirmation": false,
  "evidence_dir": ""
}
```

## Anti-Patterns

- Do not create a Luma event when the user asked for a draft-only workflow.
- Do not publish connpass drafts unless explicitly confirmed.
- Do not put private online meeting links in public description fields unless the user explicitly approves.
- Do not invent timetable times, speakers, prices, capacities, or organizer names.
- Do not leave generated scratch files in the repository. Use `~/.gstack/runs/...` for run evidence unless the user asks for repo-local artifacts.
