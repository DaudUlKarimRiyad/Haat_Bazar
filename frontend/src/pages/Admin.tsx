import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Feedback, useAction, useRemote } from "../components/Remote"
import { apiService } from "../services/api"
import { request, useSession, type Account, type UserRole } from "../services/http"
import type { MemoPreview, Order, SalesMemo } from "../types/order"
import { when, type Device } from "./Account"

type Resource = "users" | "records" | "groups" | "activity"
type Tab = Resource | "transactions" | "memos" | "security"
type Row = { id: string } & Record<string, string | number | boolean | null>

const columns = {
  users: ["name", "email", "role", "banned"],
  records: ["commodity_name", "category", "farmer_name", "available_qty_kg", "farmer_unit_price", "is_active"],
  groups: ["name", "owner_id", "created"],
  activity: ["time", "event", "actor", "target", "detail", "ip", "browser"],
}

const titles: Record<string, string> = {
  commodity_name: "Batch",
  owner_id: "Owner ID",
  farmer_name: "Farmer",
  available_qty_kg: "Avail (kg)",
  farmer_unit_price: "Price (৳/kg)",
  is_active: "Active",
  ip: "IP address",
}

const label = (key: string) => titles[key] || key[0].toUpperCase() + key.slice(1).replaceAll("_", " ")

