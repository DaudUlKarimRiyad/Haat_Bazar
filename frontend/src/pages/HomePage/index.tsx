import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EyeOutlined,
  InboxOutlined,
  PlusOutlined,
} from "@ant-design/icons"
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Modal,
  Popconfirm,
  Row,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { ListingCard } from "../../components/ListingCard"
import { ListingFilter, type FilterValues } from "../../components/ListingFilter"
import { ListingForm } from "../../components/ListingForm"
import { ListingStats } from "../../components/ListingStats"
import { PAGE_SIZE, apiService } from "../../services/api"
import type { ListingInput, ProductListing, QualityGrade } from "../../types/listing"

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : "An unexpected error occurred"

export function HomePage() {
  const navigate = useNavigate()
  const { message } = AntApp.useApp()

  const [listings, setListings] = useState<ProductListing[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    category: "ALL",
    grade: "ALL",
    onlyActive: false,
    viewMode: "grid",
  })

  // Reload data from API service
  const reload = async () => {
    try {
      const page = await apiService.getListings(0, 100)
      setListings(page.items)
      setTotal(page.total)
    } catch (err) {
      setError(messageOf(err))
    }
  }

  useEffect(() => {
    const loadOnMount = async () => {
      setLoading(true)
      await reload()
      setLoading(false)
    }
    loadOnMount()
  }, [])

  // Sync document title with active listings count
  useEffect(() => {
    const activeCount = listings.filter((l) => l.is_active).length
    document.title =
      activeCount > 0
        ? `(${activeCount}) Haat_Bazar • Produce Listings`
        : "Haat_Bazar • Direct Agri Marketplace"
  }, [listings])

  // Run operation wrapper with message feedback
  const run = async (
    action: () => Promise<unknown>,
    successMsg: string
  ): Promise<boolean> => {
    try {
      await action()
      await reload()
      message.success(successMsg)
      return true
    } catch (err) {
      message.error(messageOf(err))
      return false
    }
  }

  // CRUD Operations
  const handleCreate = async (data: ListingInput) => {
    setSubmitting(true)
    const ok = await run(
      () => apiService.createListing(data),
      `Successfully listed ${data.commodity_name}`
    )
    setSubmitting(false)
    if (ok) setIsModalOpen(false)
  }

  const handleToggleActive = (listing: ProductListing) => {
    return run(
      () =>
        apiService.updateListing(listing.id, {
          is_active: !listing.is_active,
        }),
      listing.is_active ? "Batch marked as Inactive" : "Batch activated on market"
    )
  }

  const handleDelete = (id: string) => {
    return run(() => apiService.deleteListing(id), "Produce batch deleted")
  }

  const handleResetDemo = async () => {
    await run(() => apiService.resetDemoData(), "Demo dataset reset to initial state")
  }

  // Filter listings client-side
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (filters.onlyActive && !item.is_active) return false
      if (filters.category !== "ALL" && item.category !== filters.category)
        return false
      if (filters.grade !== "ALL" && item.grade !== filters.grade) return false
      if (filters.search) {
        const query = filters.search.toLowerCase()
        const matchesName = item.commodity_name.toLowerCase().includes(query)
        const matchesFarmer = item.farmer_name.toLowerCase().includes(query)
        const matchesHub = item.hub_name.toLowerCase().includes(query)
        if (!matchesName && !matchesFarmer && !matchesHub) return false
      }
      return true
    })
  }, [listings, filters])

  // Table columns for table view mode
  const tableColumns = [
    {
      title: "Commodity",
      dataIndex: "commodity_name",
      key: "commodity_name",
      render: (name: string, record: ProductListing) => (
        <a
          onClick={() => navigate(`/listings/${record.id}`)}
          style={{ fontWeight: 600 }}
        >
          {name}
        </a>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (cat: string) => <Tag color="cyan">{cat}</Tag>,
    },
    {
      title: "Grade",
      dataIndex: "grade",
      key: "grade",
      render: (grade: QualityGrade) => {
        const color =
          grade === "GRADE_A"
            ? "green"
            : grade === "GRADE_B"
            ? "blue"
            : "orange"
        return <Tag color={color}>{grade.replace("_", " ")}</Tag>
      },
    },
    {
      title: "Farmer & Hub",
      key: "farmer_hub",
      render: (_: unknown, record: ProductListing) => (
        <div>
          <div>{record.farmer_name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.hub_name}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Farmer Price",
      dataIndex: "farmer_unit_price",
      key: "farmer_unit_price",
      render: (p: number) => (
        <strong style={{ color: "#389e0d" }}>৳ {p} / kg</strong>
      ),
    },
    {
      title: "Available / Total",
      key: "stock",
      render: (_: unknown, record: ProductListing) => (
        <span>
          {record.available_qty_kg} / {record.total_yield_kg} kg
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean, record: ProductListing) => (
        <Switch
          size="small"
          checked={active}
          onChange={() => handleToggleActive(record)}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: ProductListing) => (
        <Flex gap={8}>
          <Button
            size="small"
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/listings/${record.id}`)}
          />
          <Popconfirm
            title="Delete batch listing?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Flex>
      ),
    },
  ]

  return (
    <>
      {/* Banner / Header */}
      <div className="haat-banner">
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Typography.Title
              level={2}
              style={{ color: "#ffffff", margin: "0 0 8px" }}
            >
              Haat_Bazar (হাট বাজার) 🌾
            </Typography.Title>
            <Typography.Paragraph
              style={{
                color: "#f6ffed",
                margin: 0,
                fontSize: 15,
                maxWidth: 620,
              }}
            >
              Direct Farm-to-Consumer & Bulk Wholesale Marketplace.
              Disintermediating rural middlemen (Dalals/Farias) to empower farmers
              with transparent pricing, digital grading, and automated escrow.
            </Typography.Paragraph>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: "right" }}>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              style={{
                background: "#ffffff",
                color: "#135200",
                fontWeight: 600,
                border: "none",
                boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              }}
              onClick={() => setIsModalOpen(true)}
            >
              Add Produce Batch
            </Button>
          </Col>
        </Row>
      </div>

      {error && (
        <Alert
          type="error"
          message="Communication Notice"
          description={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Summary Statistics */}
      <ListingStats
        listings={listings}
        total={total}
        onResetDemo={handleResetDemo}
      />

      {/* Filters and Search Bar */}
      <ListingFilter
        values={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      />

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <Spin size="large" tip="Loading produce batch listings..." />
        </div>
      ) : filteredListings.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No produce batches match your filter criteria"
        >
          <Button type="primary" onClick={() => setIsModalOpen(true)}>
            List First Produce Batch
          </Button>
        </Empty>
      ) : filters.viewMode === "grid" ? (
        <Row gutter={[16, 16]}>
          {filteredListings.map((listing) => (
            <Col xs={24} sm={12} lg={8} key={listing.id}>
              <ListingCard
                listing={listing}
                onView={(id) => navigate(`/listings/${id}`)}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Card bordered={false} bodyStyle={{ padding: 0 }}>
          <Table
            dataSource={filteredListings}
            columns={tableColumns}
            rowKey="id"
            pagination={{ pageSize: PAGE_SIZE }}
          />
        </Card>
      )}

      {/* Quick Add Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AppstoreAddOutlined style={{ color: "#52c41a" }} />
            <span>List New Agricultural Produce Batch</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        <ListingForm
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
          loading={submitting}
          submitText="Publish Produce Batch"
        />
      </Modal>
    </>
  )
}
