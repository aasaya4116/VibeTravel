import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { loadDashboard, readDashboardCache } from "@/lib/data"
import { startOperationTiming } from "@/lib/observability"
import type { DashboardData } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

interface DashboardContextValue {
  data: DashboardData | null
  loading: boolean
  refreshing: boolean
  error: string | null
  ensureLoaded: () => Promise<void>
  refresh: (pullToRefresh?: boolean) => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<DashboardData | null>(null)
  const dataUserIdRef = useRef<string | null>(null)
  const activeUserIdRef = useRef<string | null>(null)
  const revalidatedUserIdRef = useRef<string | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const queuedRefreshRef = useRef<Promise<void> | null>(null)
  const requestVersionRef = useRef(0)

  const currentUserId = user?.id ?? null
  if (activeUserIdRef.current !== currentUserId) {
    activeUserIdRef.current = currentUserId
    revalidatedUserIdRef.current = null
    inFlightRef.current = null
    queuedRefreshRef.current = null
    requestVersionRef.current += 1
  }

  const replaceData = useCallback((next: DashboardData | null) => {
    dataRef.current = next
    dataUserIdRef.current = next ? activeUserIdRef.current : null
    setData(next)
  }, [])

  useEffect(() => {
    setError(null)
    setRefreshing(false)

    if (!user) {
      replaceData(null)
      setLoading(false)
      return
    }

    // Stale-while-revalidate: make the last successful snapshot available
    // synchronously, then let the first dashboard consumer refresh it once.
    const cached = readDashboardCache(user.id)
    replaceData(cached ? { ...cached, offline: false } : null)
    setLoading(!cached)
  }, [replaceData, user?.id])

  const runLoad = useCallback(async (force: boolean, pullToRefresh = false) => {
    if (!user) return
    const userId = user.id

    if (!force && revalidatedUserIdRef.current === userId) return
    if (inFlightRef.current) {
      if (pullToRefresh) setRefreshing(true)
      if (!force) return inFlightRef.current
      if (queuedRefreshRef.current) return queuedRefreshRef.current

      const currentRequest = inFlightRef.current
      const queuedRefresh = (async () => {
        await currentRequest
        if (activeUserIdRef.current !== userId) return
        if (inFlightRef.current === currentRequest) inFlightRef.current = null
        await runLoad(true, pullToRefresh)
      })()
      queuedRefreshRef.current = queuedRefresh
      const clearQueuedRefresh = () => {
        if (queuedRefreshRef.current === queuedRefresh) queuedRefreshRef.current = null
      }
      queuedRefresh.then(clearQueuedRefresh, clearQueuedRefresh)
      return queuedRefresh
    }

    const currentData = dataUserIdRef.current === userId ? dataRef.current : null
    const cached = activeUserIdRef.current === userId
      ? currentData ?? readDashboardCache(userId)
      : readDashboardCache(userId)
    if (cached && !currentData) replaceData({ ...cached, offline: false })

    if (pullToRefresh) setRefreshing(true)
    else if (!cached) setLoading(true)
    setError(null)
    revalidatedUserIdRef.current = userId
    const requestVersion = requestVersionRef.current
    const timing = startOperationTiming("dashboard.load", {
      cache_hit: Boolean(cached),
      offline: false,
      pull_to_refresh: pullToRefresh,
    })

    const request = (async () => {
      try {
        const next = await loadDashboard(user)
        timing.finish({
          cache_hit: Boolean(cached),
          offline: next.offline,
          pull_to_refresh: pullToRefresh,
        })
        if (requestVersionRef.current !== requestVersion || activeUserIdRef.current !== userId) return
        replaceData(next)
        if (next.offline) revalidatedUserIdRef.current = null
      } catch (caught) {
        timing.fail(caught, {
          cache_hit: Boolean(cached),
          offline: false,
          pull_to_refresh: pullToRefresh,
        })
        if (requestVersionRef.current !== requestVersion || activeUserIdRef.current !== userId) return
        setError(caught instanceof Error ? caught.message : "Could not load your trips")
        // A failed attempt may be retried when another screen asks for data.
        revalidatedUserIdRef.current = null
      } finally {
        if (requestVersionRef.current === requestVersion && activeUserIdRef.current === userId) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()

    inFlightRef.current = request
    try {
      await request
    } finally {
      if (inFlightRef.current === request) inFlightRef.current = null
    }
  }, [replaceData, user])

  const ensureLoaded = useCallback(() => runLoad(false), [runLoad])
  const refresh = useCallback((pullToRefresh = false) => runLoad(true, pullToRefresh), [runLoad])

  const visibleData = dataUserIdRef.current === currentUserId ? data : null
  const visibleLoading = loading || Boolean(user && dataUserIdRef.current !== currentUserId && !error)

  const value = useMemo<DashboardContextValue>(() => ({
    data: visibleData,
    loading: visibleLoading,
    refreshing,
    error,
    ensureLoaded,
    refresh,
  }), [ensureLoaded, error, refresh, refreshing, visibleData, visibleLoading])

  return createElement(DashboardContext.Provider, { value }, children)
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) throw new Error("useDashboard must be used within DashboardProvider")

  useEffect(() => {
    void context.ensureLoaded()
  }, [context.ensureLoaded])

  return {
    data: context.data,
    loading: context.loading,
    refreshing: context.refreshing,
    error: context.error,
    refresh: context.refresh,
  }
}
