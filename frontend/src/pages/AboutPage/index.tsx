import {
  ApiOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  GithubOutlined,
  GlobalOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import { Card, Col, Descriptions, Divider, Row, Tag, Timeline, Typography } from "antd"

export function AboutPage() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Typography.Title level={2}>About Haat_Bazar (হাট বাজার) 🌾🛒</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ fontSize: 16 }}>
        Haat_Bazar is an agricultural disintermediation marketplace designed to eliminate informal handling layers (such as rural Dalals and Farias) across South Asia, connecting smallholder farmers directly with retail consumers (B2C) and institutional wholesalers (B2B).
      </Typography.Paragraph>

      <Divider />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TeamOutlined style={{ color: "#52c41a" }} />
                <span>Structural Disintermediation</span>
              </div>
            }
            size="small"
          >
            <Typography.Paragraph style={{ fontSize: 13 }}>
              In traditional supply chains, produce traverses 4 to 6 informal handling layers:
            </Typography.Paragraph>
            <Timeline
              items={[
                { children: "Farmer (20–35% value capture)" },
                { color: "red", children: "Dalal / Local Middleman (Informal loan lock-in)" },
                { color: "red", children: "Bepari (Secondary aggregator)" },
                { color: "red", children: "Aratdar (Commission warehouseman)" },
                { color: "red", children: "Paikar / Secondary Wholesaler" },
                { children: "Consumer / Retail Household" },
              ]}
            />
            <Typography.Text type="success" strong>
              Haat_Bazar bypasses the intermediate layers directly to Collection Hubs.
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ApiOutlined style={{ color: "#1890ff" }} />
                <span>Implemented CRUD REST API</span>
              </div>
            }
            size="small"
          >
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={<Tag color="green">GET</Tag>}>
                <code>/api/v1/listings</code> (List all batches with pagination & filters)
              </Descriptions.Item>
              <Descriptions.Item label={<Tag color="blue">POST</Tag>}>
                <code>/api/v1/listings</code> (Create new produce batch)
              </Descriptions.Item>
              <Descriptions.Item label={<Tag color="cyan">GET</Tag>}>
                <code>/api/v1/listings/:id</code> (Read single batch specifications)
              </Descriptions.Item>
              <Descriptions.Item label={<Tag color="orange">PATCH</Tag>}>
                <code>/api/v1/listings/:id</code> (Update pricing, availability, status)
              </Descriptions.Item>
              <Descriptions.Item label={<Tag color="red">DELETE</Tag>}>
                <code>/api/v1/listings/:id</code> (Delete listing)
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Typography.Title level={3}>Technology Stack</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Typography.Text strong>Frontend UI</Typography.Text>
            <div style={{ color: "#595959", fontSize: 13, marginTop: 4 }}>
              React 19, TypeScript, Vite, Ant Design (AntD), React Router
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Typography.Text strong>Backend API</Typography.Text>
            <div style={{ color: "#595959", fontSize: 13, marginTop: 4 }}>
              Python FastAPI, Pydantic v2, Uvicorn, RESTful Controller-Service Architecture
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Typography.Text strong>Database</Typography.Text>
            <div style={{ color: "#595959", fontSize: 13, marginTop: 4 }}>
              SQLModel / SQLAlchemy, PostgreSQL + PostGIS (Production), SQLite (Dev)
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Typography.Text strong>Deployment</Typography.Text>
            <div style={{ color: "#595959", fontSize: 13, marginTop: 4 }}>
              Vercel Serverless (Frontend + FastAPI backend via vercel.json)
            </div>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Typography.Title level={3}>Viva & Demo Checklist</Typography.Title>
      <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 8 }}>
        <p><CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} /><strong>Frontend CRUD:</strong> Full Create, Read List, Read Single, Update, Delete for Agricultural Produce Listings.</p>
        <p><CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} /><strong>Developer Tools Request Flow:</strong> Observe Network tab for API payloads, response JSON, and status codes (200, 201, 204, 404, 422).</p>
        <p><CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} /><strong>Mathematical Model:</strong> Interactive Pricing Engine verifying <code>P_buyer = P_farmer + F_service + F_delivery</code> alongside Anti-Loss Guard MOQs.</p>
        <p><CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} /><strong>Postman Ready:</strong> Clean OpenAPI specs readily testable in Postman.</p>
      </div>
    </div>
  )
}
