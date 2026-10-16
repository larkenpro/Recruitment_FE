# Claude Code — Project Preferences & Coding Standards

This file stores coding practice preferences for this project. Claude must read and apply everything here before generating any code.

---

## Purpose

Use this file as a persistent reference for all coding decisions in this project. Update it whenever new preferences are established or existing ones change.

---

## General Coding Principles

- Write clean, readable, maintainable code — clarity over cleverness
- Follow existing patterns and conventions already in the codebase before introducing new ones
- Keep components and functions small and focused on a single responsibility
- Avoid over-engineering; solve the problem at hand, not hypothetical future ones
- No unnecessary abstractions, helpers, or wrappers unless reuse is certain

## Comments & Documentation

- Default to no comments — well-named identifiers should speak for themselves
- Only add a comment when the **why** is non-obvious (a workaround, a subtle invariant, a hidden constraint)
- No multi-line comment blocks or explanatory docstrings
- No comments referencing the task, ticket, or caller ("added for X flow", "used by Y")

## TypeScript / JavaScript

- Use TypeScript strictly — avoid `any`; prefer explicit types
- Use functional components and hooks in React; avoid class components
- Prefer `const` over `let`; never use `var`
- Destructure props and objects where it improves clarity
- Keep imports organized: third-party libs first, then internal modules

## React & Frontend

- Use existing UI component library/design system components before building new ones
- Keep state local unless it genuinely needs to be shared
- Avoid prop-drilling more than two levels deep — lift state or use context appropriately
- Do not add loading/error states for scenarios that cannot realistically happen

## Styling

