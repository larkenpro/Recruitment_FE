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

// whitespace: a value of only spaces doesn't count as filled in.
export const requiredRule = (message) => ({ required: true, whitespace: true, message })

// Plain digits only: no letters, signs or exponents ("1e3", "-2", "8.5abc"). Works with both
// InputNumber (number value) and a text Input (string value). Empty is left to requiredRule.
export const numberRule = ({ min = 0, max = Infinity, decimals = 0, message }) => ({
  validator: (_, value) => {
    if (value === undefined || value === null || String(value).trim() === '') return Promise.resolve()
    const text = String(value).trim()
    if (!/^\d+(\.\d+)?$/.test(text)) return Promise.reject(decimals ? 'Enter a number' : 'Enter a whole number')
    if (decimals === 0 && text.includes('.')) return Promise.reject('Enter a whole number')
    if ((text.split('.')[1] ?? '').length > decimals) return Promise.reject(`Use at most ${decimals} decimal places`)
    const num = Number(text)
    if (num < min || num > max) return Promise.reject(message)
    return Promise.resolve()
  },
})

export const SCORE_RULE = numberRule({ max: 100, decimals: 2, message: 'Must be between 0 and 100' })
export const CGPA_RULE = numberRule({ max: 10, decimals: 2, message: 'CGPA must be between 0 and 10' })
export const COUNT_RULE = numberRule({ message: 'Cannot be negative' })
export const GRADUATION_YEAR_RULE = numberRule({ min: 1980, max: 2100, message: 'Enter a year between 1980 and 2100' })
export const SEQUENCE_RULE = numberRule({ min: 1, message: 'Must be 1 or more' })
