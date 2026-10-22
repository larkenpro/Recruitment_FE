import { useQuery } from '@tanstack/react-query'
import { getDefaults } from '../api/defaults'

/** The Templates & Defaults page's values (cached; refreshed when that page saves). */
export function useDefaults() {
  return useQuery({ queryKey: ['defaults'], queryFn: () => getDefaults().then((r) => r.data.data), staleTime: 60_000 })
}
