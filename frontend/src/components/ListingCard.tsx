import {
  CalendarOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  UserOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Flex,
  Popconfirm,
  Progress,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd"
import type { ProductListing, QualityGrade } from "../types/listing"

interface ListingCardProps {
  listing: ProductListing
  onView: (id: string) => void
  onToggleActive: (listing: ProductListing) => void
  onDelete: (id: string) => void
}

const gradeTagColor = (grade: QualityGrade) => {
  switch (grade) {
    case "GRADE_A":
      return "green"
    case "GRADE_B":
      return "geekblue"
    case "GRADE_C_PROCESSING":
      return "orange"
    default:
      return "default"
  }
}

const gradeLabel = (grade: QualityGrade) => {
  switch (grade) {
    case "GRADE_A":
      return "Grade A (Retail/Export)"
    case "GRADE_B":
      return "Grade B (Standard)"
    case "GRADE_C_PROCESSING":
      return "Grade C (Processing)"
    default:
      return grade
  }
}

export function ListingCard({
  listing,
  onView,
  onToggleActive,
  onDelete,
}: ListingCardProps) {
  const percentAvailable =
    listing.total_yield_kg > 0
      ? Math.round((listing.available_qty_kg / listing.total_yield_kg) * 100)
      : 0

  return (
    <Card
      hoverable
      size="small"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        opacity: listing.is_active ? 1 : 0.65,
        borderColor: listing.is_active ? undefined : "#d9d9d9",
      }}
      bodyStyle={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "16px",
      }}
    >
      {/* Top Header Tags */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
        <Space size={4}>
          <Tag color="cyan">{listing.category}</Tag>
          <Tag color={gradeTagColor(listing.grade)}>
            {gradeLabel(listing.grade)}
          </Tag>
        </Space>
        <Space size={6}>
          <Switch
            size="small"
            checked={listing.is_active}
            onChange={() => onToggleActive(listing)}
            title={listing.is_active ? "Active listing" : "Inactive / Sold out"}
          />
        </Space>
      </Flex>

      {/* Commodity Title */}
      <Typography.Title
        level={4}
        style={{
          margin: "0 0 6px",
          fontSize: 17,
          cursor: "pointer",
        }}
        onClick={() => onView(listing.id)}
      >
        {listing.commodity_name}
      </Typography.Title>

      {/* Farmer & Hub Metadata */}
      <div style={{ marginBottom: 12, fontSize: 13, color: "#595959" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <UserOutlined style={{ color: "#8c8c8c" }} />
          <span>{listing.farmer_name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <EnvironmentOutlined style={{ color: "#8c8c8c" }} />
          <span>{listing.hub_name}</span>
        </div>
      </div>

      {/* Pricing & Volume */}
      <div
        style={{
          background: "rgba(0,0,0,0.03)",
          padding: "10px 12px",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <Flex justify="space-between" align="baseline">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Farmer Base Price
          </Typography.Text>
          <Typography.Title
            level={4}
            style={{ margin: 0, color: "#389e0d", fontWeight: 700 }}
          >
            ৳ {listing.farmer_unit_price}{" "}
            <span style={{ fontSize: 12, fontWeight: "normal", color: "#8c8c8c" }}>
              / kg
            </span>
          </Typography.Title>
        </Flex>

        {/* Available Stock Indicator */}
        <div style={{ marginTop: 8 }}>
          <Flex justify="space-between" style={{ fontSize: 12, marginBottom: 2 }}>
            <span>Available / Total</span>
            <strong>
              {listing.available_qty_kg} / {listing.total_yield_kg} kg
            </strong>
          </Flex>
          <Progress
            percent={percentAvailable}
            size="small"
            status={listing.available_qty_kg === 0 ? "exception" : "active"}
            strokeColor={listing.available_qty_kg > 0 ? "#52c41a" : "#f5222d"}
          />
        </div>
      </div>

      {/* Anti-Loss Guard MOQ Badges */}
      <Flex wrap="wrap" gap={4} style={{ marginBottom: 12, fontSize: 12 }}>
        <Tag style={{ margin: 0, fontSize: 11 }}>
          B2C MOQ: <strong>{listing.b2c_moq_kg} kg</strong>
        </Tag>
        <Tag style={{ margin: 0, fontSize: 11 }}>
          B2B MOQ: <strong>{listing.b2b_moq_kg} kg</strong>
        </Tag>
      </Flex>

      {/* Harvest Date */}
      <div
        style={{
          fontSize: 12,
          color: "#8c8c8c",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <CalendarOutlined />
        <span>Harvest: {listing.harvest_date}</span>
      </div>

      {/* Spacer to push actions to bottom */}
      <div style={{ flex: 1 }} />

      {/* Card Action Buttons */}
      <Flex gap={8} style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10 }}>
        <Button
          type="primary"
          icon={<EyeOutlined />}
          style={{ flex: 1 }}
          onClick={() => onView(listing.id)}
        >
          View Details
        </Button>
        <Popconfirm
          title="Delete Batch Listing"
          description="Are you sure you want to delete this produce batch listing?"
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDelete(listing.id)}
        >
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Flex>
    </Card>
  )
}
