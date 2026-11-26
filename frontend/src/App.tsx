import { App as AntApp, ConfigProvider, theme } from "antd"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router"
import { useTheme } from "./context/ThemeContext"
import { AppLayout } from "./layouts/AppLayout"
import { AboutPage } from "./pages/AboutPage"
import { CreateListingPage } from "./pages/CreateListingPage"
import { HomePage } from "./pages/HomePage"
import { ListingDetailsPage } from "./pages/ListingDetailsPage"

import { useEffect, useState } from "react"
import { CartProvider } from "./context/CartContext"
import { AccountPage, SignIn } from "./pages/Account"
import { AdminPage, AdminUser } from "./pages/Admin"
import { CartPage, ConsumerOrdersPage, OrderReceiptPage } from "./pages/ConsumerOrders"
import { GroupsPage, GroupPage } from "./pages/Groups"
import { GrowerSalesPage, MemoDetailPage } from "./pages/GrowerSales"
import { restore, useSession, type UserRole } from "./services/http"

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
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <CartProvider>
          <BrowserRouter>
            {!ready ? <main className="workspace signin">{error ? <><p role="alert">{error}</p><button onClick={() => location.reload()}>Retry connection</button></> : <p role="status">Restoring session…</p>}</main> : <Routes>
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
            </Routes>}
          </BrowserRouter>
        </CartProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
