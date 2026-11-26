import {
  CheckCircleOutlined,
  DeleteOutlined,
  PrinterOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
} from "@ant-design/icons"
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  InputNumber,
  Radio,
  Result,
  Row,
  Slider,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { useCart } from "../context/CartContext"
import { apiService } from "../services/api"
import { useSession } from "../services/http"
import type { Order } from "../types/order"
import { when } from "./Account"

export function CartPage() {
  const { items, updateQuantity, removeItem, clearCart } = useCart()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [orderTier, setOrderTier] = useState<"B2C" | "B2B">("B2C")
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup")
  const [distanceKm, setDistanceKm] = useState(10)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const lineChecks = items.map(({ listing, quantity_kg }) => {
    const moq = orderTier === "B2C" ? listing.b2c_moq_kg : listing.b2b_moq_kg
    const passesMoq = quantity_kg >= moq
    const passesStock = quantity_kg <= listing.available_qty_kg
    const lineTotal = Number((quantity_kg * listing.farmer_unit_price).toFixed(2))
    return { listing, quantity_kg, moq, passesMoq, passesStock, lineTotal }
  })

  const subtotal = Number(lineChecks.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2))
  const totalQty = Number(lineChecks.reduce((acc, item) => acc + item.quantity_kg, 0).toFixed(2))
  const alpha = orderTier === "B2C" ? 0.05 : 0.025
  const sMin = orderTier === "B2C" ? 20 : 100
  const serviceFee = items.length ? Number(Math.max(sMin, subtotal * alpha).toFixed(2)) : 0
  const deliveryFee =
    fulfillmentType === "pickup" || !items.length
      ? 0
      : Number(
          (
            (orderTier === "B2C" ? 40 : 250) +
            distanceKm * 2.5 +
            totalQty * (orderTier === "B2C" ? 1.5 : 0.8)
          ).toFixed(2)
        )
  const totalAmount = Number((subtotal + serviceFee + deliveryFee).toFixed(2))
  const allValid = items.length > 0 && lineChecks.every((c) => c.passesMoq && c.passesStock)

  const handleCheckout = async () => {
    setSubmitting(true)
    try {
      const order = await apiService.checkout({
        items: items.map((i) => ({ listing_id: i.listing.id, quantity_kg: i.quantity_kg })),
        order_tier: orderTier,
        fulfillment_type: fulfillmentType,
        distance_km: fulfillmentType === "delivery" ? distanceKm : 0,
        notes,
      })
      clearCart()
      message.success(`Order confirmed! Receipt ${order.receipt_number}`)
      navigate(`/orders/${order.id}`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Checkout failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="workspace">
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            <ShoppingCartOutlined style={{ marginRight: 8, color: "#389e0d" }} />
            Cart & Checkout
          </h1>
          <Typography.Text type="secondary">
            Verify grower minimum purchaseable quantities (MOQ) and place your direct-from-farm order.
          </Typography.Text>
        </div>
        <Link to="/">
          <Button>Browse Fresh Produce</Button>
        </Link>
      </Flex>

      {items.length === 0 ? (
        <Empty
          style={{ marginTop: 40 }}
          description="Your basket is empty. Browse fresh grower batches to add items."
        >
          <Button type="primary" onClick={() => navigate("/")}>
            Explore Marketplace
          </Button>
        </Empty>
      ) : (
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={15}>
            <Card className="glass-card" title={`Selected Produce (${items.length})`} size="small">
              {lineChecks.map(({ listing, quantity_kg, moq, passesMoq, passesStock, lineTotal }) => (
                <div
                  key={listing.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <Flex justify="space-between" align="start" wrap="wrap" gap={12}>
                    <div>
                      <Link to={`/listings/${listing.id}`} style={{ fontWeight: 600, fontSize: 16 }}>
                        {listing.commodity_name}
                      </Link>
                      <div style={{ fontSize: 13, color: "#595959", marginTop: 4 }}>
                        Grower: <strong>{listing.farmer_name}</strong> · Hub: {listing.hub_name} ·{" "}
                        <Tag color="cyan">{listing.category}</Tag>
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Rate: <strong>৳ {listing.farmer_unit_price} / kg</strong> · Min Qty ({orderTier}):{" "}
                        <strong>{moq} kg</strong> · Available: <strong>{listing.available_qty_kg} kg</strong>
                      </div>
                      <Flex gap={6} style={{ marginTop: 6 }}>
                        {!passesMoq && (
                          <Tag color="error">Below grower minimum ({moq} kg)</Tag>
                        )}
                        {!passesStock && (
                          <Tag color="error">Exceeds available stock ({listing.available_qty_kg} kg)</Tag>
                        )}
                        {passesMoq && passesStock && (
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            Meets grower requirement
                          </Tag>
                        )}
                      </Flex>
                    </div>
                    <Flex align="center" gap={10}>
                      <InputNumber
                        min={0.1}
                        step={0.5}
                        value={quantity_kg}
                        addonAfter="kg"
                        onChange={(val) => updateQuantity(listing.id, Number(val) || 0)}
                      />
                      <strong style={{ minWidth: 85, textAlign: "right" }}>
                        ৳ {lineTotal.toLocaleString()}
                      </strong>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeItem(listing.id)}
                        aria-label={`Remove ${listing.commodity_name}`}
                      />
                    </Flex>
                  </Flex>
                </div>
              ))}
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card title="Checkout Summary" className="calculator-card">
              <div style={{ marginBottom: 14 }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                  Order Tier
                </Typography.Text>
                <Radio.Group
                  value={orderTier}
                  onChange={(e) => setOrderTier(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <Radio.Button value="B2C" style={{ width: "50%", textAlign: "center" }}>
                    B2C (Retail)
                  </Radio.Button>
                  <Radio.Button value="B2B" style={{ width: "50%", textAlign: "center" }}>
                    B2B (Bulk)
                  </Radio.Button>
                </Radio.Group>
              </div>

              <div style={{ marginBottom: 14 }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                  Collection / Fulfillment
                </Typography.Text>
                <Radio.Group
                  value={fulfillmentType}
                  onChange={(e) => setFulfillmentType(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <Radio.Button value="pickup" style={{ width: "50%", textAlign: "center" }}>
                    Hub Pickup (Free)
                  </Radio.Button>
                  <Radio.Button value="delivery" style={{ width: "50%", textAlign: "center" }}>
                    Home Delivery
                  </Radio.Button>
                </Radio.Group>
              </div>

              {fulfillmentType === "delivery" && (
                <div style={{ marginBottom: 14 }}>
                  <Flex justify="space-between">
                    <Typography.Text strong>Delivery Distance:</Typography.Text>
                    <strong>{distanceKm} km</strong>
                  </Flex>
                  <Slider min={2} max={120} value={distanceKm} onChange={setDistanceKm} />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                  Collection / Order Notes
                </Typography.Text>
                <Input.TextArea
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional pickup time or instructions..."
                />
              </div>

              <Divider style={{ margin: "12px 0" }} />

              <Flex justify="space-between" style={{ marginBottom: 6 }}>
                <span>Total Weight:</span>
                <strong>{totalQty} kg</strong>
              </Flex>
              <Flex justify="space-between" style={{ marginBottom: 6 }}>
                <span>Produce Subtotal:</span>
                <strong>৳ {subtotal.toLocaleString()}</strong>
              </Flex>
              <Flex justify="space-between" style={{ marginBottom: 6 }}>
                <span>Platform Service Fee ({alpha * 100}%):</span>
                <span>+ ৳ {serviceFee.toLocaleString()}</span>
              </Flex>
              <Flex justify="space-between" style={{ marginBottom: 6 }}>
                <span>Delivery Fee:</span>
                <span>+ ৳ {deliveryFee.toLocaleString()}</span>
              </Flex>
              <Divider style={{ margin: "10px 0" }} />
              <Flex justify="space-between" align="baseline" style={{ marginBottom: 16 }}>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  Total Payable:
                </Typography.Text>
                <Typography.Title level={3} style={{ margin: 0, color: "#389e0d" }}>
                  ৳ {totalAmount.toLocaleString()}
                </Typography.Title>
              </Flex>

              {!allValid && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Adjust item quantities to satisfy each grower's minimum quantity and available stock."
                />
              )}

              <Button
                type="primary"
                size="large"
                block
                loading={submitting}
                disabled={!allValid}
                onClick={handleCheckout}
              >
                Confirm Order & Generate Receipt
              </Button>
            </Card>
          </Col>
        </Row>
      )}
    </section>
  )
}

export function ConsumerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    apiService
      .getOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load orders"))
      .finally(() => setLoading(false))
  }, [])

  const totalSpent = orders.reduce((acc, o) => acc + o.total_amount, 0)
  const totalKg = orders.reduce(
    (acc, o) => acc + o.items.reduce((s, i) => s + i.quantity_kg, 0),
    0
  )

  return (
    <section className="workspace">
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            <SolutionOutlined style={{ marginRight: 8, color: "#389e0d" }} />
            My Purchase History & Receipts
          </h1>
          <Typography.Text type="secondary">
            Review every completed order and open any receipt to print.
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => navigate("/")}>
          Shop Fresh Produce
        </Button>
      </Flex>

      <Row gutter={[16, 16]} style={{ margin: "16px 0 24px" }}>
        <Col xs={24} sm={8}>
          <Card size="small" className="glass-card tabular-nums">
            <Statistic title="Total Orders" value={orders.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="glass-card tabular-nums">
            <Statistic title="Total Quantity Purchased" value={Number(totalKg.toFixed(2))} suffix="kg" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="glass-card tabular-nums">
            <Statistic title="Total Spent" value={Number(totalSpent.toFixed(2))} prefix="৳" />
          </Card>
        </Col>
      </Row>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : orders.length === 0 ? (
        <Empty description="You have not placed any orders yet.">
          <Button type="primary" onClick={() => navigate("/")}>
            Browse Marketplace
          </Button>
        </Empty>
      ) : (
        <Table
          dataSource={orders}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Receipt #",
              dataIndex: "receipt_number",
              render: (val: string, rec: Order) => (
                <Link to={`/orders/${rec.id}`}>
                  <strong>{val}</strong>
                </Link>
              ),
            },
            {
              title: "Date",
              dataIndex: "created_at",
              render: (val: number) => when(val),
            },
            {
              title: "Items & Quantities",
              render: (_: unknown, rec: Order) =>
                rec.items.map((i) => `${i.commodity_name} (${i.quantity_kg} kg)`).join(", "),
            },
            {
              title: "Collection",
              dataIndex: "fulfillment_type",
              render: (val: string) => (
                <Tag color={val === "pickup" ? "green" : "blue"}>
                  {val === "pickup" ? "Hub Pickup" : "Delivery"}
                </Tag>
              ),
            },
            {
              title: "Total",
              dataIndex: "total_amount",
              render: (val: number) => <strong>৳ {val.toLocaleString()}</strong>,
            },
            {
              title: "Receipt",
              render: (_: unknown, rec: Order) => (
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => navigate(`/orders/${rec.id}`)}
                >
                  View / Print
                </Button>
              ),
            },
          ]}
        />
      )}
    </section>
  )
}

