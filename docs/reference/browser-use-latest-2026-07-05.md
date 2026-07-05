# Browser Use Latest Notes (2026-07-05)

Confirmed against official Browser Use documentation and the Browser Use GitHub README on 2026-07-05 JST.

## Sources

- https://github.com/browser-use/browser-use
- https://docs.browser-use.com/open-source/browser-use-cli
- https://docs.browser-use.com/open-source/customize/browser/real-browser
- https://docs.browser-use.com/open-source/customize/browser/authentication
- https://docs.browser-use.com/open-source/customize/browser/all-parameters
- https://docs.browser-use.com/cloud/quickstart
- https://docs.browser-use.com/open-source/browser-use-terminal

## Current doc state

- The local coding-agent path is now the Browser Use CLI: install with `uv tool install browser-use`, use `browser-use --help`, and run Python through `browser-use <<'PY' ... PY`.
- The CLI is described as Browser Harness-backed and supports local Chrome/Chromium, Browser Use cloud browsers, or any CDP endpoint.
- The default local flow attaches to the user's running Chrome/Chromium through CDP and preserves open tabs, cookies, extensions, and logged-in sessions.
- If local connection fails, the docs recommend `browser-use --doctor`; Chrome may require approving remote debugging.
- Open-source Python automation still uses `browser_use` with `Agent`, `Browser`, and model adapters such as `ChatBrowserUse` or `ChatOpenAI`.
- For logged-in desktop sessions in Python, current docs show `Browser.from_system_chrome()` and `Browser.list_chrome_profiles()`.
- `Browser` is the current documented class name for the browser/session layer; older `BrowserSession` or `BrowserProfile` references may still appear in examples and backwards-compatible paths.
- Browser Use Cloud SDK v3 still uses `browser-use-sdk` and `from browser_use_sdk.v3 import AsyncBrowserUse`.
- Cloud quickstart recommends API v3 for managed agents and browser sessions, with `client.run(...)`, `client.sessions.create(...)`, and `client.browsers.create(...)`.
- Browser Use Terminal is a separate terminal runtime and skill surface. It can be useful for Codex-style browser tasks, but it is distinct from the lower-level `browser-use` CLI.

## Difference from 2026-04-20 notes

- The split between Cloud SDK, open-source library, and Browser Harness remains, but the local agent path has moved from "clone/use browser-harness directly" toward the official `browser-use` CLI.
- The CLI docs now explicitly state that local mode attaches to an existing browser session and preserves logged-in state.
- The docs now present `browser-use-terminal` as a distinct Codex-style browser runtime with its own install and skill flow.
- For this repository's Luma/connpass skill, prefer webwright for standardized planning and evidence, then Browser Use CLI or browser-harness for authenticated logged-in browser actions.

## Practical implication for Luma and connpass

- Do not ask for or store Luma/connpass credentials. Reuse the user's logged-in Chrome session.
- Constrain actions to the event platform and observed auth domains.
- Keep final create, publish, invite, blast, paid-ticket, and external posting actions behind explicit user confirmation.
- Return structured output with status, event URLs, date/time/timezone, visibility, warnings, and whether more human action is required.
