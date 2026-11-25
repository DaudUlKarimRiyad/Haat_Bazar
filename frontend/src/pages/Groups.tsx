import { Link, useNavigate, useParams } from "react-router"
import { Feedback, useAction, useRemote } from "../components/Remote"
import { request } from "../services/http"

interface Permissions { create_batches: boolean, update_batches: boolean, assign_batches: boolean }
export interface Group extends Permissions { id: string, name: string, owner_id: string, owner: boolean }
interface Member extends Permissions { user_id: string, name: string, email: string }
interface Detail extends Group {
  owner_name: string
  members: Member[]
  batches: { id: string, name: string, assignee: string | null }[]
}
const permissions = { create_batches: "Create", update_batches: "Edit", assign_batches: "Assign" } as const
const flags = Object.keys(permissions) as (keyof Permissions)[]

export function GroupsPage() {
  const groups = useRemote<Group[]>("/groups")
  const action = useAction()
  const navigate = useNavigate()
  return <section className="workspace"><h1>Grower groups</h1>
    <form className="toolbar" onSubmit={e => {
      e.preventDefault()
      const name = new FormData(e.currentTarget).get("name")
      action.run(async () => { const group = await request<Group>("/groups","POST",{ name }); navigate("/groups/"+group.id) })
    }}><label>New group name<input name="name" required minLength={2} maxLength={120}/></label><button disabled={action.busy}>Create group</button></form>
    <Feedback error={action.error || groups.error} loading={!groups.data}/>
    {groups.data?.length === 0 && <p>You have no grower groups yet.</p>}
    {groups.data?.map(g => <article key={g.id}><Link to={"/groups/"+g.id}>{g.name}</Link><p>{g.owner ? "Owner" : ["View", ...flags.filter(f => g[f]).map(f => permissions[f])].join(" · ")}</p></article>)}
  </section>
}

function MemberForm({member, save, busy}: {member?: Member, busy: boolean, save: (data: object) => void}) {
  return <form className="toolbar" onSubmit={e => {
    e.preventDefault()
    const values = new FormData(e.currentTarget)
    save({email: member?.email || values.get("email"), ...Object.fromEntries(flags.map(f => [f, values.has(f)]))})
  }}>
    {member ? <strong>{member.name} ({member.email})</strong> : <label>Member email<input name="email" type="email" required/></label>}
    {flags.map(f => <label className="check" key={f}><input name={f} type="checkbox" defaultChecked={member?.[f]}/>{permissions[f]}</label>)}
    <button disabled={busy}>{member ? "Save permissions" : "Add member"}</button>
  </form>
}

export function GroupPage() {
  const { gid } = useParams()
  const path = "/groups/" + gid
  const view = useRemote<Detail>(path)
  const action = useAction()
  const navigate = useNavigate()
  const g = view.data
  const change = (suffix: string, method: string, data?: object) => action.run(async () => {
    await request(path+suffix,method,data); view.reload()
  })
  if (!g) return <Feedback error={view.error} loading/>
  const people = [{id:g.owner_id,name:g.owner_name}, ...g.members.map(m => ({id:m.user_id,name:m.name}))]
  return <section className="workspace"><Link to="/groups">All groups</Link><h1>{g.name}</h1><p>Owner · {g.owner_name}</p>
    <Feedback error={action.error}/><h2>Shared batches</h2>
    {g.create_batches && <Link to={"/create?group="+g.id}>Create a shared batch</Link>}
    {g.batches.length === 0 && <p>No shared batches yet.</p>}
    {g.batches.map(b => <article key={b.id}><Link to={"/listings/"+b.id}>{b.name}</Link>
      {g.assign_batches ? <label>Assigned grower<select value={b.assignee || ""} disabled={action.busy}
        onChange={e => change("/batches/"+b.id+"/assignment","PUT",{ user_id: e.target.value || null })}>
        <option value="">Unassigned</option>{people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
        : <p>{people.find(p => p.id === b.assignee)?.name || "Unassigned"}</p>}</article>)}
    <h2>Members</h2>{!g.members.length && <p>Only the owner has access.</p>}
    {g.members.map(m => <article key={m.user_id}>{g.owner ? <>
      <MemberForm member={m} save={d => change("/members","PUT",d)} busy={action.busy}/>
      <button className="secondary" disabled={action.busy} onClick={() => change("/members/"+m.user_id,"DELETE")}>Remove member</button></>
      : <p>{m.name} · {["View", ...flags.filter(f => m[f]).map(f => permissions[f])].join(", ")}</p>}</article>)}
    {g.owner && <><MemberForm busy={action.busy} save={d => change("/members","PUT",d)}/>
      <h2>Group settings</h2><form className="toolbar" onSubmit={e => {
        e.preventDefault(); change("","PATCH",{name:new FormData(e.currentTarget).get("name")})
      }}><label>Group name<input name="name" defaultValue={g.name} required minLength={2} maxLength={120}/></label>
      <button disabled={action.busy}>Rename group</button></form>
      <button className="danger" disabled={action.busy} onClick={() => {
        if (window.confirm("Delete this group and all its shared batches?")) action.run(async () => { await request(path,"DELETE"); navigate("/groups") })
      }}>Delete group and batches</button></>}
  </section>
}
