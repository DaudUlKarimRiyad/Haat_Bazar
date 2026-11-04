import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
} from "antd"
import dayjs from "dayjs"
import { useEffect } from "react"
import type { ListingInput, ProductListing } from "../types/listing"

interface ListingFormProps {
  initialValues?: ProductListing | null
  onSubmit: (values: ListingInput) => Promise<boolean | void>
  onCancel?: () => void
  loading?: boolean
  submitText?: string
}

const CATEGORIES = [
  "Vegetables",
  "Tubers",
  "Fruits",
  "Grains",
  "Leafy Greens",
  "Spices",
]

const HUBS = [
  "Bogura Central Hub",
  "Bogura Shibganj Hub",
  "Rajshahi Godagari Hub",
  "Dinajpur Sadar Hub",
  "Faridpur Modhukhali Hub",
  "Jashore Monirampur Hub",
  "Rangpur Mithapukur Hub",
  "Mymensingh Trishal Hub",
  "Narsingdi Shibpur Hub",
]

const GRADES = [
  { label: "Grade A (Retail / Export Quality)", value: "GRADE_A" },
  { label: "Grade B (Standard Market)", value: "GRADE_B" },
  { label: "Grade C (Processing / Industrial Bulk)", value: "GRADE_C_PROCESSING" },
]