export function OrderReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const session = useSession()!
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiService
      .getOrder(orderId ?? "")
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Receipt not found"))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!order) {
    return (
      <Result
        status="404"
        title="Receipt Not Found"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => navigate(session.user.role === "admin" ? "/admin" : "/orders")}>
            Go Back
          </Button>
        }
      />
    )
  }

  const totalQty = order.items.reduce((acc, i) => acc + i.quantity_kg, 0)

  return (
    <div>
      <Flex justify="space-between" align="center" className="no-print" style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate(session.user.role === "admin" ? "/admin" : "/orders")}>
          ← Back to {session.user.role === "admin" ? "Administration" : "Order History"}
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Print Receipt
        </Button>
      </Flex>

      <div className="printable-document">
        <Flex justify="space-between" align="start" wrap="wrap" gap={16}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              🌾 Haat_Bazar (হাট বাজার)
            </Typography.Title>
            <Typography.Text type="secondary">
              Direct Farm-to-Consumer Purchase Receipt
            </Typography.Text>
          </div>
          <div style={{ textAlign: "right" }}>
            <Tag color="green" style={{ fontSize: 13 }}>
              {order.status.toUpperCase()}
            </Tag>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{order.receipt_number}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{when(order.created_at)}</div>
          </div>
        </Flex>

        <Divider />

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Consumer">{order.consumer_name}</Descriptions.Item>
          <Descriptions.Item label="Email">{order.consumer_email}</Descriptions.Item>
          <Descriptions.Item label="Order Tier">{order.order_tier}</Descriptions.Item>
          <Descriptions.Item label="Collection Method">
            {order.fulfillment_type === "pickup"
              ? "Fresh Hub Pickup"
              : `Home Delivery (${order.distance_km} km)`}
          </Descriptions.Item>
          <Descriptions.Item label="Total Weight">{totalQty} kg</Descriptions.Item>
          <Descriptions.Item label="Notes">{order.notes || "—"}</Descriptions.Item>
        </Descriptions>

        <Table
          dataSource={order.items}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: "Product", dataIndex: "commodity_name" },
            { title: "Type", dataIndex: "category" },
            { title: "Grower / Farmer", dataIndex: "farmer_name" },
            { title: "Collection Hub", dataIndex: "hub_name" },
            {
              title: "Qty (kg)",
              dataIndex: "quantity_kg",
              render: (v: number) => <strong>{v} kg</strong>,
            },
            {
              title: "Price / kg",
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

        <div style={{ maxWidth: 340, marginLeft: "auto", marginTop: 20 }}>
          <Flex justify="space-between" style={{ marginBottom: 6 }}>
            <span>Produce Subtotal:</span>
            <strong>৳ {order.subtotal.toLocaleString()}</strong>
          </Flex>
          <Flex justify="space-between" style={{ marginBottom: 6 }}>
            <span>Service Fee:</span>
            <span>৳ {order.service_fee.toLocaleString()}</span>
          </Flex>
          <Flex justify="space-between" style={{ marginBottom: 6 }}>
            <span>Delivery Fee:</span>
            <span>৳ {order.delivery_fee.toLocaleString()}</span>
          </Flex>
          <Divider style={{ margin: "8px 0" }} />
          <Flex justify="space-between" align="baseline">
            <Typography.Text strong style={{ fontSize: 16 }}>
              Grand Total:
            </Typography.Text>
            <Typography.Title level={3} style={{ margin: 0, color: "#389e0d" }}>
              ৳ {order.total_amount.toLocaleString()}
            </Typography.Title>
          </Flex>
        </div>
      </div>
    </div>
  )
}
