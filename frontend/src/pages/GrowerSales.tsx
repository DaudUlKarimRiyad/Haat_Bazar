import { FileTextOutlined, PrinterOutlined, RiseOutlined } from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Result,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { apiService } from "../services/api"
import { useSession } from "../services/http"
import type { GrowerSalesSummary, SalesMemo } from "../types/order"
import { when } from "./Account"

export function GrowerSalesPage() {
  const [sales, setSales] = useState<GrowerSalesSummary | null>(null)
  const [memos, setMemos] = useState<SalesMemo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([apiService.getGrowerSales(), apiService.getMemos()])
      .then(([salesData, memoRows]) => {
        setSales(salesData)
        setMemos(memoRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load grower sales"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="workspace">
      <h1 style={{ marginBottom: 4 }}>
        <RiseOutlined style={{ marginRight: 8, color: "#389e0d" }} />
        My Sales & Official Memos
      </h1>
      <Typography.Text type="secondary">
        Track consumer purchases of your enlisted batches and review daily/monthly memos issued by Admin.
      </Typography.Text>

      {error && <Alert type="error" message={error} showIcon style={{ margin: "16px 0" }} />}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ margin: "16px 0 24px" }}>
            <Col xs={24} sm={8}>
              <Card size="small" className="glass-card tabular-nums">
                <Statistic title="Orders Fulfilled" value={sales?.total_orders ?? 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" className="glass-card tabular-nums">
                <Statistic title="Total Produce Sold" value={sales?.total_qty_kg ?? 0} suffix="kg" />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" className="glass-card tabular-nums">
                <Statistic title="Gross Grower Payout" value={sales?.total_revenue ?? 0} prefix="৳" />
              </Card>
            </Col>
          </Row>

          <h2>
            <FileTextOutlined style={{ marginRight: 8 }} />
            Daily & Monthly Sales Memos (Issued by Admin)
          </h2>
          {memos.length === 0 ? (
            <Empty description="No official sales memos issued yet." style={{ marginBottom: 24 }} />
          ) : (
            <Table
              dataSource={memos}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              style={{ marginBottom: 28 }}
              columns={[
                {
                  title: "Memo #",
                  dataIndex: "memo_number",
                  render: (val: string, rec: SalesMemo) => (
                    <Link to={`/memos/${rec.id}`}>
                      <strong>{val}</strong>
                    </Link>
                  ),
                },
                {
                  title: "Period",
                  render: (_: unknown, rec: SalesMemo) => (
                    <Tag color={rec.period_type === "daily" ? "blue" : "purple"}>
                      {rec.period_type.toUpperCase()} · {rec.period_key}
                    </Tag>
                  ),
                },
                { title: "Orders", dataIndex: "total_orders" },
                {
                  title: "Total Sold",
                  dataIndex: "total_qty_kg",
                  render: (v: number) => `${v} kg`,
                },
                {
                  title: "Gross Sales",
                  dataIndex: "gross_sales",
                  render: (v: number) => <strong>৳ {v.toLocaleString()}</strong>,
                },
                {
                  title: "Issued",
                  dataIndex: "created_at",
                  render: (v: number) => when(v),
                },
                {
                  title: "Action",
                  render: (_: unknown, rec: SalesMemo) => (
                    <Button
                      size="small"
                      icon={<PrinterOutlined />}
                      onClick={() => navigate(`/memos/${rec.id}`)}
                    >
                      View / Print
                    </Button>
                  ),
                },
              ]}
            />
          )}

          <h2>Consumer Sales Ledger</h2>
          {!sales?.items.length ? (
            <Empty description="No consumer purchases recorded for your batches yet." />
          ) : (
            <Table
              dataSource={sales.items}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: "Receipt #", dataIndex: "receipt_number" },
                {
                  title: "Date",
                  dataIndex: "created_at",
                  render: (v: number) => when(v),
                },
                { title: "Consumer", dataIndex: "consumer_name" },
                { title: "Product", dataIndex: "commodity_name" },
                {
                  title: "Qty Sold",
                  dataIndex: "quantity_kg",
                  render: (v: number) => <strong>{v} kg</strong>,
                },
                {
                  title: "Rate",
                  dataIndex: "unit_price",
                  render: (v: number) => `৳ ${v} / kg`,
                },
                {
                  title: "Payout",
                  dataIndex: "line_total",
                  render: (v: number) => <strong>৳ {v.toLocaleString()}</strong>,
                },
              ]}
            />
          )}
        </>
      )}
    </section>
  )
}

