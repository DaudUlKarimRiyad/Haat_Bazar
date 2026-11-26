import { useState } from "react"
import { Navigate, useLocation } from "react-router"
import { authenticate, remember, request, updateAccount, useSession, type Account } from "../services/http"
import { Feedback, useAction, useRemote } from "../components/Remote"

export interface Device { id: string, browser: string, ip: string, created: number, expires: number, revoked: boolean }
export const when = (seconds: number) => new Date(seconds * 1000).toLocaleString()

export function SignIn() {
  const [signup, setSignup] = useState(false)
  const action = useAction()
  const session = useSession()
  const location = useLocation()
  if (session) return <Navigate replace to={location.state?.from || "/"} />
  return <main className="workspace signin"><h1>Haat_Bazar</h1><h2>{signup ? "Create an account" : "Sign in"}</h2>
    <form key={String(signup)} onSubmit={e => {
      e.preventDefault()
      const values = Object.fromEntries(new FormData(e.currentTarget))
      action.run(() => authenticate(signup ? "signup" : "login", values))
    }}>
      {signup && (
        <>
          <label>Name<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
          <label>Account Type
            <select name="role" defaultValue="consumer">
              <option value="consumer">Consumer (Buy fresh produce & print receipts)</option>
              <option value="grower">Grower / Farmer (Enlist & sell produce batches)</option>
            </select>
          </label>
        </>
      )}
      <label>Email<input name="email" type="email" required autoComplete="username"/></label>
      <label>Password<input name="password" type="password" required minLength={signup ? 12 : 1} maxLength={256}
        autoComplete={signup ? "new-password" : "current-password"}/></label>
      {signup && <small>Use at least 12 characters.</small>}
      <Feedback error={action.error}/><button disabled={action.busy}>{signup ? "Create account" : "Sign in"}</button>
    </form><button className="secondary" onClick={() => setSignup(!signup)}>{signup ? "Use an existing account" : "Create an account"}</button>
  </main>
}

export function AccountPage() {
  const session = useSession()!
  const devices = useRemote<Device[]>("/auth/sessions")
  const action = useAction()
  const [notice, setNotice] = useState("")
  return <section className="workspace"><h1>My account</h1>
    <p>{session.user.email} · {session.user.role}</p>
    <div className="panels"><form onSubmit={e => {
      e.preventDefault()
      const name = new FormData(e.currentTarget).get("name")
      action.run(async () => { updateAccount(await request<Account>("/auth/profile","PATCH",{name})); setNotice("Profile saved.") })
    }}><h2>Profile</h2><label>Name<input name="name" required minLength={2} maxLength={120} defaultValue={session.user.name}/></label>
    <button disabled={action.busy}>Save name</button></form>
    <form onSubmit={e => {
      e.preventDefault()
      const data = Object.fromEntries(new FormData(e.currentTarget))
      action.run(async () => { await request("/auth/password","PUT",data); remember(null) })
    }}><h2>Change password</h2>
      <label>Current password<input name="current_password" type="password" required autoComplete="current-password"/></label>
      <label>New password<input name="new_password" type="password" required minLength={12} maxLength={256} autoComplete="new-password"/></label>
      <button disabled={action.busy}>Change password and sign out</button></form></div>
    <Feedback error={action.error || devices.error} loading={!devices.data}/><p role="status">{notice}</p>
    <h2>Active sessions</h2>{devices.data?.map(d => <article key={d.id}><strong>{d.id === session.session_id ? "This device" : "Other device"}</strong>
      <p>{d.browser} · {d.ip} · {when(d.created)}</p><button disabled={action.busy} onClick={() => action.run(async () => {
        await request("/auth/sessions/"+d.id,"DELETE")
        if (d.id === session.session_id) remember(null); else devices.reload()
      })}>Revoke session</button></article>)}
    <button disabled={action.busy} onClick={() => action.run(async () => { await request("/auth/logout","POST"); remember(null) })}>Sign out</button>
  </section>
}
