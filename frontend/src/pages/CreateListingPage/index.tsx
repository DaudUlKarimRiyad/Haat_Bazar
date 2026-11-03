import { ArrowLeftOutlined, PlusCircleOutlined } from "@ant-design/icons"
import { App as AntApp, Button, Card, Flex, Typography } from "antd"
import { useState } from "react"
import { useNavigate } from "react-router"
import { ListingForm } from "../../components/ListingForm"
import { apiService } from "../../services/api"
import type { ListingInput } from "../../types/listing"

export function CreateListingPage() {
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async (data: ListingInput) => {
    setSubmitting(true)
    try {
      const created = await apiService.createListing(data)
      message.success(`Produce batch '${created.commodity_name}' published successfully!`)
      navigate(`/listings/${created.id}`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to publish listing")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/")}
        style={{ paddingLeft: 0, marginBottom: 16 }}
      >
        Back to Batch Listings
      </Button>

      <Card
        title={
          <Flex align="center" gap={10}>
            <PlusCircleOutlined style={{ color: "#52c41a", fontSize: 20 }} />
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                List New Produce Batch
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: "normal" }}>
                Connect rural farmers directly with households and wholesale institutions
              </Typography.Text>
            </div>
          </Flex>
        }
      >
        <ListingForm
          onSubmit={handleCreate}
          onCancel={() => navigate("/")}
          loading={submitting}
          submitText="Publish Batch to Marketplace (POST)"
        />
      </Card>
    </div>
  )
}
