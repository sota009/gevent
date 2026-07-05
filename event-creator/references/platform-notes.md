# Platform Notes

Verified on 2026-07-05 against public official documentation. Re-check before relying on exact UI labels, because event-product interfaces change often.

## Browser Automation Baseline

- Prefer webwright's `plan.md` and `final_runs/run_<id>/` evidence discipline for reproducible browser work and verification.
- For authenticated Luma or connpass work, use Browser Use CLI or browser-harness against the user's logged-in Chrome session. Do not handle credentials in the skill.
- If the browser is not logged in, stop and ask the user to log in manually.

## Luma

Official sources:

- `https://help.luma.com/p/creating-an-event`
- `https://help.luma.com/p/luma-api`

Creation entry point:

- Website creation starts from `https://luma.com/create` or the `Create Event` button.

Core fields:

- Event title.
- Date, time, timezone, multi-day start/end when relevant.
- Event type: in-person, online, or hybrid.
- Cover image and theme.
- Location: venue/address for in-person, meeting link for online, physical primary address plus online instructions for hybrid.
- Description with rich text, links, bullets, numbered lists, and other formatting.
- Calendar selection.
- Visibility: public, private/unlisted, or member-only where enabled.
- Registration settings: approval, capacity, waitlist, tickets/questions after creation.

Safety behavior:

- Luma's help states the event is created immediately after clicking `Create Event`. Require explicit user confirmation before clicking the final create action.
- When the user has not explicitly requested Public visibility, create as Private/Unlisted first and ask before switching to Public.
- Some registration details may be managed after initial creation. Treat capacity/ticket/approval completion as a confirmation risk if the visible create UI does not expose those fields before the live create action.
- If the user needs API automation, Luma API requires an active Luma Plus subscription on the calendar and a calendar-specific API key. Keep API keys out of prompts and version control.

Timetable handling:

- Public docs describe event descriptions and management tabs but do not establish a universal first-class timetable object in the create flow. Put the agenda/timetable in the event description unless the live UI exposes a dedicated schedule/session feature.

## connpass

Official sources:

- `https://help.connpass.com/organizers/event-detail`
- `https://help.connpass.com/organizers/markdown`
- `https://help.connpass.com/faq/event_organize`
- `https://help.connpass.com/organizers/sub-event-edit`

Creation entry point:

- After login, use the upper-right `新規イベント作成` button or the event management page's `イベントを作成する` button.
- The title dialog asks for the event name, then moves to the event edit page.

Core fields:

- Group.
- Title and subtitle.
- Registration method: accept registrations on connpass or announcement only.
- Participant frame name, capacity, fee/payment model, and additional frames.
- Attendee-only information.
- Attendance code.
- Event image.
- Organizer display name, managers, speakers, hashtag.
- Event description.
- Start/end date and time.
- Recruitment start/deadline.
- Venue or online event setup.
- Duplicate-participation setting.

Safety behavior:

- Fields with a nearby `保存` button save on click. Some dropdown settings save immediately.
- On public events, saved edits may be reflected immediately.
- Group cannot be changed after being set, so confirm it before saving.
- Use drafts by default. Public release requires clicking `即時公開する`, entering a public comment, then clicking `公開`.
- connpass does not provide private event pages. Do not treat a connpass event as private.
- Participants cannot be hidden.
- Mirroring the same event on multiple platforms can double-count registrations. Confirm whether connpass, Luma, or an external tool owns registration before publishing both.

Timetable handling:

- connpass descriptions support Markdown headings, bold/italic, strikethrough, links, lists, code, blockquotes, and tables as Markdown-like content. Put the timetable in the event description as a Markdown section.

Japanese copy conventions:

- Use natural Japanese headings such as `開催概要`, `こんな方におすすめ`, `タイムテーブル`, `参加方法`, `会場`, `注意事項`.
- Keep time in `HH:MM` and include timezone when cross-border attendance is possible.
- For online-only events, make public text say `オンライン開催`; put private meeting URLs in attendee-only information unless the user explicitly wants the URL public.
