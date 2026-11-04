// App frame: navigation header with branding, dark mode switcher, and page content outlet.
import {
  AppstoreOutlined,
  InfoCircleOutlined,
  PlusCircleOutlined,
  ShopOutlined,
} from "@ant-design/icons"
import { Flex, Layout, Menu, Switch, Tag, Typography } from "antd"
import { Link, Outlet, useLocation } from "react-router"
import { useTheme } from "../context/ThemeContext"

export function AppLayout() {
  const { pathname } = useLocation()
  const { darkMode, toggleDark } = useTheme()

  const getSelectedKey = () => {
    if (pathname === "/about") return "about"
    if (pathname === "/create") return "create"
    return "listings"
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "0 24px",
          background: darkMode ? "#141414" : "#003a08",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ fontSize: 24 }}>🌾</span>
          <div>
            <Typography.Text strong style={{ fontSize: 18, color: "#ffffff", display: "block", lineHeight: 1.2 }}>
              Haat_Bazar
            </Typography.Text>
            <span style={{ fontSize: 11, color: "#95de64", letterSpacing: 0.5 }}>
              হাট বাজার • Direct Agri Chain
            </span>
          </div>
        </Link>

        <Tag color="success" style={{ marginLeft: 8, fontSize: 11, border: "none" }}>
          MVP v1.0
        </Tag>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[getSelectedKey()]}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            borderBottom: "none",
          }}
          items={[
            {
              key: "listings",
              icon: <AppstoreOutlined />,
              label: <Link to="/">Batch Listings</Link>,
            },
            {
              key: "create",
              icon: <PlusCircleOutlined />,
              label: <Link to="/create">Add Produce Batch</Link>,
            },
            {
              key: "about",
              icon: <InfoCircleOutlined />,
              label: <Link to="/about">System & About</Link>,
            },
          ]}
        />

        <Flex align="center" gap={8}>
          <Switch
            checked={darkMode}
            onChange={toggleDark}
            checkedChildren="🌙"
            unCheckedChildren="☀️"
          />
        </Flex>
      </Layout.Header>

      <Layout.Content
        style={{
          maxWidth: 1120,
          width: "100%",
          margin: "0 auto",
          padding: "24px 16px 48px",
        }}
      >
        <Outlet />
      </Layout.Content>

      <Layout.Footer
        style={{
          textAlign: "center",
          background: darkMode ? "#141414" : "#f0f2f5",
          borderTop: darkMode ? "1px solid #303030" : "1px solid #e8e8e8",
          padding: "20px 16px",
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          🌾 <strong>Haat_Bazar (হাট বাজার)</strong> — Agricultural Disintermediation Marketplace • Mid Project Assessment
        </Typography.Text>
        <br />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          FastAPI + Vite React TypeScript • Disintermediating rural agri supply chains
        </Typography.Text>
      </Layout.Footer>
    </Layout>
  )
}
