"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AssessmentAnswers } from "@/lib/types/readiness"
import {
  PRODUCT_CATEGORY_OPTIONS,
  CAPACITY_OPTIONS,
  CERTIFICATION_OPTIONS,
} from "@/lib/types/readiness"

interface ProductInfoStepProps {
  data: AssessmentAnswers["productInfo"]
  onChange: (data: AssessmentAnswers["productInfo"]) => void
  language: "vi" | "en"
}

export function ProductInfoStep({
  data,
  onChange,
  language,
}: ProductInfoStepProps) {
  const isVi = language === "vi"

  const current = data ?? {
    mainProducts: [],
    productCategories: [],
    monthlyCapacity: "10_to_50_tons",
    certifications: [],
    hasOwnBrand: false,
    canPrivateLabel: false,
  }

  function handleChange<K extends keyof NonNullable<AssessmentAnswers["productInfo"]>>(
    field: K,
    value: NonNullable<AssessmentAnswers["productInfo"]>[K]
  ) {
    onChange({
      ...current,
      [field]: value,
    })
  }

  function handleProductsChange(value: string) {
    const products = value.split(",").map((p) => p.trim()).filter(Boolean)
    handleChange("mainProducts", products)
  }

  function handleCategoryToggle(category: string) {
    const categories = current.productCategories || []
    const newCategories = categories.includes(category as typeof categories[number])
      ? categories.filter((c) => c !== category)
      : [...categories, category as typeof categories[number]]
    handleChange("productCategories", newCategories)
  }

  function handleCertificationToggle(cert: string) {
    const certs = current.certifications || []
    const newCerts = certs.includes(cert)
      ? certs.filter((c) => c !== cert)
      : [...certs, cert]
    handleChange("certifications", newCerts)
  }

  return (
    <div className="space-y-6">
      {/* Main Products */}
      <div className="space-y-2">
        <Label htmlFor="mainProducts">
          {isVi ? "Sản phẩm chính của bạn" : "Your Main Products"}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id="mainProducts"
          placeholder={
            isVi
              ? "VD: Cà phê Arabica, Hạt điều, Tiêu đen"
              : "e.g., Arabica Coffee, Cashew Nuts, Black Pepper"
          }
          value={current.mainProducts?.join(", ") ?? ""}
          onChange={(e) => handleProductsChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {isVi
            ? "Nhập các sản phẩm chính, phân cách bằng dấu phẩy"
            : "Enter your main products, separated by commas"}
        </p>
      </div>

      {/* Product Categories */}
      <div className="space-y-3">
        <Label>
          {isVi ? "Danh mục sản phẩm" : "Product Categories"}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCT_CATEGORY_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${option.value}`}
                checked={current.productCategories?.includes(option.value as typeof current.productCategories[number]) ?? false}
                onCheckedChange={() => handleCategoryToggle(option.value)}
              />
              <label
                htmlFor={`category-${option.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {isVi ? option.labelVi : option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Capacity */}
      <div className="space-y-2">
        <Label htmlFor="capacity">
          {isVi ? "Công suất sản xuất hàng tháng" : "Monthly Production Capacity"}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Select
          value={current.monthlyCapacity}
          onValueChange={(v) => handleChange("monthlyCapacity", v as typeof current.monthlyCapacity)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAPACITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {isVi ? option.labelVi : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Certifications */}
      <div className="space-y-3">
        <Label>
          {isVi ? "Chứng chỉ sản phẩm/nhà máy hiện có" : "Current Product/Factory Certifications"}
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {CERTIFICATION_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`cert-${option.value}`}
                checked={current.certifications?.includes(option.value) ?? false}
                onCheckedChange={() => handleCertificationToggle(option.value)}
              />
              <label
                htmlFor={`cert-${option.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {isVi ? option.labelVi : option.label}
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {isVi
            ? "Chọn tất cả các chứng chỉ mà doanh nghiệp bạn hiện có"
            : "Select all certifications your business currently holds"}
        </p>
      </div>

      {/* Brand Options */}
      <div className="space-y-3">
        <Label>{isVi ? "Khả năng thương hiệu" : "Brand Capabilities"}</Label>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasOwnBrand"
              checked={current.hasOwnBrand ?? false}
              onCheckedChange={(checked) =>
                handleChange("hasOwnBrand", checked === true)
              }
            />
            <label
              htmlFor="hasOwnBrand"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              {isVi
                ? "Có thương hiệu riêng"
                : "Has own brand"}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="canPrivateLabel"
              checked={current.canPrivateLabel ?? false}
              onCheckedChange={(checked) =>
                handleChange("canPrivateLabel", checked === true)
              }
            />
            <label
              htmlFor="canPrivateLabel"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              {isVi
                ? "Có thể sản xuất nhãn riêng (Private Label) cho buyer"
                : "Can produce Private Label for buyers"}
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
