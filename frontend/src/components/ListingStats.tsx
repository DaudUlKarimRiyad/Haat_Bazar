import {
  DollarCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  TagsOutlined,
} from "@ant-design/icons"
import { Button, Card, Col, Popconfirm, Row, Statistic } from "antd"
import type { ProductListing } from "../types/listing"

interface ListingStatsProps {
  listings: ProductListing[]
  total: number
  onResetDemo: () => void
}

export function ListingStats({ listings, total, onResetDemo }: ListingStatsProps) {
  const activeListings = listings.filter((l) => l.is_active)
  const totalVolumeKg = activeListings.reduce(
    (acc, l) => acc + (Number(l.available_qty_kg) || 0),
    0
  )
  const avgPrice =
    activeListings.length > 0
      ? (
          activeListings.reduce(
            (acc, l) => acc + (Number(l.farmer_unit_price) || 0),
            0
          ) / activeListings.length
        ).toFixed(1)
      : "0"

  const uniqueCategories = new Set(listings.map((l) => l.category)).size

  return (
    <div style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" bordered hoverable>
            <Statistic
              title="Active Produce Batches"
              value={activeListings.length}
              suffix={`/ ${total}`}
              prefix={<InboxOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card size="small" bordered hoverable>
            <Statistic
              title="Total Available Volume"
              value={
                totalVolumeKg >= 1000
                  ? `${(totalVolumeKg / 1000).toFixed(2)} Ton`
                  : `${totalVolumeKg.toLocaleString()} kg`
              }
              prefix={<InboxOutlined style={{ color: "#1890ff" }} />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card size="small" bordered hoverable>
            <Statistic
              title="Avg Farmer Unit Price"
              value={avgPrice}
              prefix={<DollarCircleOutlined style={{ color: "#faad14" }} />}
              suffix="৳ / kg"
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card size="small" bordered hoverable>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Statistic
                title="Commodity Categories"
                value={uniqueCategories}
                prefix={<TagsOutlined style={{ color: "#722ed1" }} />}
              />
              <Popconfirm
                title="Reset demo data to initial seed?"
                okText="Reset"
                onConfirm={onResetDemo}
              >
                <Button size="small" icon={<ReloadOutlined />} type="text" title="Reset Demo Data" />
              </Popconfirm>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