function display(key: string, value: Row[string]) {
  if ((key === "time" || key === "created") && typeof value === "number") return when(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return value || "—"
}

function Grid({
  rows,
  fields,
  select,
  selected,
  users,
}: {
  rows: Row[]
  fields: string[]
  select?: (id: string) => void
  selected?: string[]
  users?: boolean
}) {
  if (!rows.length) return <p>No matching entries.</p>
  return (
    <div className="scroll-table">
      <table>
        <thead>
          <tr>
            {select && <th>Select</th>}
            {fields.map((f) => (
              <th key={f}>{label(f)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {select && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={"Select " + (row.name || row.commodity_name || row.id)}
                    checked={selected?.includes(row.id)}
                    onChange={() => select(row.id)}
                  />
                </td>
              )}
              {fields.map((f) => (
                <td key={f}>
                  {users && f === "name" ? <Link to={"/admin/users/" + row.id}>{row.name}</Link> : display(f, row[f])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Security() {
  type Counts = { value: string; attempts: number }[]
  const view = useRemote<{ by_ip: Counts; by_account: Counts }>("/admin/security")
  const data = view.data
  return (
    <>
      <h2>Failed sign-ins</h2>
      <Feedback error={view.error} loading={!view.data} />
      {data && (
        <div className="panels">
          {(["by_ip", "by_account"] as const).map((key) => (
            <article key={key}>
              <h3>{key === "by_ip" ? "By IP address" : "By account"}</h3>
              {!data[key].length && <p>No failed sign-ins.</p>}
              {data[key].map((r) => (
                <p key={r.value}>
                  {r.value} · {r.attempts}
                </p>
              ))}
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function Transactions() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const action = useAction()
  const navigate = useNavigate()
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ""))
  const view = useRemote<{ items: Order[]; total: number }>(
    `/admin/transactions?${params.toString()}&offset=${page * 20}&limit=20`
  )
  const filter = (k: string, v: string) => {
    setFilters({ ...filters, [k]: v })
    setPage(0)
  }

  const exportCsv = () =>
    action.run(async () => {
      const blob = await apiService.exportAdminTransactions(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "transactions.csv"
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })

  return (
    <>
      <h2>Transaction History</h2>
      <div className="toolbar">
        <label>
          Search
          <input
            value={filters.search || ""}
            placeholder="Receipt #, consumer, grower, product"
            onChange={(e) => filter("search", e.target.value)}
          />
        </label>
        <label>
          Collection
          <select value={filters.fulfillment_type || ""} onChange={(e) => filter("fulfillment_type", e.target.value)}>
            <option value="">All</option>
            <option value="pickup">Hub Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        {(["since", "until"] as const).map((k) => (
          <label key={k}>
            {k === "since" ? "From" : "Through"}
            <input
              type="date"
              onChange={(e) => {
                const date = e.target.value
                filter(
                  k,
                  date ? String(new Date(date + (k === "since" ? "T00:00:00" : "T23:59:59")).getTime() / 1000) : ""
                )
              }}
            />
          </label>
        ))}
        <button disabled={action.busy} onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <Feedback error={action.error || view.error} loading={!view.data} />
      {view.data && (
        <>
          {!view.data.items.length ? (
            <p>No matching transactions.</p>
          ) : (
            <div className="scroll-table">
              <table>
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Time</th>
                    <th>Consumer</th>
                    <th>Items &amp; Grower</th>
                    <th>Collection</th>
                    <th>Total</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {view.data.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`}>{o.receipt_number}</Link>
                      </td>
                      <td>{when(o.created_at)}</td>
                      <td>
                        {o.consumer_name}
                        <br />
                        <small>{o.consumer_email}</small>
                      </td>
                      <td>
                        {o.items
                          .map((i) => `${i.commodity_name} (${i.quantity_kg} kg · ${i.farmer_name})`)
                          .join("; ")}
                      </td>
                      <td>{o.fulfillment_type === "pickup" ? "Hub Pickup" : "Delivery"}</td>
                      <td>
                        <strong>৳ {o.total_amount.toLocaleString()}</strong>
                      </td>
                      <td>
                        <button className="secondary" onClick={() => navigate(`/orders/${o.id}`)}>
                          View / Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="toolbar">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page + 1} of {Math.max(1, Math.ceil(view.data.total / 20))} · {view.data.total} total
            </span>
            <button disabled={(page + 1) * 20 >= view.data.total} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </>
  )
}

function GrowerMemos({ changed }: { changed: () => void }) {
  const growers = useRemote<{ items: Account[]; total: number }>("/admin/users?role=grower&limit=100")
  const memos = useRemote<SalesMemo[]>("/memos")
  const action = useAction()
  const navigate = useNavigate()

  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = today.slice(0, 7)
  const [farmerId, setFarmerId] = useState("")
  const [periodType, setPeriodType] = useState<"daily" | "monthly">("daily")
  const [periodKey, setPeriodKey] = useState(today)
  const [notes, setNotes] = useState("")
  const [preview, setPreview] = useState<MemoPreview | null>(null)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!farmerId && growers.data?.items.length) {
      setFarmerId(growers.data.items[0].id)
    }
  }, [farmerId, growers.data])

  const tzOffset = -new Date().getTimezoneOffset()

  const loadPreview = () =>
    action.run(async () => {
      if (!farmerId) return
      setNotice("")
      setPreview(await apiService.previewMemo(farmerId, periodType, periodKey, tzOffset))
    })

  const createMemo = () =>
    action.run(async () => {
      if (!farmerId) return
      const created = await apiService.createMemo({
        farmer_id: farmerId,
        period_type: periodType,
        period_key: periodKey,
        notes,
        tz_offset_minutes: tzOffset,
      })
      setNotes("")
      setPreview(null)
      setNotice(`Created memo ${created.memo_number} for ${created.farmer_name}.`)
      memos.reload()
      changed()
    })

  const removeMemo = (id: string) =>
    action.run(async () => {
      await apiService.deleteMemo(id)
      memos.reload()
      changed()
    })

  return (
    <>
      <h2>Grower Sales Memos (Daily / Monthly)</h2>
      <div className="toolbar">
        <label>
          Grower / Farmer
          <select value={farmerId} onChange={(e) => { setFarmerId(e.target.value); setPreview(null) }}>
            {growers.data?.items.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.email})
              </option>
            ))}
          </select>
        </label>
        <label>
          Period Type
          <select
            value={periodType}
            onChange={(e) => {
              const next = e.target.value as "daily" | "monthly"
              setPeriodType(next)
              setPeriodKey(next === "daily" ? today : thisMonth)
              setPreview(null)
            }}
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>
          {periodType === "daily" ? "Date" : "Month"}
          <input
            type={periodType === "daily" ? "date" : "month"}
            value={periodKey}
            onChange={(e) => { setPeriodKey(e.target.value); setPreview(null) }}
          />
        </label>
        <button className="secondary" disabled={action.busy || !farmerId} onClick={loadPreview}>
          Preview Sales
        </button>
      </div>

      <div className="toolbar">
        <label style={{ flex: 1, minWidth: 240 }}>
          Memo Notes (Optional)
          <input
            value={notes}
            maxLength={500}
            placeholder="Settlement remarks or collection hub notes..."
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button disabled={action.busy || !farmerId} onClick={createMemo}>
          Create Individual Memo
        </button>
      </div>

      <Feedback error={action.error || growers.error || memos.error} loading={!growers.data || !memos.data} />
      {notice && <p role="status">{notice}</p>}

      {preview && (
        <article style={{ border: "1px solid var(--border)", padding: 14, borderRadius: 6, margin: "12px 0" }}>
          <strong>
            Sales Preview: {preview.farmer_name} ({preview.period_type.toUpperCase()} · {preview.period_key})
          </strong>
          <p>
            Orders: <strong>{preview.total_orders}</strong> · Line Items: <strong>{preview.total_items_sold}</strong> ·
            Quantity Sold: <strong>{preview.total_qty_kg} kg</strong> · Gross Sales:{" "}
            <strong>৳ {preview.gross_sales.toLocaleString()}</strong>
          </p>
          {preview.items.length > 0 && (
            <div className="scroll-table">
              <table>
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Consumer</th>
                    <th>Product</th>
                    <th>Qty (kg)</th>
                    <th>Rate</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.receipt_number}</td>
                      <td>{item.consumer_name}</td>
                      <td>{item.commodity_name}</td>
                      <td>{item.quantity_kg} kg</td>
                      <td>৳ {item.unit_price}</td>
                      <td>৳ {item.line_total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      <h2>Issued Memos</h2>
      {memos.data && !memos.data.length && <p>No grower sales memos issued yet.</p>}
      {memos.data && memos.data.length > 0 && (
        <div className="scroll-table">
          <table>
            <thead>
              <tr>
                <th>Memo #</th>
                <th>Grower</th>
                <th>Period</th>
                <th>Orders</th>
                <th>Qty Sold</th>
                <th>Gross Sales</th>
                <th>Issued</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memos.data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link to={`/memos/${m.id}`}>{m.memo_number}</Link>
                  </td>
                  <td>
                    {m.farmer_name}
                    <br />
                    <small>{m.farmer_email}</small>
                  </td>
                  <td>
                    {m.period_type.toUpperCase()} · {m.period_key}
                  </td>
                  <td>{m.total_orders}</td>
                  <td>{m.total_qty_kg} kg</td>
                  <td>
                    <strong>৳ {m.gross_sales.toLocaleString()}</strong>
                  </td>
                  <td>{when(m.created_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="secondary" onClick={() => navigate(`/memos/${m.id}`)}>
                        View / Print
                      </button>
                      <button
                        className="danger"
                        style={{ marginTop: 0 }}
                        disabled={action.busy}
                        onClick={() => {
                          if (window.confirm(`Delete memo ${m.memo_number}?`)) removeMemo(m.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Directory({ resource, changed }: { resource: Resource; changed: () => void }) {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [ids, setIds] = useState<string[]>([])
  const [reason, setReason] = useState("")
  const action = useAction()
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ""))
  const base = "/admin/" + resource
  const view = useRemote<{ items: Row[]; total: number }>(base + "?" + params + "&offset=" + page * 20 + "&limit=20")
  const filter = (k: string, v: string) => {
    setFilters({ ...filters, [k]: v })
    setIds([])
    setPage(0)
  }
  const textFilter = (key: string, title: string) => (
    <label>
      {title}
      <input value={filters[key] || ""} onChange={(e) => filter(key, e.target.value)} />
    </label>
  )
  const choice = (key: string, values: string[]) => (
    <label>
      {label(key)}
      <select value={filters[key] || ""} onChange={(e) => filter(key, e.target.value)}>
        <option value="">All</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  )
  const mutate = (path: string, body: object) =>
    action.run(async () => {
      await request(base + path, "POST", body)
      setIds([])
      setPage(0)
      setReason("")
      view.reload()
      changed()
    })
  const exportCsv = () =>
    action.run(async () => {
      const blob = await request<Blob>(base + "/export?" + params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = resource + ".csv"
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      if (resource === "activity") view.reload()
    })
  return (
    <>
      <h2>{label(resource)}</h2>
      <div className="toolbar">
        {textFilter("search", "Search")}
        {resource === "users" && (
          <>
            {choice("role", ["admin", "grower", "consumer"])}
            {choice("status", ["active", "banned"])}
          </>
        )}
        {resource === "records" && (
          <>
            {textFilter("category", "Category")}
            {choice("status", ["active", "inactive"])}
          </>
        )}
        {(resource === "groups" || resource === "records") && textFilter("owner", "Owner ID")}
        {resource === "activity" && (
          <>
            {textFilter("event", "Event")}
            {textFilter("ip", "IP address")}
            {["since", "until"].map((k) => (
              <label key={k}>
                {k === "since" ? "From" : "Through"}
                <input
                  type="date"
                  onChange={(e) => {
                    const date = e.target.value
                    filter(
                      k,
                      date ? String(new Date(date + (k === "since" ? "T00:00:00" : "T23:59:59")).getTime() / 1000) : ""
                    )
                  }}
                />
              </label>
            ))}
          </>
        )}
        {resource !== "groups" && (
          <button disabled={action.busy} onClick={exportCsv}>
            Export CSV
          </button>
        )}
      </div>
      <Feedback error={action.error || view.error} loading={!view.data} />
      {view.data && (
        <>
          <Grid
            rows={view.data.items}
            fields={columns[resource]}
            users={resource === "users"}
            selected={ids}
            select={
              resource === "activity"
                ? undefined
                : (id) => setIds(ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id])
            }
          />
          <div className="toolbar">
            <button
              disabled={page === 0}
              onClick={() => {
                setPage(page - 1)
                setIds([])
              }}
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {Math.max(1, Math.ceil(view.data.total / 20))} · {view.data.total} total
            </span>
            <button
              disabled={(page + 1) * 20 >= view.data.total}
              onClick={() => {
                setPage(page + 1)
                setIds([])
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
      {ids.length > 0 && (
        <div className="toolbar">
          <strong>{ids.length} selected</strong>
          {resource === "users" ? (
            <>
              <label>
                Reason
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </label>
              {[true, false].map((banned) => (
                <button
                  key={String(banned)}
                  disabled={action.busy || !reason.trim()}
                  onClick={() => mutate("/status", { ids, reason, banned })}
                >
                  {banned ? "Ban" : "Unban"}
                </button>
              ))}
            </>
          ) : (
            <button
              className="danger"
              disabled={action.busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete selected " + resource + (resource === "groups" ? " and their shared batches?" : "?")
                  )
                )
                  mutate("/delete", { ids })
              }}
            >
              Delete selected
            </button>
          )}
        </div>
      )}
    </>
  )
}

export function AdminPage() {
  const overview = useRemote<Record<string, number>>("/admin/overview")
  const [tab, setTab] = useState<Tab>("users")
  const tabs: { key: Tab; title: string }[] = [
    { key: "users", title: "Users" },
    { key: "records", title: "Records" },
    { key: "groups", title: "Groups" },
    { key: "transactions", title: "Transactions" },
    { key: "memos", title: "Grower Memos" },
    { key: "activity", title: "Activity" },
    { key: "security", title: "Security" },
  ]
  return (
    <section className="workspace">
      <h1>Administration</h1>
      <Feedback error={overview.error} loading={!overview.data} />
      <div className="metrics">
        {Object.entries(overview.data || {}).map(([k, v]) => (
          <article key={k}>
            <strong>{k === "total_sales" ? `৳ ${v.toLocaleString()}` : v}</strong>
            <span>{k.startsWith("new_") ? label(k.slice(4)) + " added in 7 days" : label(k)}</span>
          </article>
        ))}
      </div>
      <nav className="toolbar">
        {tabs.map((t) => (
          <button className={tab === t.key ? "" : "secondary"} key={t.key} onClick={() => setTab(t.key)}>
            {t.title}
          </button>
        ))}
      </nav>
      {tab === "security" ? (
        <Security />
      ) : tab === "transactions" ? (
        <Transactions />
      ) : tab === "memos" ? (
        <GrowerMemos changed={overview.reload} />
      ) : (
        <Directory key={tab} resource={tab} changed={overview.reload} />
      )}
    </section>
  )
}

export function AdminUser() {
  const { uid } = useParams()
  const current = useSession()!
  const base = "/admin/users/" + uid
  const detail = useRemote<{
    user: Account
    records: Row[]
    groups: Row[]
    orders: Order[]
    memos: SalesMemo[]
    sessions: Device[]
    activity: Row[]
  }>(base + "/detail")
  const action = useAction()
  const [reason, setReason] = useState("")
  const [nextRole, setNextRole] = useState<UserRole | "">("")
  const data = detail.data
  if (!data) return <Feedback error={detail.error} loading />
  const u = data.user
  const selectedRole = nextRole || u.role
  const change = (path: string, method: string, body?: object) =>
    action.run(async () => {
      await request(path, method, body)
      detail.reload()
    })
  return (
    <section className="workspace">
      <Link to="/admin">Administration</Link>
      <h1>{u.name}</h1>
      <p>
        {u.email} · {u.role} · {u.banned ? "Banned · " + u.ban_reason : "Active"}
      </p>
      <code>{u.id}</code>
      <div className="toolbar">
        {u.id !== current.user.id && (
          <>
            <label>
              Role
              <select
                value={selectedRole}
                disabled={action.busy || u.banned}
                onChange={(e) => setNextRole(e.target.value as UserRole)}
              >
                <option value="consumer">consumer</option>
                <option value="grower">grower</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button
              disabled={action.busy || u.banned || selectedRole === u.role}
              onClick={() => {
                if (window.confirm("Change this account's role to " + selectedRole + "?"))
                  change(base + "/role", "PUT", { role: selectedRole })
              }}
            >
              Update role
            </button>
          </>
        )}
        <button disabled={action.busy} onClick={() => change(base + "/revoke", "POST")}>
          Revoke all sessions
        </button>
        {u.role !== "admin" && (
          <>
            <label>
              Reason
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              disabled={action.busy || !reason.trim()}
              onClick={() =>
                change("/admin/users/status", "POST", { ids: [u.id], banned: !u.banned, reason })
              }
            >
              {u.banned ? "Unban" : "Ban"} account
            </button>
          </>
        )}
      </div>
      <Feedback error={action.error} />
      <h2>Records</h2>
      <Grid rows={data.records} fields={columns.records} />
      <h2>Groups</h2>
      <Grid rows={data.groups} fields={columns.groups} />
      <h2>Consumer Orders</h2>
      {!data.orders.length ? (
        <p>No consumer orders.</p>
      ) : (
        data.orders.map((o) => (
          <article key={o.id}>
            <Link to={`/orders/${o.id}`}>{o.receipt_number}</Link> · {when(o.created_at)} · ৳{" "}
            {o.total_amount.toLocaleString()}
          </article>
        ))
      )}
      <h2>Grower Sales Memos</h2>
      {!data.memos.length ? (
        <p>No sales memos.</p>
      ) : (
        data.memos.map((m) => (
          <article key={m.id}>
            <Link to={`/memos/${m.id}`}>{m.memo_number}</Link> · {m.period_type.toUpperCase()} ({m.period_key}) ·{" "}
            {m.total_qty_kg} kg · ৳ {m.gross_sales.toLocaleString()}
          </article>
        ))
      )}
      <h2>Sessions</h2>
      {!data.sessions.length && <p>No sessions.</p>}
      {data.sessions.map((s) => (
        <article key={s.id}>
          {s.browser} · {s.ip} · {when(s.created)} ·{" "}
          {s.revoked ? "Revoked" : s.expires <= Date.now() / 1000 ? "Expired" : "Active"}
        </article>
      ))}
      <h2>Recent activity</h2>
      <Grid rows={data.activity} fields={columns.activity} />
    </section>
  )
}
