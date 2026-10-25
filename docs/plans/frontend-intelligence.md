# Intelligence frontend

Status: superseded by `identity-and-real-data.md` for data behavior.
The original sample mode has been removed entirely at the user's request.
Visual and browser interaction verification remains pending.

## Outcome and scope

Build the first navigable Phase One frontend in the existing Next.js app, matching
https://fathom-site-one.vercel.app/ (visually inspected 2026-10-25). User-requested
frontend work now precedes backend milestones; their release gates still apply.
Targets CORE-003/007/008/009 and UI preparation for INT-001–009.

Use the reference's warm ivory (#f8f7f2), dark olive ink (#20241e), cobalt accents,
Instrument Serif / DM Sans, fine rules, restrained corners, editorial headings,
and diagram-like graphics. Adapt these to a responsive app, not a landing page.

Include overview, AI visibility, opportunities with evidence and local workflow,
catalogue/knowledge, website diagnostics, connections, and report preview.
Support a clearly labeled sample workspace plus unconnected empty states.
No fabricated authentication, OAuth, live observations, publishing, or billing.
Sample opportunity interactions are local and reset on leaving the page; never imply durable backend work.

## Ordered implementation

1. Inspect reference typography, colors, composition, and current application.
2. Establish reusable tokens, shell, icons, route navigation, and fixture contracts.
3. Build overview and focused intelligence views with functional filters, evidence
   dialogs, local opportunity states, connection details, and sample report export.
4. Verify desktop/mobile layout, keyboard/dialog behavior, navigation and filtering.
5. Run formatter, lint, type checks, production build; record remaining boundaries.

## Acceptance and failure cases

- The application visually belongs to the reference brand.
- Every navigation item resolves; interactive controls have an observable result.
- All sample metrics and exports remain labeled; missing data is unavailable, not 0.
- Evidence exposes method, date, sample, and source; visibility discloses denominator.
- Dialogs support Escape, close buttons, focus trapping and focus restoration.
- Small screens have usable navigation and no unintended document overflow.
- Empty search/filter states explain recovery; connector cards do not simulate OAuth.

## Verification

- Reference website visually inspected in Chrome; font families and colors read
  from its computed styles. Font files self-hosted with their OFL licenses.
- `npm run format`, `npm run lint`, `npm run typecheck`, and `npm run build`
  passed. Next.js generated all eight workspace routes plus health/not-found.
- Source review covers native modal focus behavior, Escape dismissal, return
  focus, mobile navigation focus containment, reduced motion, semantic labels,
  responsive breakpoints, and explicit sample/empty states.
- Browser access to `http://127.0.0.1:3000` was explicitly denied by the browser
  permission policy. No workaround was attempted. Rendered layouts, interaction
  flows, export download, and mobile overflow are NOT browser-verified.
- Backend milestones remain unimplemented. No authentication, provider access,
  persistence, publication, deployment, or Git commit is claimed.

## Remaining visual acceptance

Once local browser access is permitted, review overview at desktop and mobile
sizes; navigate every route; filter opportunities and catalogue; inspect evidence;
assign/dismiss/reopen an item; switch workspace modes; test keyboard and Escape;
filter providers; inspect connection requirements; download the sample report.
Check focus restoration and document overflow at 390px, 768px, and 1440px.