export function ListingForm({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  submitText = "Save Batch Listing",
}: ListingFormProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        harvest_date: initialValues.harvest_date
          ? dayjs(initialValues.harvest_date)
          : dayjs(),
      })
    } else {
      form.setFieldsValue({
        commodity_name: "",
        category: "Vegetables",
        farmer_name: "",
        hub_name: "Bogura Central Hub",
        total_yield_kg: 500,
        available_qty_kg: 500,
        farmer_unit_price: 40,
        b2c_moq_kg: 2,
        b2b_moq_kg: 50,
        grade: "GRADE_A",
        harvest_date: dayjs(),
        description: "",
        is_active: true,
      })
    }
  }, [initialValues, form])

  const handleFinish = async (values: any) => {
    const formatted: ListingInput = {
      commodity_name: values.commodity_name.trim(),
      category: values.category,
      farmer_name: values.farmer_name.trim(),
      hub_name: values.hub_name,
      total_yield_kg: Number(values.total_yield_kg),
      available_qty_kg: Number(values.available_qty_kg),
      farmer_unit_price: Number(values.farmer_unit_price),
      b2c_moq_kg: Number(values.b2c_moq_kg),
      b2b_moq_kg: Number(values.b2b_moq_kg),
      grade: values.grade,
      harvest_date: values.harvest_date
        ? values.harvest_date.format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      description: values.description ? values.description.trim() : "",
      is_active: Boolean(values.is_active),
    }

    const success = await onSubmit(formatted)
    if (success !== false && !initialValues) {
      form.resetFields()
    }
  }

  return (
    <Card bordered={false} style={{ background: "transparent" }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          category: "Vegetables",
          hub_name: "Bogura Central Hub",
          grade: "GRADE_A",
          harvest_date: dayjs(),
          is_active: true,
        }}
      >
        <Row gutter={16}>
          {/* Commodity Name */}
          <Col xs={24} md={14}>
            <Form.Item
              name="commodity_name"
              label="Commodity Name / Produce Batch"
              rules={[
                { required: true, message: "Please enter the commodity name" },
                { min: 2, message: "Must be at least 2 characters" },
              ]}
            >
              <Input placeholder="e.g. Diamant Potato (ডায়মন্ড আলু), Roma Tomato" />
            </Form.Item>
          </Col>

          {/* Category */}
          <Col xs={24} md={10}>
            <Form.Item
              name="category"
              label="Produce Category"
              rules={[{ required: true, message: "Please select category" }]}
            >
              <Select
                options={CATEGORIES.map((c) => ({ label: c, value: c }))}
              />
            </Form.Item>
          </Col>

          {/* Farmer Producer Name */}
          <Col xs={24} md={12}>
            <Form.Item
              name="farmer_name"
              label="Farmer / Producer Name"
              rules={[{ required: true, message: "Please enter farmer name" }]}
            >
              <Input placeholder="e.g. Md. Rafiqul Islam" />
            </Form.Item>
          </Col>

          {/* Regional Hub Center */}
          <Col xs={24} md={12}>
            <Form.Item
              name="hub_name"
              label="Collection Hub (Micro-Fulfillment Center)"
              rules={[{ required: true, message: "Please select a hub" }]}
            >
              <Select
                showSearch
                options={HUBS.map((h) => ({ label: h, value: h }))}
              />
            </Form.Item>
          </Col>

          {/* Pricing & Yield */}
          <Col xs={12} md={6}>
            <Form.Item
              name="farmer_unit_price"
              label="Farmer Price (৳ / kg)"
              rules={[
                { required: true, message: "Required" },
                { type: "number", min: 1, message: "Must be >= ৳1" },
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                prefix="৳"
                placeholder="40"
              />
            </Form.Item>
          </Col>

          <Col xs={12} md={6}>
            <Form.Item
              name="total_yield_kg"
              label="Total Batch Yield (kg)"
              rules={[
                { required: true, message: "Required" },
                { type: "number", min: 1, message: "Must be >= 1 kg" },
              ]}
            >
              <InputNumber style={{ width: "100%" }} placeholder="1000" />
            </Form.Item>
          </Col>

          <Col xs={12} md={6}>
            <Form.Item
              name="available_qty_kg"
              label="Available Stock (kg)"
              dependencies={["total_yield_kg"]}
              rules={[
                { required: true, message: "Required" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (value === undefined || value === null) {
                      return Promise.resolve()
                    }
                    if (value > getFieldValue("total_yield_kg")) {
                      return Promise.reject(
                        new Error("Cannot exceed total yield")
                      )
                    }
                    if (value < 0) {
                      return Promise.reject(new Error("Cannot be negative"))
                    }
                    return Promise.resolve()
                  },
                }),
              ]}
            >
              <InputNumber style={{ width: "100%" }} placeholder="1000" />
            </Form.Item>
          </Col>

          <Col xs={12} md={6}>
            <Form.Item
              name="grade"
              label="Quality Grade"
              rules={[{ required: true, message: "Select grade" }]}
            >
              <Select options={GRADES} />
            </Form.Item>
          </Col>

          {/* Dynamic Anti-Loss Guard Thresholds */}
          <Col xs={12} md={6}>
            <Form.Item
              name="b2c_moq_kg"
              label="B2C MOQ (kg)"
              tooltip="Minimum Order Quantity for retail households (protects delivery economics)"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                step={0.5}
                min={0.5}
                placeholder="2"
              />
            </Form.Item>
          </Col>

          <Col xs={12} md={6}>
            <Form.Item
              name="b2b_moq_kg"
              label="B2B MOQ (kg)"
              tooltip="Minimum Order Quantity for bulk commercial wholesalers"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                step={5}
                min={5}
                placeholder="50"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="harvest_date"
              label="Harvest / Plucking Date"
              rules={[{ required: true, message: "Please pick harvest date" }]}
            >
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>

          {/* Description & Notes */}
          <Col xs={24}>
            <Form.Item name="description" label="Agronomic Notes / Quality Description">
              <Input.TextArea
                rows={3}
                placeholder="Details on moisture content, color stage, pesticide-free certification, or storage conditions..."
              />
            </Form.Item>
          </Col>

          {/* Active status */}
          <Col xs={24}>
            <Form.Item name="is_active" valuePropName="checked">
              <Checkbox>
                Listing is Active & visible on the marketplace
              </Checkbox>
            </Form.Item>
          </Col>
        </Row>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {submitText}
          </Button>
          {onCancel && (
            <Button size="large" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
        </div>
      </Form>
    </Card>
  )
}
