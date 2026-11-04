import {
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import { Col, Input, Radio, Row, Select, Switch, Typography } from "antd"

export interface FilterValues {
  search: string
  category: string
  grade: string
  onlyActive: boolean
  viewMode: "grid" | "table"
}

interface ListingFilterProps {
  values: FilterValues
  onChange: (patch: Partial<FilterValues>) => void
}

const CATEGORIES = [
  "ALL",
  "Vegetables",
  "Tubers",
  "Fruits",
  "Grains",
  "Leafy Greens",
  "Spices",
]

const GRADES = [
  { label: "All Grades", value: "ALL" },
  { label: "Grade A (Export / Retail)", value: "GRADE_A" },
  { label: "Grade B (Standard Market)", value: "GRADE_B" },
  { label: "Grade C (Processing / Bulk)", value: "GRADE_C_PROCESSING" },
]

export function ListingFilter({ values, onChange }: ListingFilterProps) {
  return (
    <div
      style={{
        padding: "16px",
        marginBottom: 20,
        background: "rgba(0, 0, 0, 0.02)",
        borderRadius: 8,
        border: "1px solid rgba(0, 0, 0, 0.06)",
      }}
    >
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} md={8}>
          <Input
            placeholder="Search commodity, farmer, or regional hub..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            allowClear
            value={values.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </Col>

        <Col xs={12} sm={6} md={5}>
          <Select
            style={{ width: "100%" }}
            value={values.category}
            onChange={(cat) => onChange({ category: cat })}
            options={CATEGORIES.map((cat) => ({
              label: cat === "ALL" ? "All Categories" : cat,
              value: cat,
            }))}
          />
        </Col>

        <Col xs={12} sm={6} md={5}>
          <Select
            style={{ width: "100%" }}
            value={values.grade}
            onChange={(grd) => onChange({ grade: grd })}
            options={GRADES}
          />
        </Col>

        <Col xs={14} sm={7} md={4}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Switch
              size="small"
              checked={values.onlyActive}
              onChange={(checked) => onChange({ onlyActive: checked })}
            />
            <Typography.Text style={{ fontSize: 13 }}>
              {values.onlyActive ? "Active only" : "Include inactive"}
            </Typography.Text>
          </div>
        </Col>

        <Col xs={10} sm={5} md={2} style={{ textAlign: "right" }}>
          <Radio.Group
            size="small"
            value={values.viewMode}
            onChange={(e) => onChange({ viewMode: e.target.value })}
          >
            <Radio.Button value="grid">
              <AppstoreOutlined />
            </Radio.Button>
            <Radio.Button value="table">
              <BarsOutlined />
            </Radio.Button>
          </Radio.Group>
        </Col>
      </Row>
    </div>
  )
}
