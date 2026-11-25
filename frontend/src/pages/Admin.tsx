import { useState } from "react"
import { Link, useParams } from "react-router"
import { Feedback, useAction, useRemote } from "../components/Remote"
import { request, useSession, type Account } from "../services/http"
import { when, type Device } from "./Account"

type Resource = "users" | "records" | "groups" | "activity"
type Row = { id: string } & Record<string, string | number | boolean | null>
const columns = {
  users: ["name","email","role","banned"], records: ["commodity_name","category","farmer_name","is_active"],
  groups: ["name","owner_id","created"], activity: ["time","event","actor","target","detail","ip","browser"],
}
const titles: Record<string, string> = {commodity_name:"Batch",owner_id:"Owner ID",farmer_name:"Farmer",is_active:"Active",ip:"IP address"}
const label = (key: string) => titles[key] || key[0].toUpperCase()+key.slice(1).replaceAll("_"," ")
function display(key: string, value: Row[string]) {
  if ((key === "time" || key === "created") && typeof value === "number") return when(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return value || "—"
}
function Grid({rows, fields, select, selected, users}: {rows: Row[], fields: string[], select?: (id: string) => void,
  selected?: string[], users?: boolean}) {
  if (!rows.length) return <p>No matching entries.</p>
  return <div className="scroll-table"><table><thead><tr>{select && <th>Select</th>}{fields.map(f => <th key={f}>{label(f)}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}>{select && <td><input type="checkbox" aria-label={"Select "+(row.name || row.commodity_name || row.id)}
      checked={selected?.includes(row.id)} onChange={() => select(row.id)}/></td>}{fields.map(f => <td key={f}>{users && f === "name"
        ? <Link to={"/admin/users/"+row.id}>{row.name}</Link> : display(f,row[f])}</td>)}</tr>)}</tbody></table></div>
}
function Security() {
  type Counts = { value: string, attempts: number }[]
  const view = useRemote<{by_ip: Counts, by_account: Counts}>("/admin/security")
  const data = view.data
  return <><h2>Failed sign-ins</h2><Feedback error={view.error} loading={!view.data}/>
    {data && <div className="panels">{(["by_ip","by_account"] as const).map(key => <article key={key}><h3>{key === "by_ip" ? "By IP address" : "By account"}</h3>
      {!data[key].length && <p>No failed sign-ins.</p>}{data[key].map(r => <p key={r.value}>{r.value} · {r.attempts}</p>)}</article>)}</div>}</>
}
function Directory({resource, changed}: {resource: Resource, changed: () => void}) {
  const [filters, setFilters] = useState<Record<string,string>>({})
  const [page,setPage] = useState(0)
  const [ids,setIds] = useState<string[]>([])
  const [reason,setReason] = useState("")
  const action = useAction()
  const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v !== ""))
  const base = "/admin/"+resource
  const view = useRemote<{items: Row[], total: number}>(base+"?"+params+"&offset="+(page*20)+"&limit=20")
  const filter = (k: string,v: string) => { setFilters({...filters,[k]:v}); setIds([]); setPage(0) }
  const textFilter = (key: string, title: string) => <label>{title}<input value={filters[key] || ""} onChange={e => filter(key,e.target.value)}/></label>
  const choice = (key: string, values: string[]) => <label>{label(key)}<select value={filters[key] || ""} onChange={e => filter(key,e.target.value)}>
    <option value="">All</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>
  const mutate = (path: string, body: object) => action.run(async () => {
    await request(base+path,"POST",body); setIds([]); setPage(0); setReason(""); view.reload(); changed()
  })
  const exportCsv = () => action.run(async () => {
    const blob = await request<Blob>(base+"/export?"+params)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = resource+".csv"; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    if (resource === "activity") view.reload()
  })
  return <><h2>{label(resource)}</h2><div className="toolbar">{textFilter("search","Search")}
    {resource === "users" && <>{choice("role",["user","admin"])}{choice("status",["active","banned"])}</>}
    {resource === "records" && <>{textFilter("category","Category")}{choice("status",["active","inactive"])}</>}
    {(resource === "groups" || resource === "records") && textFilter("owner","Owner ID")}
    {resource === "activity" && <>{textFilter("event","Event")}{textFilter("ip","IP address")}
      {["since","until"].map(k => <label key={k}>{k === "since" ? "From" : "Through"}<input type="date" onChange={e => {
        const date = e.target.value
        filter(k,date ? String(new Date(date + (k === "since" ? "T00:00:00" : "T23:59:59")).getTime()/1000) : "")
      }}/></label>)}</>}
    {resource !== "groups" && <button disabled={action.busy} onClick={exportCsv}>Export CSV</button>}</div>
    <Feedback error={action.error || view.error} loading={!view.data}/>
    {view.data && <><Grid rows={view.data.items} fields={columns[resource]} users={resource === "users"} selected={ids}
      select={resource === "activity" ? undefined : id => setIds(ids.includes(id) ? ids.filter(i => i !== id) : [...ids,id])}/>
      <div className="toolbar"><button disabled={page === 0} onClick={() => {setPage(page-1); setIds([])}}>Previous</button>
        <span>Page {page+1} of {Math.max(1,Math.ceil(view.data.total/20))} · {view.data.total} total</span>
        <button disabled={(page+1)*20 >= view.data.total} onClick={() => {setPage(page+1); setIds([])}}>Next</button></div></>}
    {ids.length > 0 && <div className="toolbar"><strong>{ids.length} selected</strong>{resource === "users" ? <>
      <label>Reason<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></label>
      {[true,false].map(banned => <button key={String(banned)} disabled={action.busy || !reason.trim()} onClick={() => mutate("/status",{ids,reason,banned})}>{banned ? "Ban" : "Unban"}</button>)}</>
      : <button className="danger" disabled={action.busy} onClick={() => {
        if (window.confirm("Delete selected "+resource+(resource === "groups" ? " and their shared batches?" : "?"))) mutate("/delete",{ids})
      }}>Delete selected</button>}</div>}
  </>
}

