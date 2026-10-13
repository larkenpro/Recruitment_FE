import axios from 'axios'

// The candidate page talks to /api/v1/portal with its own session token, never the admin axios
// instance — an admin 401 there would bounce a candidate to the admin login.
const P = (path) => `${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/portal${path}`
const SESSION_KEY = 'candidateSession'

export const getCandidateSession = () => sessionStorage.getItem(SESSION_KEY)
export const setCandidateSession = (token) => sessionStorage.setItem(SESSION_KEY, token)
export const clearCandidateSession = () => sessionStorage.removeItem(SESSION_KEY)

const withSession = (config = {}) => ({
  ...config,
  headers: { ...config.headers, 'X-Candidate-Token': getCandidateSession() },
})

export const requestSignInLink = (data) => axios.post(P('/link'), data)
export const createCandidateSession = (linkToken) => axios.post(P('/session'), { token: linkToken })
export const getMyPage = (applyToken) => axios.get(P('/me'), withSession({ params: { apply: applyToken || undefined } }))
export const updateMyProfile = (data) => axios.put(P('/profile'), data, withSession())
export const updateMyApplication = (eventId, data) => axios.put(P(`/applications/${eventId}`), data, withSession())
export const applyToEvent = (data) => axios.post(P('/applications'), data, withSession())
export const uploadMyResume = (file) => {
  const form = new FormData()
  form.append('file', file)
  return axios.post(P('/resume'), form, withSession())
}
