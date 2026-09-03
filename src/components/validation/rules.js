// Reusable antd Form.Item `rules` — shared across every form so email/phone
// formats stay consistent and only need updating in one place before a
// request ever reaches the backend.

// Standard phone format: optional leading +, 10-15 digits (E.164-ish, no libphonenumber).
export const PHONE_RULE = { pattern: /^\+?[0-9]{10,15}$/, message: 'Enter a valid phone number' }

export const EMAIL_RULE = { type: 'email', message: 'Enter a valid email' }

// For external links (LinkedIn, GitHub, portfolio, etc). Uses antd's built-in
// URL validator rather than a hand-rolled regex — not domain-specific, so it
// won't reject a github.io page, a linkedin short link, etc.
export const URL_RULE = { type: 'url', message: 'Enter a valid URL' }

export const requiredRule = (message) => ({ required: true, message })

// Works with both InputNumber (numeric value) and plain Input type="number"
// (string value) — coerces before comparing, so it doesn't matter which the
// field uses. Empty/unset is left to a separate requiredRule.
const rangeRule = (min, max, message) => ({
  validator: (_, value) => {
    if (value === undefined || value === null || value === '') return Promise.resolve()
    const num = Number(value)
    if (Number.isNaN(num) || num < min || num > max) return Promise.reject(message)
    return Promise.resolve()
  },
})

export const SCORE_RULE = rangeRule(0, 100, 'Score must be between 0 and 100')
export const CGPA_RULE = rangeRule(0, 10, 'CGPA must be between 0 and 10')
