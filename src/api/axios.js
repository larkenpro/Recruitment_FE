import axios from 'axios'
import { confirmRevokeOffers } from './offerConflict'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && token !== 'dev-token') {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && err.config?.url !== '/auth/login') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    // The change would undo offers: say whose, and send it again with revokeOffers if they go ahead.
    const data = err.response?.data
    if (data?.errorCode === 'OFFER_CONFLICT' && !err.config?.params?.revokeOffers) {
      return confirmRevokeOffers(data.conflicts ?? []).then((revoke) => {
        if (revoke) return api.request({ ...err.config, params: { ...err.config.params, revokeOffers: true } })
        data.message = 'Not saved — their offers were kept'
        return Promise.reject(err)
      })
    }
    return Promise.reject(err)
  }
)

export default api