export function AdminPage() {
  const overview = useRemote<Record<string,number>>("/admin/overview")
  const [tab,setTab] = useState<Resource | "security">("users")
  return <section className="workspace"><h1>Administration</h1><Feedback error={overview.error} loading={!overview.data}/>
    <div className="metrics">{Object.entries(overview.data || {}).map(([k,v]) => <article key={k}><strong>{v}</strong><span>{
      k.startsWith("new_") ? label(k.slice(4))+" added in 7 days" : label(k)}</span></article>)}</div>
    <nav className="toolbar">{(["users","records","groups","activity","security"] as const).map(t =>
      <button className={tab === t ? "" : "secondary"} key={t} onClick={() => setTab(t)}>{label(t)}</button>)}</nav>
    {tab === "security" ? <Security/> : <Directory key={tab} resource={tab} changed={overview.reload}/>}</section>
}

export function AdminUser() {
  const {uid} = useParams()
  const current = useSession()!
  const base = "/admin/users/"+uid
  const detail = useRemote<{user:Account, records:Row[], groups:Row[], sessions:Device[], activity:Row[]}>(base+"/detail")
  const action = useAction()
  const [reason,setReason] = useState("")
  const data = detail.data
  if (!data) return <Feedback error={detail.error} loading/>
  const u = data.user
  const change = (path: string, method: string, body?: object) => action.run(async () => {
    await request(path,method,body); detail.reload()
  })
  return <section className="workspace"><Link to="/admin">Administration</Link><h1>{u.name}</h1>
    <p>{u.email} · {u.role} · {u.banned ? "Banned · "+u.ban_reason : "Active"}</p><code>{u.id}</code>
    <div className="toolbar">
      {u.id !== current.user.id && <button disabled={action.busy || u.banned} onClick={() => {
        const role = u.role === "admin" ? "user" : "admin"
        if (window.confirm("Change this account's role to "+role+"?")) change(base+"/role","PUT",{role})
      }}>Change to {u.role === "admin" ? "user" : "admin"}</button>}
      <button disabled={action.busy} onClick={() => change(base+"/revoke","POST")}>Revoke all sessions</button>
      {u.role !== "admin" && <><label>Reason<input value={reason} onChange={e => setReason(e.target.value)}/></label>
        <button disabled={action.busy || !reason.trim()} onClick={() => change("/admin/users/status","POST",{ids:[u.id], banned:!u.banned, reason})}>
          {u.banned ? "Unban" : "Ban"} account</button></>}</div>
    <Feedback error={action.error}/><h2>Records</h2><Grid rows={data.records} fields={columns.records}/>
    <h2>Groups</h2><Grid rows={data.groups} fields={columns.groups}/>
    <h2>Sessions</h2>{!data.sessions.length && <p>No sessions.</p>}{data.sessions.map(s => <article key={s.id}>{s.browser} · {s.ip} · {when(s.created)} · {s.revoked ? "Revoked" : s.expires <= Date.now()/1000 ? "Expired" : "Active"}</article>)}
    <h2>Recent activity</h2><Grid rows={data.activity} fields={columns.activity}/></section>
}
