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

Providers wrap in this order: `ConfigProvider` (Ant Design theme) → `QueryClientProvider` → `AuthProvider` → `BrowserRouter`.

Routes:
- `/login` — public, no layout
- `/apply/:token` — public, no layout, candidate application form
- `/` — redirects to `/colleges`
- `/colleges`, `/events`, `/positions`, `/candidates`, `/candidates/:id`, `/analytics` — all protected; wrapped in `ProtectedRoute` + `AppLayout`

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
- Nav menu: Colleges, Events, Positions, Candidates, Analytics
- Logout button pinned to bottom

Top `Header` shows notification bell (count=0 placeholder) + logged-in username. `Content` area renders the active page.

---

## Shared Patterns Across All List Pages

Every list page (Colleges, Events, Positions, Candidates) follows the same structure:

1. **Data fetch** via `useQuery` → TanStack React Query
2. **Column filtering** via `useColumnFilter` hook + `FilterBar` component
3. **Mutations** via `useMutation`; on success, `queryClient.invalidateQueries` to refresh the list
4. **Add/Edit** via Ant Design `Modal` + `Form`; `editingCollege` / `editing` state drives create vs. update in one modal

### `useColumnFilter` hook (`src/hooks/useColumnFilter.js`)
Takes `data` (array) and `filterKeys` config. Each key has `{ key, label, getVal, type? }`:
- No `type` → dropdown, exact string match
- `type: 'min'` → numeric, row value ≥ filter
- `type: 'max'` → numeric, row value ≤ filter

Returns `{ filteredData, filters, setFilter, removeFilter, optionMap }`.

### `FilterBar` component (`src/components/FilterBar.jsx`)
Renders dropdowns (or number inputs for min/max) from `optionMap`. Active filters shown as removable tags.

---

## Pages

### Colleges (`src/pages/Colleges.jsx`)
- Lists colleges with City / State / Tier columns.
- Add and Edit via modal (no delete).
- Filter keys: city, state, tier.
- API: `getColleges`, `createCollege`, `updateCollege` from `src/api/colleges.js`.

### Events (`src/pages/Events.jsx`)
- Lists recruitment events. Each event belongs to a college and year.
- Status can be changed inline via a `Select` in the table (UPCOMING → ACTIVE → COMPLETED / CANCELLED).
- **Generate Link** button (only enabled when status = ACTIVE) calls `generateLink(eventId)` → returns a tokenized URL. The URL is stored in local `links` state and a Copy button appears.
- Four action modals per event row:
  - **Rounds modal** — lists existing rounds, add new round (name, type, sequence).
  - **Positions modal** — lists linked positions with remove (Popconfirm), add more via multi-select.
  - **Candidates modal** — table of candidates who applied; clicking a name navigates to `CandidateDetail`.
- Create Event modal includes position multi-select at creation time.
- Filter keys: college name, year, status.
- API: `src/api/events.js` — `getEvents`, `createEvent`, `updateEventStatus`, `generateLink`, `getRounds`, `createRound`, `getEventPositions`, `addEventPositions`, `removeEventPosition`, `getCandidatesByEvent`.

### Positions (`src/pages/Positions.jsx`)
- CRUD for job positions (title, department, type: Full-Time / Part-Time / Internship / Contract).
- Delete with Popconfirm.
- Filter keys: department, type.
- API: `src/api/positions.js` — `getPositions`, `createPosition`, `updatePosition`, `deletePosition`.

### Candidates (`src/pages/Candidates.jsx`)
- Lists all candidates. Name cell is a link to `CandidateDetail`.
- Edit modal: full candidate form (personal, academic, role preferences).
  - On open, fetches full candidate record + their event's positions, merges preferred positions (already ranked) with remaining event positions to build an ordered drag list.
  - Role preferences are reordered with up/down arrow buttons; saved as `preferredPositionIds` (ordered array).
- Filter keys: college, branch, ugCgpa (min), backlogs (max).
- API: `getCandidates`, `getCandidate`, `getCandidateEvent`, `updateCandidate`, `deleteCandidate` + `getEventPositions`.

