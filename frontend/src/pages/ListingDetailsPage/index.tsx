import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons"
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Flex,
  Popconfirm,
  Progress,
  Radio,
  Result,
  Row,
  Slider,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { ListingForm } from "../../components/ListingForm"
import { apiService } from "../../services/api"
import type {
  ListingInput,
  ProductListing,
  QualityGrade,
} from "../../types/listing"

const gradeColors: Record<QualityGrade, string> = {
  GRADE_A: "green",
  GRADE_B: "blue",
  GRADE_C_PROCESSING: "orange",
}

export function ListingDetailsPage() {
  const { listingId } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()

  const [listing, setListing] = useState<ProductListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Live Pricing Engine Calculator State (Section 3 of README)
  const [orderTier, setOrderTier] = useState<"B2C" | "B2B">("B2C")
  const [orderQty, setOrderQty] = useState<number>(5)
  const [estDistanceKm, setEstDistanceKm] = useState<number>(15)

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const data = await apiService.getListing(listingId ?? "")
        setListing(data)
        setOrderQty(data.b2c_moq_kg || 2)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load listing")
      } finally {
        setLoading(false)
      }
    }
    fetchItem()
  }, [listingId])

  // Update order quantity when switching between B2C and B2B
  const handleTierChange = (tier: "B2C" | "B2B") => {
    setOrderTier(tier)
    if (!listing) return
    if (tier === "B2B") {
      setOrderQty(Math.max(listing.b2b_moq_kg, 50))
    } else {
      setOrderQty(Math.max(listing.b2c_moq_kg, 2))
    }
  }

  // Update Handler (CRUD: Update)
  const handleUpdate = async (values: ListingInput) => {
    if (!listing) return
    setSaving(true)
    try {
      const updated = await apiService.updateListing(listing.id, values)
      setListing(updated)
      setIsEditing(false)
      message.success("Batch listing updated successfully")
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update listing")
    } finally {
      setSaving(false)
    }
  }

  // Delete Handler (CRUD: Delete)
  const handleDelete = async () => {
    if (!listing) return
    try {
      await apiService.deleteListing(listing.id)
      message.success("Produce batch listing deleted")
      navigate("/")
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to delete listing")
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <Spin size="large" tip="Loading produce details..." />
      </div>
    )
  }

  if (!listing) {
    return (
      <Result
        status="404"
        title="Produce Batch Not Found"
        subTitle={error || `Listing #${listingId} does not exist.`}
        extra={
          <Button type="primary" onClick={() => navigate("/")}>
            Back to Listings
          </Button>
        }
      />
    )
  }

  // Pricing Engine Calculations (Section 3 of README)
  const U = listing.farmer_unit_price
  const Q = Math.min(orderQty, listing.available_qty_kg || orderQty)
  const P_farmer = Q * U

  // Alpha commission: 5% B2C, 2.5% B2B
  const alpha = orderTier === "B2C" ? 0.05 : 0.025
  const S_min = orderTier === "B2C" ? 20 : 100
  const F_service = Math.max(S_min, Math.round(P_farmer * alpha))

  // Delivery Fee: B_base + (d * C_dist) + (w * C_weight)
  const B_base = orderTier === "B2C" ? 40 : 250
  const C_dist = 2.5 // ৳2.5/km
  const C_weight = orderTier === "B2C" ? 1.5 : 0.8 // ৳/kg
  const F_delivery = Math.round(B_base + estDistanceKm * C_dist + Q * C_weight)

  const P_buyer = P_farmer + F_service + F_delivery

  // MOQ & MOV Validations
  const moqRequired = orderTier === "B2C" ? listing.b2c_moq_kg : listing.b2b_moq_kg
  const movRequired = orderTier === "B2C" ? 500 : 5000
  const passesMoq = Q >= moqRequired
  const passesMov = P_farmer >= movRequired

  return (
    <>
      {/* Back Button */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/")}
        style={{ paddingLeft: 0, marginBottom: 16 }}
      >
        Back to Batch Listings
      </Button>

      {/* Header bar */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={12} style={{ marginBottom: 20 }}>
        <div>
          <Flex align="center" gap={10} wrap="wrap">
            <Typography.Title level={2} style={{ margin: 0 }}>
              {listing.commodity_name}
            </Typography.Title>
            <Tag color={gradeColors[listing.grade]} style={{ fontSize: 13, padding: "2px 8px" }}>
              {listing.grade.replace("_", " ")}
            </Tag>
            <Tag color="cyan">{listing.category}</Tag>
            <Badge
              status={listing.is_active ? "success" : "default"}
              text={listing.is_active ? "Active Marketplace Listing" : "Inactive / Suspended"}
            />
          </Flex>
          <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
            Batch UUID: <code style={{ fontSize: 12 }}>{listing.id}</code>
          </Typography.Paragraph>
        </div>

        <Space>
          {!isEditing ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => setIsEditing(true)}>
                Edit Batch Details
              </Button>
              <Popconfirm
                title="Delete this listing?"
                description="This will permanently delete the batch listing from the repository."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={handleDelete}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            </>
          ) : (
            <Button onClick={() => setIsEditing(false)}>Cancel Edit</Button>
          )}
        </Space>
      </Flex>

      {/* Editing View */}
      {isEditing ? (
        <Card title="Update Produce Batch Information">
          <ListingForm
            initialValues={listing}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            loading={saving}
            submitText="Save Changes (PATCH)"
          />
        </Card>
      ) : (
        /* Read Single View */
        <Row gutter={[20, 20]}>
          {/* Main Details Column */}
          <Col xs={24} lg={15}>
            <Card
              title={
                <Flex align="center" gap={8}>
                  <SafetyCertificateOutlined style={{ color: "#52c41a" }} />
                  <span>Verified Batch Specifications</span>
                </Flex>
              }
              style={{ marginBottom: 20 }}
            >
              <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Producer / Farmer">
                  <UserOutlined style={{ marginRight: 6 }} />
                  <strong>{listing.farmer_name}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Regional Hub">
                  <EnvironmentOutlined style={{ marginRight: 6 }} />
                  {listing.hub_name}
                </Descriptions.Item>
                <Descriptions.Item label="Farmer Base Price">
                  <strong style={{ color: "#389e0d", fontSize: 16 }}>
                    ৳ {listing.farmer_unit_price} / kg
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="Harvest Date">
                  {listing.harvest_date}
                </Descriptions.Item>
                <Descriptions.Item label="Total Batch Yield">
                  {listing.total_yield_kg} kg
                </Descriptions.Item>
                <Descriptions.Item label="Available Stock">
                  <strong style={{ color: listing.available_qty_kg > 0 ? "#1890ff" : "#f5222d" }}>
                    {listing.available_qty_kg} kg
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="B2C MOQ (Retail)">
                  {listing.b2c_moq_kg} kg
                </Descriptions.Item>
                <Descriptions.Item label="B2B MOQ (Wholesale)">
                  {listing.b2b_moq_kg} kg
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {new Date(listing.created_at).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {new Date(listing.updated_at).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Agronomic Notes" span={2}>
                  {listing.description || "No additional producer notes recorded."}
                </Descriptions.Item>
              </Descriptions>

              {/* Volume Progress */}
              <div style={{ marginTop: 20 }}>
                <Typography.Text strong>Inventory Stock Availability:</Typography.Text>
                <Progress
                  percent={
                    listing.total_yield_kg > 0
                      ? Math.round((listing.available_qty_kg / listing.total_yield_kg) * 100)
                      : 0
                  }
                  status={listing.available_qty_kg > 0 ? "active" : "exception"}
                  strokeColor="#52c41a"
                />
              </div>
            </Card>

            {/* Anti-Loss Guard Breakdown */}
            <Card title="Anti-Loss Guard & Dynamic Unit Economics" size="small">
              <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                Under traditional supply chains, small fragmented drops cause middleman gouging. Haat_Bazar enforces mathematical constraints (Qi &gt;= MOQ) and Minimum Order Value (MOV) to ensure transport viability.
              </Typography.Paragraph>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ background: "#f6ffed", border: "1px solid #b7eb8f", padding: 12, borderRadius: 6 }}>
                    <Typography.Text strong style={{ color: "#389e0d" }}>
                      B2C Household Tier
                    </Typography.Text>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      • Per-SKU MOQ: {listing.b2c_moq_kg} kg<br />
                      • Basket MOV: ৳ 500<br />
                      • Platform Fee: 5.0%
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: "#e6f7ff", border: "1px solid #91d5ff", padding: 12, borderRadius: 6 }}>
                    <Typography.Text strong style={{ color: "#096dd9" }}>
                      B2B Bulk Wholesale Tier
                    </Typography.Text>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      • Per-SKU MOQ: {listing.b2b_moq_kg} kg<br />
                      • Basket MOV: ৳ 5,000<br />
                      • Platform Fee: 2.5%
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Right Column: Mathematical & Pricing Engine Interactive Simulator */}
          <Col xs={24} lg={9}>
            <Card
              className="calculator-card"
              title={
                <Flex align="center" gap={8}>
                  <CalculatorOutlined style={{ color: "#389e0d" }} />
                  <span>Pricing Engine Simulator</span>
                </Flex>
              }
            >
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                Live calculation of formula (Section 3 of README):
                <br />
                <code>P_buyer = P_farmer + F_service + F_delivery</code>
              </Typography.Paragraph>

              <Divider style={{ margin: "12px 0" }} />

              {/* Order Tier Select */}
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                  Select Buyer Tier:
                </Typography.Text>
                <Radio.Group
                  value={orderTier}
                  onChange={(e) => handleTierChange(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <Radio.Button value="B2C" style={{ width: "50%", textAlign: "center" }}>
                    B2C (Retail)
                  </Radio.Button>
                  <Radio.Button value="B2B" style={{ width: "50%", textAlign: "center" }}>
                    B2B (Wholesale)
                  </Radio.Button>
                </Radio.Group>
              </div>

              {/* Quantity Slider */}
              <div style={{ marginBottom: 16 }}>
                <Flex justify="space-between">
                  <Typography.Text strong>Order Quantity (kg):</Typography.Text>
                  <strong>{Q} kg</strong>
                </Flex>
                <Slider
                  min={orderTier === "B2C" ? 1 : 10}
                  max={Math.max(listing.available_qty_kg || 100, 100)}
                  value={Q}
                  onChange={(val) => setOrderQty(val)}
                />
                <Flex justify="space-between" style={{ fontSize: 11, color: "#8c8c8c" }}>
                  <span>Min: {moqRequired} kg</span>
                  <span>Stock: {listing.available_qty_kg} kg</span>
                </Flex>
              </div>

              {/* Distance Slider */}
              <div style={{ marginBottom: 16 }}>
                <Flex justify="space-between">
                  <Typography.Text strong>Est. Hub Distance:</Typography.Text>
                  <strong>{estDistanceKm} km</strong>
                </Flex>
                <Slider
                  min={2}
                  max={120}
                  value={estDistanceKm}
                  onChange={(val) => setEstDistanceKm(val)}
                />
              </div>

              {/* Validation Badges */}
              <div style={{ marginBottom: 16 }}>
                <Flex gap={8} wrap="wrap">
                  <Tag
                    icon={passesMoq ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    color={passesMoq ? "success" : "error"}
                  >
                    MOQ ({moqRequired} kg): {passesMoq ? "Passed" : "Below Minimum"}
                  </Tag>
                  <Tag
                    icon={passesMov ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    color={passesMov ? "success" : "warning"}
                  >
                    MOV (৳{movRequired}): {passesMov ? "Passed" : "Below MOV"}
                  </Tag>
                </Flex>
              </div>

              {/* Breakdown Table */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #d9d9d9",
                  marginBottom: 16,
                }}
              >
                <Flex justify="space-between" style={{ marginBottom: 6 }}>
                  <span>Farmer Payout (Q × U):</span>
                  <strong>৳ {P_farmer.toLocaleString()}</strong>
                </Flex>
                <Flex justify="space-between" style={{ marginBottom: 6, fontSize: 13 }}>
                  <span>
                    Service Fee (α={alpha * 100}%):
                  </span>
                  <span>+ ৳ {F_service.toLocaleString()}</span>
                </Flex>
                <Flex justify="space-between" style={{ marginBottom: 6, fontSize: 13 }}>
                  <span>Delivery Fee:</span>
                  <span>+ ৳ {F_delivery.toLocaleString()}</span>
                </Flex>
                <Divider style={{ margin: "8px 0" }} />
                <Flex justify="space-between" align="baseline">
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    Total Buyer Bill:
                  </Typography.Text>
                  <Typography.Title level={3} style={{ margin: 0, color: "#237804" }}>
                    ৳ {P_buyer.toLocaleString()}
                  </Typography.Title>
                </Flex>
              </div>

              <Alert
                message="Farmer Direct Liquidity"
                description={`The farmer directly captures ৳${P_farmer.toLocaleString()} (${Math.round((P_farmer / P_buyer) * 100)}% of total transaction) via mobile financial escrow upon hub scan.`}
                type="success"
                showIcon
              />
            </Card>
          </Col>
        </Row>
      )}
    </>
  )
}
