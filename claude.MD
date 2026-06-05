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

## Git & Changes

- Make targeted changes — do not refactor or clean up code outside the scope of the task
- Do not introduce new dependencies unless necessary and discussed
- Never commit secrets, `.env` files, or credentials

---

*Update this file whenever new preferences are confirmed in conversation.*