- Follow the existing styling approach used in the project (check surrounding files first)
- Do not mix styling strategies (e.g., don't introduce inline styles if CSS modules or Tailwind is in use)

## Error Handling

- Only validate and handle errors at system boundaries (user input, API calls)
- Do not add defensive error handling for internal code paths that can't fail
- Trust framework and library guarantees

## Testing

- **Always write or update tests when implementing or modifying a feature** — this is non-negotiable
- Place tests under `src/tests/` mirroring the source structure (e.g. `src/tests/api/candidates.test.js` for `src/api/candidates.js`)
- For API modules: test the happy path and the key error cases (4xx, network failure)
- For utility functions: test all branches (e.g. each `errorCode` path in `getErrorMessage`)
- For React components/pages: test user-visible behaviour, not implementation details
- Follow the existing test patterns in `src/tests/` before introducing new ones
- Run the test suite after every change to confirm nothing regressed

## Git & Changes

- Make targeted changes — do not refactor or clean up code outside the scope of the task
- Do not introduce new dependencies unless necessary and discussed
- Never commit secrets, `.env` files, or credentials

## Backend Design / API Shape Changes

When a requested feature changes the backend design and the shape of the API output, work through every step below. This spans both repos: `recruitment/` (backend) and `Recruitment_FE/` (frontend).

0. **Make the change.** e.g. `{ name, roll }` becomes `{ first_name, last_name, roll_no }`.
1. **Backend dependents.** Check every other table, entity, DTO and service that depends on the changed table, and update them too. e.g. reports that showed `name` now show `first_name + last_name`.
2. **Tests.** Write or update tests for steps 0 and 1. Remove any stale tests that relied on the old data shape.
3. **Frontend dependents.** Track down every component that uses data from steps 0 and 1, and update it to read and display the new shape. e.g. tables that showed `name` now show `first_name + last_name`, and anything reading `roll` now expects `roll_no`.

---

*Update this file whenever new preferences are confirmed in conversation.*

---

## Application Overview

Campus recruitment management system for J&J Sourcing. Admins manage colleges, events, positions, and candidates through a protected dashboard. Candidates apply via a public token-based form.

**Tech stack:** React (Vite) + JSX · Ant Design (antd) · @tanstack/react-query · React Router v6 · Axios

**Two API base URLs (set via env vars):**
- `VITE_API_BASE_URL` — authenticated endpoints, used by the axios instance in `src/api/axios.js`
- `VITE_PUBLIC_API_URL` — public endpoints (apply form, resume download), called with plain `axios` (no auth header)

---

## App Entry & Routing (`src/App.jsx`)

Providers wrap in this order: `ConfigProvider` (Ant Design theme; `modal={MODAL_DEFAULTS}` centres every Modal and scrolls a tall one's body inside the window — `Modal.confirm` calls pass `centered: true` themselves, as static calls don't read it) → `QueryClientProvider` → `AuthProvider` → `BrowserRouter`.

Routes:
- `/login` — public, no layout
- `/apply/:token` — public, no layout, candidate application form
- `/candidate` — public, no layout, the candidate's own page (sign in by emailed link)
- `/` — redirects to `/colleges`
- `/colleges`, `/colleges/:id`, `/events`, `/positions`, `/offers`, `/candidates/:id`, `/analytics` — all protected; wrapped in `ProtectedRoute` + `AppLayout`

The `P` shorthand component (`<ProtectedRoute><AppLayout>{children}</AppLayout></ProtectedRoute>`) is used inline on every protected route.

---

## Auth Flow (`src/context/AuthContext.jsx`, `src/routes/ProtectedRoute.jsx`)

- `AuthProvider` stores `token` and `user` in state; `token` is seeded from `localStorage` on load (defaults to `'dev-token'` if nothing stored).
- `loginUser(data)` saves the token to `localStorage` and updates state.
- `logout()` removes the token from `localStorage` and nulls state.
- `ProtectedRoute` checks `token`: if falsy, redirects to `/login`.
- The axios instance (`src/api/axios.js`) reads `localStorage` on every request and attaches `Authorization: Bearer <token>` — except for `dev-token`, which is sent without a header. On a 401 response, it clears the token and redirects to `/login`.

---

## Layout (`src/components/Layout.jsx`)

Fixed left sidebar (`Sider`, 220px) with:
- "JJ Recruit" brand logo
- Nav menu: Colleges, Positions, Events, Offers, Import, Analytics, User Management, Audit Log (no candidate list: `/candidates/:id` is reached from event and offer rows)
- Logout button pinned to bottom

Top `Header` shows notification bell (count=0 placeholder) + logged-in username. `Content` area renders the active page.

---

## Dates

Every date is shown as **DD/MM/YYYY** (date-times `DD/MM/YYYY HH:mm`; the audit log keeps seconds): `formatDate` / `formatDateTime` and `DATE_FORMAT` in `utils/dates.js`. Date pickers pass `format={DATE_FORMAT}` and send `YYYY-MM-DD` to the API; no native `<input type="date">` (its display follows the browser's locale). Month-only pickers (internship availability) stay "MMMM YYYY". New events (Create Event, and Import's new-event form) start dated today; the event page's "Accepts applications until" defaults to two months after the event's start date, or two months from today when there's no start date or that day has passed (`defaultLinkExpiry`).

## Shared Patterns Across All List Pages

Every list page (Colleges, Events, Positions, Offers) follows the same structure:

1. **Data fetch** via `useQuery` → TanStack React Query
2. **Column filtering** via `useColumnFilter` hook + `FilterBar` component
3. **Mutations** via `useMutation`; on success, `queryClient.invalidateQueries` to refresh the list
4. **Add/Edit** via Ant Design `Modal` + `Form`; `editingCollege` / `editing` state drives create vs. update in one modal

### `useColumnFilter` hook (`src/hooks/useColumnFilter.js`)
Takes `data` (array) and `filterKeys` config. Each key has `{ key, label, getVal, type? }`:
- No `type` → dropdown, exact string match
- `type: 'multi'` → multi-select dropdown, row matches any chosen value (none chosen = no filter)
- `type: 'min'` → numeric, row value ≥ filter
- `type: 'max'` → numeric, row value ≤ filter

An optional third argument sets the starting filters. Returns `{ filteredData, filters, setFilter, removeFilter, optionMap }`; `rowMatches` is the exported predicate.

### `FilterBar` component (`src/components/FilterBar.jsx`)
Renders dropdowns (or number inputs for min/max) from `optionMap`. Active filters shown as removable tags.

---

## Pages

### Colleges (`src/pages/Colleges.jsx`)
- Lists colleges with City / State / Tier / Status columns and a contacts count.
- Contacts modal edits the ordered `contacts` list (name, designation, email, phone) and saves it with `updateCollege`.
- Add and Edit via modal (no delete).
- Filter keys: city, state, tier.
- API: `getColleges`, `createCollege`, `updateCollege` from `src/api/colleges.js`.
- The name links to the college's detail page. Tier/status colours live in `utils/colleges.js`.

### CollegeDetail (`src/pages/CollegeDetail.jsx`, `/colleges/:id`)
- Laid out like EventDetail: college card (tier/status), summary (events, applicants, offers — summed from the event list), contacts card, then every event held there, newest first (upcoming included) with mode, status, positions with their types, applicant and offer counts.
- The year links to `/events/:id` only for users with the EVENTS page. Unknown id → "College not found".
- API: `getCollege`, `getCollegeEvents`.

### Events (`src/pages/Events.jsx`)
- Lists recruitment events. Each event belongs to a college and year.
- Status can be changed inline via a `Select` in the table (UPCOMING → ACTIVE → COMPLETED / CANCELLED).
- **Generate Link** button (only enabled when status = ACTIVE) calls `generateLink(eventId)` → returns a tokenized URL. The URL is stored in local `links` state and a Copy button appears.
- Four action modals per event row:
  - **Positions modal** — lists linked positions with remove (Popconfirm), add more via multi-select.
  - **Candidates modal** — table of candidates who applied; clicking a name navigates to `CandidateDetail`.
- Create Event has no Year field: `recruitmentYear` (the year events are named by, e.g. "IIT Madras 2026") is the required Start Date's year, which defaults to today. Import's new-event form does the same.
- Create Event modal includes the mode (On-campus / Virtual / Hybrid, default On-campus; `utils/eventModes.js`) and position multi-select at creation time. The list shows a Mode column; EventDetail changes it via `updateEventMode`.
- Filter keys: college name, year, status, mode.
- API: `src/api/events.js` — `getEvents`, `createEvent`, `updateEventStatus`, `generateLink`, `getEventPositions`, `addEventPositions`, `removeEventPosition`, `getCandidatesByEvent`.

### EventDetail pipeline (`components/PipelineGraph.jsx`, `components/RoundGraphEditor.jsx`, `utils/roundGraph.js`)
- The **Pipeline** card is one React Flow (`@xyflow/react`) graph with a View / Edit rounds switch; it replaced the Pipeline Stages tabs and the Event Details Rounds and Groups tabs (Event Details keeps Positions).
- **View** (default, read-only): Resume → one node per (position, type) pair the event hires for → the rounds → Offer (`pipelineLayout`; only pair and round arrows are stored). The event page stops at Offer: Joining is handled on the Offers page. Nodes show counts (applicants at Resume, "N pending, N passed, N failed" on each round — pending is open or on hold — and everyone at Offer). Clicking Resume, a round or a later stage lists its candidates under the graph (`selectedStage`): the Resume table, the round's scoring table (status filter, default every status: everyone who reached the round), or the later stage's table. Every stage table (Resume, each round, Offer) and the Offers page also has **Download Excel** (`components/DownloadExcel`, `api/exports.js` → `POST /api/v1/exports/xlsx`): the table as laid out — shown columns in order, every filtered row (all pages), cells as displayed via each column's `exportValue` (labels like WaitList, not codes) or `dataIndex` (`tableToSheet` in `utils/columns.js`); button-only columns (Resume view, Details) are `noExport`; a GD round with groups adds a Group column first. File and sheet are named `<College Year> - <stage>` / `Offers`. Every stage table also has a **Columns** button (`components/ColumnPicker`, `useColumnChoice`; order helpers in `utils/columns.js`) to choose its visible columns and their order — drag a header, or a row of the list, and it lands before or after the target wherever the accent line shows (native drag and drop; the list's handle also moves it with the up/down arrow keys); a newly shown column goes last — remembered per browser in localStorage `tableColumns.v3` by table as `{ shown, seen }` — `seen` is every column the table had when saved, so a default column added later still appears for people with a saved layout (`resolveChoice`) (`stage:Resume`, `round:<id>`, `stage:Offer`). Round tables lead with **Round Decision** (the round's Pass / Fail / On Hold) and default to Round Decision, Name, Roll No, Score, a score column per earlier round (`roundsBefore`: every round with arrows into this one), Interviewer; the candidate fields, Comments and — on a last round — **Overall Rounds Decision** (the Rounds stage decision) are off by default. The candidate fields (Name, Roll No, Email, Phone, Branch, Batch, UG CGPA, Preferences, Backlogs, Resume view, Details edit) are one shared set from `useCandidateColumns` (`components/CandidateColumns.jsx`, which also owns the resume viewer and the application editor their buttons open, and `addCandidate`), offered in every stage table and on the Offers page. The Resume table leads with **Decision** (the Resume shortlist decision) and defaults to Decision, Name, Roll No, Branch, UG CGPA, Backlogs, Resume (view); Email, Phone, Batch, Preferences and Details (edit) are off by default. The Offer table leads with **Offer Status** (the Offer decision) and defaults to Offer Status, **Offer Response**, Name, Roll No, Branch, Offered position. Offer Response (`OfferResponseCell`) is whether a Shortlisted candidate took the offer — Accepted / Rejected / No Information — stored in the offer record's `status` (`utils/offers.js`; null = No Information) and saved on pick; other rows show —. The Offer table has the same **Offered position** dropdown as the Offers page (`OfferedPositionCell`), shown only to users with the CANDIDATES page since offer records live under `/api/v1/candidates`. Pair nodes aren't clickable.
- A **Group Discussion** round's panel has Scores and Groups tabs. Groups belong to that round (`getGroups(eventId, roundId)` etc.): generate a number of random groups from the candidates who reached it, drag members between groups, rename / set a topic. Each GD round's groups are separate.
- **Edit rounds**: drag from a pair to the round its candidates start at, and from a round to the round passing it unlocks; candidates take every round reachable from their pairs. Add round / select + Delete / **Clear arrows** (removes every arrow, to redraw from scratch); the side panel edits the selected round's name and type. Arrows into a pair or that would close a loop are refused while dragging (`createsCycle`). Nothing is stored until **Save rounds**, which sends the whole canvas (`saveRoundGraph`; new rounds carry a temporary `key`, pair arrows start from `pair:<positionId>:<typeId>`); **Discard changes** reverts to the saved graph, and leaving Edit with unsaved changes asks first. Removing a round that has results asks first. **Default template** (no rounds yet) lays out GD → Interview → HR with every pair starting at GD.
- Who has reached which round comes from the backend (`getRoundProgress`; statuses `NOT_APPLICABLE`/`LOCKED`/`OPEN`/`PASS`/`FAIL`/`ON_HOLD`). Recording a result moves the Rounds stage on the backend; no follow-up stage call. Rounds with no arrow out show the manual Rounds Decision column.
- API: `getRoundGraph`, `saveRoundGraph`, `getRoundProgress`, `getEventRoundResults`.

### EventDetail admin entry (`components/EventApplicationModal.jsx`)
- Resume tab: **Add Candidate** opens the modal (contact details, academic details, preference ranker over the event's open pairs, required admin consent checkbox) → `addEventApplication`. A 409 means they already applied.
- Each row's **Edit** opens the same modal pre-filled from that application (email read-only, no consent) → `updateEventApplication`.

### Positions (`src/pages/Positions.jsx`)
- CRUD for job positions (title, department, job description — required, sent to colleges in automated emails; the table flags positions without one as "Missing"). One row per title — the type (Internship / FTE / Intern-to-FTE) is chosen per event on EventDetail, not here.
- Delete with Popconfirm.
- JD PDF column: Upload / Replace (PDF only), the file name opens it in a new tab (fetched as a blob — the endpoint needs the JWT), and a remove button.
- Filter keys: department.
- API: `src/api/positions.js` — `getPositions`, `createPosition`, `updatePosition`, `deletePosition`, `uploadPositionJd`, `getPositionJd`, `deletePositionJd`.

### Offers (`src/pages/Offers.jsx`, `/offers`, CANDIDATES page)
- Everyone who reached the Offer stage, whatever its decision, across all colleges and events (`getOffers` → `GET /api/v1/candidates/offers`), one row per (event, candidate): college, event year (links to the event with the EVENTS page), branch, batch, an **Offered position** dropdown (`OfferedPositionCell` in `components/OfferPairSelect`: every pair the event hires for, the candidate's preference rank beside each — `-` if unranked — ranked first; saving resends the rest of the offer since the PUT replaces it), with **Offer Status** first (the Offer decision — Shortlisted / WaitList / Rejected — pinned left with Name) and a Joining decision select once reached — `useStageDecision`, so Shortlisted at Offer opens Joining.
- Configurable like the event page's Offer table (`useColumnChoice`, table key `offers`): the same columns and defaults (Offer Status, Offer Response, Name, Roll No, Branch, Offered position), plus College, Event and Joining, off by default.
- Filter keys: name, college, branch, batch, current stage, Offer Status — a multi-select (`type: 'multi'`) that starts at Shortlisted + WaitList (`useColumnFilter`'s `initialFilters`); clearing it shows everyone at Offer, undecided included.

### CandidateDetail (`src/pages/CandidateDetail.jsx`)
The most complex page. Displays a 3-column top row + two tabbed sections.

**Top row cards:**
1. Profile card — avatar initial, name, college, contact details
2. Pipeline Status card — current stage + `Steps` progress through `PIPELINE_STAGES`; if candidate has multiple events, a `Select` switches between them
3. Academic Snapshot card — CGPA, marks, backlogs **as submitted for the selected event** (falls back to the profile when there's no application)

**Pipeline stages (ordered):** Resume → Rounds → Offer → Joining (`PIPELINE_STAGES` in `hooks/useStageDecision.js`; the app stops at Joining — the backend still accepts 6 Month Review / 12 Month Retained / Exit, but nothing in the UI reads or starts them)

**Candidate Information tabs:**
- Personal Info — `Descriptions` table
- Academic — `Descriptions` table
- Personal Info / Academic / Preferences read the selected event's application (`getCandidateApplications`); Preferences are reordered/removed and saved via `updateCandidateApplication`. The Offer form's Offered Position uses the same `OfferPairSelect` as the Offers page (the event's pairs, with this application's ranks), and its Offer Response the same Accepted / Rejected / No Information choices.

**Recruitment Pipeline tabs** (tabs are added dynamically — only visible if that stage has been reached):
- **Resume** — shows uploaded resume with download button; "Begin Resume Review" triggers stage start; decision radio (SHORTLISTED / HOLD / REJECTED)
- **Rounds** — per-round cards in graph order (`order`), locked when the API says `LOCKED`, rounds on another position's track (`NOT_APPLICABLE`) hidden; each has score, result, interviewer, comments; Edit Score modal
- **Offer** — offer form + decision radio; **Joining** — placeholder + decision radio
- **Stage History** — `Timeline` of all stage transitions across all events

**Stage decision logic:**
- `stageDecision(stageName)` renders decision controls only for the current active stage; completed stages show a static tag.
- Setting status to SHORTLISTED auto-advances to the next stage via `addStageEntry`.

API calls in this page: `getCandidate`, `getCandidateApplications`, `updateCandidateApplication`, `getCandidateResume`, `getCandidateRoundResults`, `getCandidateStageHistory`, `updateRoundResult`, `addStageEntry`, `updateStageStatus`, `getOffer`, `upsertOffer`, `getEventPositions`.

### PublicApply (`src/pages/PublicApply.jsx`)
Token-based public form — no auth required. **Only for new candidates.**

- On load, validates the token via `getApplyForm(token)` and fetches the event's (position, type) pairs with `getPublicEventPositions` (plain axios).
- 3-step wizard: Personal Info → Academic Details (`components/AcademicFields`, including the required Year of Graduation / batch) → Preferences (`components/PreferenceRanker`: tick pairs and rank them; sent as `preferences[]` = `"positionId:typeId"`).
- Leaving step 0 calls `checkApplication(token, { email, rollNo })`. If they're already a candidate, a modal says "A candidate with this email/roll number already exists" with **[Cancel]** / **[Send me a link]** — the link goes to the masked email on file (`requestSignInLink`) and leads to the candidate page. A 409 from submit shows the same modal.
- At least one pair must be ticked: a submit without one (even if other fields also fail) shows "Tick at least one position you want to apply for." under the ranker and scrolls to it; it clears once one is ticked.
- The GitHub Link field only shows once the candidate ticks a position in the **IT** department (`hasItPosition` in `utils/preferences.js`, case/space-insensitive; department is free text, so "Information Technology" doesn't count). The admin modal and the candidate profile always show it.
- Internship Availability likewise only shows once a ticked pair's type is Internship or Intern-to-FTE (`hasInternship`), here and in the candidate page's apply/edit form; unticking drops the value (`preserve={false}`), so the application saves none. The admin modal always shows it.
- Form values go through `academicPayload` (`utils/academic.js`) before submit.
- `components/ConsentField` (required checkbox: information may be used for recruitment) sits above Submit; the candidate page's "Apply to …" form uses it too. CandidateDetail shows when consent was given.
- "Fill Test Data" buttons are `DevOnly`.

### CandidatePortal (`src/pages/CandidatePortal.jsx`)
The candidate's own page at `/candidate?token=…&apply=…`.

- `?token=` (from the emailed link) is swapped for a session token (`createCandidateSession`), kept in `sessionStorage` and stripped from the URL. No session → email box that asks for a sign-in link. A 401 signs them out.
- Shows: **Apply to {event}** when the link carried an apply token for an event they haven't applied to (pre-filled from the profile); one card per application — editable while the event is ACTIVE, read-only otherwise; contact details; resume upload.
- API: `src/api/portal.js` — plain axios + `X-Candidate-Token`, never the admin instance.

### Analytics (`src/pages/Analytics.jsx`)
- Reads from the shared `['candidates']` query key (same cache as Candidates page).
- Passes data through `computeAnalytics` (`src/utils/analyticsHelpers.js`) via `useMemo`.
- Displays: total candidates, avg UG CGPA, avg 10th mark, active/total backlog counts.
- Charts (Recharts): candidates by branch (horizontal bar), position preferences (horizontal bar), candidates by college (horizontal bar), job location preference (pie chart).
- The position preference table is fed from `getAllApplications` (`/analytics/applications`), since preferences belong to applications.

---

## API Layer (`src/api/`)

| File | Base | Key exports |
|---|---|---|
| `axios.js` | `VITE_API_BASE_URL` | Default axios instance with auth interceptor |
| `candidates.js` | mix | All candidate CRUD + per-event applications + stages + resume + exit + public apply/check |
| `portal.js` | public + candidate session | Candidate page: sign-in link, session, own page, profile/application edits, resume |
| `colleges.js` | authenticated | `getColleges`, `getCollege`, `getCollegeEvents`, `createCollege`, `updateCollege` |
| `events.js` | authenticated | Events CRUD + rounds + positions + link generation |
| `positions.js` | authenticated | `getPositions`, `createPosition`, `updatePosition`, `deletePosition`, `uploadPositionJd`, `getPositionJd`, `deletePositionJd` |

Public endpoints in `candidates.js` use plain `axios` directly (not the instance) to bypass the auth interceptor.
