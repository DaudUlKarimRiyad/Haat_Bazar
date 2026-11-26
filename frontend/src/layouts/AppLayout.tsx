// App frame: navigation header with branding, dark mode switcher, and page content outlet.
import {
  AppstoreOutlined,
  InfoCircleOutlined,
  PlusCircleOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons"
import { Badge, Flex, Layout, Menu, Switch, Tag, Typography } from "antd"
import { Link, Outlet, useLocation } from "react-router"
import { useCart } from "../context/CartContext"
import { useTheme } from "../context/ThemeContext"

import { useSession } from "../services/http"

export function AppLayout() {
  const session = useSession()!
  const { pathname } = useLocation()
  const { darkMode, toggleDark } = useTheme()
  const { items: cartItems } = useCart()
  const role = session.user.role
  const isGrowerOrAdmin = role === "grower" || role === "admin"

  const getSelectedKey = () => {
    if (pathname === "/about") return "about"
    if (pathname === "/create") return "create"
    if (pathname === "/cart") return "cart"
    if (pathname.startsWith("/orders")) return "orders"
    if (pathname.startsWith("/sales") || pathname.startsWith("/memos")) return "sales"
    return pathname.split("/")[1] || "listings"
  }

  const roleColor = role === "admin" ? "gold" : role === "grower" ? "green" : "cyan"
  const roleLabel = role === "admin" ? "Admin" : role === "grower" ? "Grower / Farmer" : "Consumer"

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header className="glass-header">
        <div
          style={{
            maxWidth: 1120,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              flexShrink: 0,
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>🌾</span>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <Typography.Text
                strong
                style={{ fontSize: 17, color: "#ffffff", display: "block", lineHeight: 1.2 }}
              >
                Haat_Bazar
              </Typography.Text>
              <span style={{ fontSize: 11, color: "#b7eb8f", letterSpacing: 0.4, lineHeight: 1.25 }}>
                হাট বাজার • Direct Agri Chain
              </span>
            </div>
          </Link>

          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[getSelectedKey()]}
            style={{
              flex: 1,
              minWidth: 0,
              height: 66,
              lineHeight: "66px",
              background: "transparent",
              borderBottom: "none",
            }}
            items={[
              {
                key: "listings",
                icon: <AppstoreOutlined />,
                label: <Link to="/">{role === "consumer" ? "Marketplace" : "Batches"}</Link>,
              },
              ...(isGrowerOrAdmin
                ? [
                    {
                      key: "create",
                      icon: <PlusCircleOutlined />,
                      label: <Link to="/create">Add Batch</Link>,
                    },
                    {
                      key: "groups",
                      icon: <TeamOutlined />,
                      label: <Link to="/groups">Groups</Link>,
                    },
                  ]
                : []),
              ...(role === "grower"
                ? [
                    {
                      key: "sales",
                      icon: <RiseOutlined />,
                      label: <Link to="/sales">Sales &amp; Memos</Link>,
                    },
                  ]
                : []),
              ...(role === "consumer"
                ? [
                    {
                      key: "cart",
                      icon: <ShoppingCartOutlined />,
                      label: (
                        <Link to="/cart" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span>Cart</span>
                          {cartItems.length > 0 && <Badge count={cartItems.length} size="small" />}
                        </Link>
                      ),
                    },
                    {
                      key: "orders",
                      icon: <SolutionOutlined />,
                      label: <Link to="/orders">Orders</Link>,
                    },
                  ]
                : []),
              {
                key: "account",
                icon: <UserOutlined />,
                label: <Link to="/account">Account</Link>,
              },
              ...(role === "admin"
                ? [
                    {
                      key: "admin",
                      icon: <SafetyCertificateOutlined />,
                      label: <Link to="/admin">Admin</Link>,
                    },
                  ]
                : []),
              {
                key: "about",
                icon: <InfoCircleOutlined />,
                label: <Link to="/about">About</Link>,
              },
            ]}
          />

          <Flex align="center" gap={10} style={{ flexShrink: 0 }}>
            <Tag
              color={roleColor}
              style={{
                margin: 0,
                fontWeight: 600,
                borderRadius: 999,
                padding: "2px 10px",
              }}
            >
              {roleLabel}
            </Tag>
            <Switch
              checked={darkMode}
              onChange={toggleDark}
              checkedChildren="🌙"
              unCheckedChildren="☀️"
            />
          </Flex>
        </div>
      </Layout.Header>

      <Layout.Content
        style={{
          maxWidth: 1120,
          width: "100%",
          margin: "0 auto",
          padding: "26px 16px 52px",
        }}
      >
        <Outlet />
      </Layout.Content>

      <Layout.Footer className="glass-footer">
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          🌾 <strong>Haat_Bazar (হাট বাজার)</strong> — Agricultural Disintermediation Marketplace
        </Typography.Text>
        <br />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          FastAPI + Vite React TypeScript • Disintermediating rural agri supply chains
        </Typography.Text>
      </Layout.Footer>
    </Layout>
  )
}