export function MemoDetailPage() {
  const { memoId } = useParams<{ memoId: string }>()
  const session = useSession()!
  const navigate = useNavigate()
  const [memo, setMemo] = useState<SalesMemo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiService
      .getMemo(memoId ?? "")
      .then(setMemo)
      .catch((err) => setError(err instanceof Error ? err.message : "Memo not found"))
      .finally(() => setLoading(false))
  }, [memoId])

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!memo) {
    return (
      <Result
        status="404"
        title="Sales Memo Not Found"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => navigate(session.user.role === "admin" ? "/admin" : "/sales")}>
            Go Back
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <Flex justify="space-between" align="center" className="no-print" style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate(session.user.role === "admin" ? "/admin" : "/sales")}>
          ← Back to {session.user.role === "admin" ? "Administration" : "My Sales & Memos"}
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Print Sales Memo
        </Button>
      </Flex>

      <div className="printable-document">
        <Flex justify="space-between" align="start" wrap="wrap" gap={16}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              🌾 Haat_Bazar — Grower Sales Memo
            </Typography.Title>
            <Typography.Text type="secondary">
              Official {memo.period_type === "daily" ? "Daily" : "Monthly"} Sales Settlement Statement
            </Typography.Text>
          </div>
          <div style={{ textAlign: "right" }}>
            <Tag color={memo.period_type === "daily" ? "blue" : "purple"} style={{ fontSize: 13 }}>
              {memo.period_type.toUpperCase()} · {memo.period_key}
            </Tag>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{memo.memo_number}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>Issued: {when(memo.created_at)}</div>
          </div>
        </Flex>

        <Divider />

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Grower / Farmer">{memo.farmer_name}</Descriptions.Item>
          <Descriptions.Item label="Grower Email">{memo.farmer_email}</Descriptions.Item>
          <Descriptions.Item label="Period Type">{memo.period_type}</Descriptions.Item>
          <Descriptions.Item label="Period">{memo.period_key}</Descriptions.Item>
          <Descriptions.Item label="Total Orders">{memo.total_orders}</Descriptions.Item>
          <Descriptions.Item label="Total Quantity Sold">{memo.total_qty_kg} kg</Descriptions.Item>
          <Descriptions.Item label="Gross Sales">
            <strong style={{ color: "#389e0d", fontSize: 16 }}>
              ৳ {memo.gross_sales.toLocaleString()}
            </strong>
          </Descriptions.Item>
          <Descriptions.Item label="Admin Notes">{memo.notes || "—"}</Descriptions.Item>
        </Descriptions>

        <Table
          dataSource={memo.items}
          rowKey={(_, idx) => String(idx)}
          pagination={false}
          size="small"
          locale={{ emptyText: "No transactions occurred in this period." }}
          columns={[
            { title: "Receipt #", dataIndex: "receipt_number" },
            {
              title: "Date",
              dataIndex: "created_at",
              render: (v: number) => when(v),
            },
            { title: "Consumer", dataIndex: "consumer_name" },
            { title: "Product", dataIndex: "commodity_name" },
            { title: "Hub", dataIndex: "hub_name" },
            {
              title: "Qty (kg)",
              dataIndex: "quantity_kg",
              render: (v: number) => <strong>{v} kg</strong>,
            },
            {
              title: "Rate / kg",
              dataIndex: "unit_price",
              render: (v: number) => `৳ ${v}`,
            },
            {
              title: "Line Total",
              dataIndex: "line_total",
              render: (v: number) => <strong>৳ {v.toLocaleString()}</strong>,
            },
          ]}
        />
      </div>
    </div>
  )
}
