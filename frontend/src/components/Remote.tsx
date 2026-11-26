import { useEffect, useState } from "react"
import { request } from "../services/http"

export function useRemote<T>(path: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ key: string, data?: T, error?: string }>({ key: "" })
  const key = path + "#" + revision
  useEffect(() => {
    if (!path) return
    let active = true
    request<T>(path).then(data => { if (active) setState({ key, data }) })
      .catch(err => { if (active) setState({ key, error: err.message }) })
    return () => { active = false }
  }, [key, path])
  return { data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined, reload: () => setRevision(n => n + 1) }
}
export function Feedback({error, loading}: {error?: string, loading?: boolean}) {
  if (error) return <p role="alert">{error}</p>
  if (loading) return <p role="status">Loading…</p>
  return null
}
export function useAction() {
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function run(work: () => Promise<void>) {
    setError("")
    setBusy(true)
    try { await work() }
    catch (err) { setError(err instanceof Error ? err.message : "Request failed.") }
    finally { setBusy(false) }
  }
  return { error, busy, run }
}
