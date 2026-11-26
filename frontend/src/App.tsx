import { App as AntApp, ConfigProvider, Spin, theme } from "antd"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router"
import { lazy, Suspense, useEffect, useState } from "react"
import { CartProvider } from "./context/CartContext"
import { useTheme } from "./context/ThemeContext"
import { AppLayout } from "./layouts/AppLayout"
import { AccountPage, SignIn } from "./pages/Account"
import { HomePage } from "./pages/HomePage"
import { restore, useSession, type UserRole } from "./services/http"

const AboutPage = lazy(() => import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })))
const CreateListingPage = lazy(() =>
  import("./pages/CreateListingPage").then((m) => ({ default: m.CreateListingPage }))
)
const ListingDetailsPage = lazy(() =>
  import("./pages/ListingDetailsPage").then((m) => ({ default: m.ListingDetailsPage }))
)
const AdminPage = lazy(() => import("./pages/Admin").then((m) => ({ default: m.AdminPage })))
const AdminUser = lazy(() => import("./pages/Admin").then((m) => ({ default: m.AdminUser })))
const CartPage = lazy(() => import("./pages/ConsumerOrders").then((m) => ({ default: m.CartPage })))
const ConsumerOrdersPage = lazy(() =>
  import("./pages/ConsumerOrders").then((m) => ({ default: m.ConsumerOrdersPage }))
)
const OrderReceiptPage = lazy(() =>
  import("./pages/ConsumerOrders").then((m) => ({ default: m.OrderReceiptPage }))
)
const GroupsPage = lazy(() => import("./pages/Groups").then((m) => ({ default: m.GroupsPage })))
const GroupPage = lazy(() => import("./pages/Groups").then((m) => ({ default: m.GroupPage })))
const GrowerSalesPage = lazy(() =>
  import("./pages/GrowerSales").then((m) => ({ default: m.GrowerSalesPage }))
)
const MemoDetailPage = lazy(() =>
  import("./pages/GrowerSales").then((m) => ({ default: m.MemoDetailPage }))
)

function Guard({ roles }: { roles?: UserRole[] }) {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }}/>
  if (roles && !roles.includes(session.user.role)) return <Navigate to="/" replace/>
  return <Outlet key={session.user.id}/>
}

function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { restore().then(() => setReady(true)).catch(e => setError(e.message)) }, [])

  const { darkMode } = useTheme()

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#389e0d", // Agricultural lush green
          borderRadius: 10,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgContainer: darkMode ? "rgba(22, 34, 26, 0.72)" : "rgba(255, 255, 255, 0.78)",
          colorBgElevated: darkMode ? "rgba(24, 38, 29, 0.92)" : "rgba(255, 255, 255, 0.92)",
        },
        components: {
          Card: {
            borderRadiusLG: 14,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 38,
          },
          Input: {
            borderRadius: 8,
          },
          Select: {
            borderRadius: 8,
          },
        },
      }}
    >
      <AntApp>
        <CartProvider>
          <BrowserRouter>
            {!ready ? <main className="workspace signin">{error ? <><p role="alert">{error}</p><button onClick={() => location.reload()}>Retry connection</button></> : <p role="status">Restoring session…</p>}</main> : <Suspense fallback={<div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>}><Routes>
              <Route path="/signin" element={<SignIn/>}/>
              <Route element={<Guard/>}>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="listings/:listingId" element={<ListingDetailsPage />} />
                <Route path="account" element={<AccountPage/>}/>
                <Route path="orders/:orderId" element={<OrderReceiptPage/>}/>
                <Route path="about" element={<AboutPage />} />
                <Route element={<Guard roles={["consumer"]}/>}>
                  <Route path="cart" element={<CartPage/>}/>
                  <Route path="orders" element={<ConsumerOrdersPage/>}/>
                </Route>
                <Route element={<Guard roles={["grower", "admin"]}/>}>
                  <Route path="create" element={<CreateListingPage />} />
                  <Route path="groups" element={<GroupsPage/>}/>
                  <Route path="groups/:gid" element={<GroupPage/>}/>
                  <Route path="sales" element={<GrowerSalesPage/>}/>
                  <Route path="memos/:memoId" element={<MemoDetailPage/>}/>
                </Route>
                <Route element={<Guard roles={["admin"]}/>}>
                  <Route path="admin" element={<AdminPage/>}/>
                  <Route path="admin/users/:uid" element={<AdminUser/>}/>
                </Route>
                <Route path="*" element={<Navigate replace to="/"/>}/>
              </Route>
              </Route>
            </Routes></Suspense>}
          </BrowserRouter>
        </CartProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
