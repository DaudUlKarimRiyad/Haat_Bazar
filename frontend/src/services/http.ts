import { useSyncExternalStore } from "react"

export type UserRole = "admin" | "grower" | "consumer"

export interface Account {
  id: string
  email: string
  name: string
  role: UserRole
  banned: boolean
  ban_reason: string
}
interface Login {
  access_token: string
  session_id: string
  user: Account
}

let session: Login | null = null
const listeners = new Set<() => void>()
export function remember(value: Login | null) {
  session = value
  listeners.forEach(listener => listener())
}
export function updateAccount(user: Account) {
  if (session) remember({ ...session, user })
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useSession() {
  return useSyncExternalStore(subscribe, () => session)
}

async function send(path: string, method: string, body?: unknown, token?: string) {
  const headers = new Headers()
  if (token) headers.set("Authorization", "Bearer " + token)
  if (body !== undefined) headers.set("Content-Type", "application/json")
  return fetch("/api/v1" + path, { method, headers, credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body) })
}

async function error(res: Response) {
  const data = await res.json().catch(() => ({}))
  const detail = data.detail
  const message = Array.isArray(detail) ? detail.map(d => d.loc.at(-1) + ": " + d.msg).join(". ") : detail
  return new Error(message || "Request failed (" + res.status + ")")
}

let restoring: Promise<void> | null = null
export function restore() {
  if (!restoring) {
    const run = async () => {
      const res = await send("/auth/restore", "POST")
      if (!res.ok) throw await error(res)
      remember(await res.json())
    }
    restoring = (navigator.locks ? navigator.locks.request("haat-refresh", run) : run())
      .finally(() => { restoring = null })
  }
  return restoring
}

export async function authenticate(path: "signup" | "login", values: object) {
  const res = await send("/auth/" + path, "POST", values)
  if (!res.ok) throw await error(res)
  remember(await res.json())
}
export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const original = session
  let res = await send(path, method, body, original?.access_token)
  if (res.status === 401 && original) {
    if (original === session) await restore()
    if (session?.session_id === original.session_id) {
      res = await send(path, method, body, session.access_token)
      if (res.status === 401) remember(null)
    }
  }
  if (!res.ok) throw await error(res)
  if (res.status === 204) return undefined as T
  if (res.headers.get("content-type")?.includes("text/csv")) return await res.blob() as T
  return await res.json()
}