### CandidateDetail (`src/pages/CandidateDetail.jsx`)
The most complex page. Displays a 3-column top row + two tabbed sections.

**Top row cards:**
1. Profile card — avatar initial, name, college, contact details
2. Pipeline Status card — current stage + `Steps` progress through `PIPELINE_STAGES`; if candidate has multiple events, a `Select` switches between them
3. Academic Snapshot card — CGPA, marks, backlogs statistics

**Pipeline stages (ordered):** Resume → Rounds → Offer → Joining → 6 Month Review → 12 Month Retained → Exit

**Candidate Information tabs:**
- Personal Info — `Descriptions` table
- Academic — `Descriptions` table
- Preferences — ranked preferred positions list (editable via up/down arrows)

**Recruitment Pipeline tabs** (tabs are added dynamically — only visible if that stage has been reached):
- **Resume** — shows uploaded resume with download button; "Begin Resume Review" triggers stage start; decision radio (SHORTLISTED / HOLD / REJECTED)
- **Rounds** — per-round cards (locked if previous round wasn't passed); each has score, result, interviewer, comments; Edit Score modal
- **Offer / Joining / 6 Month Review / 12 Month Retained** — placeholder + decision radio
- **Exit** — create/edit/delete exit record (exit date + reason)
- **Stage History** — `Timeline` of all stage transitions across all events

**Stage decision logic:**
- `stageDecision(stageName)` renders decision controls only for the current active stage; completed stages show a static tag.
- Setting status to SHORTLISTED auto-advances to the next stage via `addStageEntry`.

API calls in this page: `getCandidate`, `getCandidateResume`, `getCandidateRoundResults`, `getCandidateStageHistory`, `getCandidateEvent`, `getEventPositions`, `getExitRecord`, `updateCandidate`, `updateRoundResult`, `addStageEntry`, `updateStageStatus`, `createExitRecord`, `updateExitRecord`, `deleteExitRecord`.

### PublicApply (`src/pages/PublicApply.jsx`)
Token-based public form — no auth required.

- On load, validates the token via `getApplyForm(token)` (plain axios, no auth header) → gets event info; also fetches event positions for the preference ranking UI.
- 3-step wizard (Ant Design `Steps`): Personal Info → Academic Details → Preferences.
- Step navigation via state (`step` 0/1/2); steps are shown/hidden with `display` style (all in one `Form` so validation state is preserved).
- Position preference ranking: same up/down arrow UI as Candidates page; ranked order is sent as `preferredPositionIds[]`.
- Resume upload: file held in `resumeFile` state; submitted as `multipart/form-data` via `submitApplication`.
- "Fill Test Data" button (development aid) pre-fills the form with random Indian names/data.
- On success: shows Ant Design `Result` success screen.
- Invalid/expired token: shows `Result` error screen.

### Analytics (`src/pages/Analytics.jsx`)
- Reads from the shared `['candidates']` query key (same cache as Candidates page).
- Passes data through `computeAnalytics` (`src/utils/analyticsHelpers.js`) via `useMemo`.
- Displays: total candidates, avg UG CGPA, avg 10th mark, active/total backlog counts.
- Charts (Recharts): candidates by branch (horizontal bar), position preferences (horizontal bar), candidates by college (horizontal bar), job location preference (pie chart).

---

## API Layer (`src/api/`)

| File | Base | Key exports |
|---|---|---|
| `axios.js` | `VITE_API_BASE_URL` | Default axios instance with auth interceptor |
| `candidates.js` | mix | All candidate CRUD + stages + resume + exit + public apply |
| `colleges.js` | authenticated | `getColleges`, `createCollege`, `updateCollege` |
| `events.js` | authenticated | Events CRUD + rounds + positions + link generation |
| `positions.js` | authenticated | `getPositions`, `createPosition`, `updatePosition`, `deletePosition` |
| `stages.js` | authenticated | Stage-related helpers (if separate) |

Public endpoints in `candidates.js` use plain `axios` directly (not the instance) to bypass the auth interceptor.
