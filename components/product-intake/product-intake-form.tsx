'use client'

import { useRef, useState } from 'react'
import { Loader2, X, ImageIcon, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { submitProductIntakeAction } from '@/app/product-intake/[token]/actions'
import { PRODUCT_UNITS, PRODUCT_CURRENCIES, INCOTERMS, PAYMENT_TERMS_OPTIONS } from '@/lib/constants/product-options'
import { ImageLinkInput } from '@/components/ui/image-link-input'
import { upload } from '@vercel/blob/client'
import { validateAndCompressImage, MAX_INPUT_SIZE } from '@/lib/images/compress'

interface Props {
  token: string
  clientId: string
  companyName: string
}

const DEFAULT_CATEGORIES = [
  { value: 'Coffee', label: 'Cà phê' },
  { value: 'Cocoa', label: 'Ca cao' },
  { value: 'Pepper', label: 'Hồ tiêu' },
  { value: 'Cashew', label: 'Hạt điều' },
  { value: 'Spices', label: 'Gia vị' },
  { value: 'Nuts', label: 'Các loại hạt' },
  { value: 'Dried Fruits', label: 'Trái cây sấy' },
  { value: 'Grains', label: 'Ngũ cốc' },
  { value: 'Oils', label: 'Dầu' },
  { value: 'Seafood', label: 'Thủy sản' },
  { value: 'Other', label: 'Khác' },
]

/**
 * Fields describing ONE product. Cleared after every successful submission so
 * the next product is typed from scratch.
 *
 * Getting this list wrong is not cosmetic. A supplier who submits product #2
 * with product #1's HS code still gets a green success toast, and the wrong
 * code then travels to US customs. Everything here must vary per product.
 */
const PRODUCT_FIELDS = [
  'product_name', 'product_code', 'category', 'subcategory', 'description',
  'hs_code', 'key_specifications', 'usp',
  'monthly_capacity_units', 'min_unit_price', 'max_unit_price', 'price_unit',
  'moq_value', 'moq_unit', 'lead_time',
  'packing', 'package_size', 'shelf_life', 'storage_conditions',
] as const

/**
 * Fields describing the SUPPLIER, not the product. Every product from this
 * factory shares them, so they survive a submission - that is the point of
 * keeping them, and none of them can contaminate a different product.
 */
const SUPPLIER_FIELDS = [
  'country_of_origin', 'unit_of_measure', 'currency',
  'incoterm', 'incoterm_place', 'payment_terms',
] as const

/** Labels for the "kept" note, so the copy follows SUPPLIER_FIELDS. */
const SUPPLIER_FIELD_LABELS: Record<(typeof SUPPLIER_FIELDS)[number], string> = {
  country_of_origin: 'xuất xứ',
  unit_of_measure: 'đơn vị tính',
  currency: 'tiền tệ',
  incoterm: 'Incoterm',
  incoterm_place: 'cảng giao hàng',
  payment_terms: 'điều khoản thanh toán',
}

/** Receipt of everything sent during this visit, so nothing gets sent twice. */
function SubmittedList({ items }: { items: { name: string; code: string; at: number }[] }) {
  if (items.length === 0) return null
  return (
    <ol className="space-y-1.5">
      {items.map((item, i) => (
        <li key={`${item.at}-${i}`} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-foreground">{item.name}</span>
            {item.code && (
              <span className="ml-2 text-xs text-muted-foreground">SKU: {item.code}</span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">
              {new Date(item.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function ProductIntakeForm({ token, clientId, companyName }: Props) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [priceConfirmed, setPriceConfirmed] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [showCustomCategory, setShowCustomCategory] = useState(false)
  const [customCategory, setCustomCategory] = useState('')
  // Products submitted during this visit. Drives the "sản phẩm thứ N" counter
  // and the receipt list, so a supplier can see what already went through
  // instead of re-submitting the same item because they lost track.
  const [submitted, setSubmitted] = useState<{ name: string; code: string; at: number }[]>([])
  const [finished, setFinished] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    category: '',
    subcategory: '',
    description: '',
    country_of_origin: 'Vietnam',
    unit_of_measure: 'kg',
    currency: 'USD',
    min_unit_price: '',
    max_unit_price: '',
    price_unit: '',
    moq_value: '',
    moq_unit: '',
    lead_time: '',
    incoterm: '',
    incoterm_place: '',
    payment_terms: '',
    hs_code: '',
    key_specifications: '',
    usp: '',
    monthly_capacity_units: '',
    packing: '',
    package_size: '',
    shelf_life: '',
    storage_conditions: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  const handleSelect = (name: string, value: string) => {
    if (name === 'category' && value === '__custom__') {
      setShowCustomCategory(true)
      return
    }
    setFormData((p) => ({ ...p, [name]: value }))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return
    for (const f of selected) {
      if (f.size > MAX_INPUT_SIZE) {
        toast.error(`Ảnh "${f.name}" vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn 5MB.`)
        return
      }
    }
    setCompressing(true)
    try {
      const compressed: File[] = []
      for (const f of selected) {
        try {
          const result = await validateAndCompressImage(f)
          compressed.push(result.file)
        } catch (err: any) {
          toast.error(err.message || `Không thể xử lý ảnh ${f.name}`)
          return
        }
      }
      setFiles((prev) => [...prev, ...compressed].slice(0, 10))
    } finally {
      setCompressing(false)
      e.target.value = ''
    }
  }

  const removeFile = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx))
  const removeImageUrl = (idx: number) => setImageUrls((p) => p.filter((_, i) => i !== idx))
  const addImageLinks = (urls: string[]) => setImageUrls((p) => [...p, ...urls])
  const hasAnyImage = imageUrls.length > 0 || files.length > 0

  const uploadImages = async (): Promise<string[]> => {
    if (files.length === 0) return []
    const urls: string[] = []
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const blob = await upload(`product-intake/${token}/${Date.now()}_${safeName}`, file, {
        access: 'public',
        handleUploadUrl: `/api/product-intake/upload-images?token=${encodeURIComponent(token)}`,
        clientPayload: JSON.stringify({ token }),
      })
      urls.push(blob.url)
    }
    return urls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priceConfirmed) {
      toast.error('Vui lòng xác nhận cam kết giá trước khi gửi.')
      return
    }
    const finalCategory = showCustomCategory && customCategory.trim() ? customCategory.trim() : formData.category
    if (!formData.product_name || !finalCategory) {
      toast.error('Vui lòng điền tên sản phẩm và danh mục.')
      return
    }
    setLoading(true)
    try {
      let newImageUrls: string[] = []
      if (files.length > 0) {
        setUploading(true)
        newImageUrls = await uploadImages()
        setUploading(false)
      }
      const finalImageUrls = [...imageUrls, ...newImageUrls]

      const payload = {
        product_name: formData.product_name,
        product_code: formData.product_code || undefined,
        category: finalCategory,
        subcategory: formData.subcategory || undefined,
        description: formData.description || undefined,
        country_of_origin: formData.country_of_origin || undefined,
        unit_of_measure: formData.unit_of_measure,
        currency: formData.currency,
        min_unit_price: formData.min_unit_price ? parseFloat(formData.min_unit_price) : undefined,
        max_unit_price: formData.max_unit_price ? parseFloat(formData.max_unit_price) : undefined,
        price_unit: formData.price_unit || undefined,
        moq_value: formData.moq_value ? parseFloat(formData.moq_value) : undefined,
        moq_unit: formData.moq_unit || undefined,
        lead_time: formData.lead_time || undefined,
        incoterm: formData.incoterm || undefined,
        incoterm_place: formData.incoterm_place || undefined,
        payment_terms: formData.payment_terms || undefined,
        hs_code: formData.hs_code || undefined,
        key_specifications: formData.key_specifications || undefined,
        usp: formData.usp || undefined,
        monthly_capacity_units: formData.monthly_capacity_units ? parseInt(formData.monthly_capacity_units) : undefined,
        packing: formData.packing || undefined,
        package_size: formData.package_size || undefined,
        shelf_life: formData.shelf_life || undefined,
        storage_conditions: formData.storage_conditions || undefined,
        price_confirmed: true,
        image_urls: finalImageUrls,
      }

      const res = await submitProductIntakeAction(token, payload)
      if (res.success) {
        toast.success(`Đã gửi "${payload.product_name}" thành công!`)
        setSubmitted((prev) => [
          ...prev,
          { name: payload.product_name, code: formData.product_code, at: Date.now() },
        ])
        // Clear the per-product fields only. Supplier-level fields (origin,
        // currency, unit, incoterm, payment terms) deliberately survive.
        setFormData((prev) => {
          const next = { ...prev }
          for (const field of PRODUCT_FIELDS) next[field] = ''
          return next
        })
        setFiles([])
        setImageUrls([])
        setPriceConfirmed(false)
        setCustomCategory('')
        setShowCustomCategory(false)
        // The form is ~5 screens tall; without this the confirmation lands
        // off-screen and the supplier thinks nothing happened.
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        toast.error(res.error || 'Gửi thất bại')
      }
    } catch (err) {
      console.error(err)
      toast.error('Lỗi hệ thống, vui lòng thử lại')
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  if (finished) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-4 text-xl font-semibold">Đã gửi {submitted.length} sản phẩm</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Cảm ơn bạn. AE của Vexim sẽ kiểm tra và kích hoạt từng sản phẩm trước khi đưa lên catalog.
            Bạn có thể đóng trang này, hoặc thêm sản phẩm nữa nếu còn.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => setFinished(false)}>
              Thêm sản phẩm nữa
            </Button>
            <Button type="button" onClick={() => window.print()}>
              In hoặc lưu biên nhận
            </Button>
          </div>
        </div>
        <SubmittedList items={submitted} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2" ref={summaryRef}>
        {companyName.trim() && companyName !== 'Supplier' && (
          <p className="text-sm text-muted-foreground">
            Biểu mẫu dành cho <strong className="text-foreground">{companyName}</strong>
          </p>
        )}
        <h1 className="text-2xl font-semibold">Điền thông tin sản phẩm</h1>
        <p className="text-sm text-muted-foreground">
          Một link dùng được cho nhiều sản phẩm trong 30 ngày. Mỗi lần bấm &ldquo;Gửi sản phẩm&rdquo;
          sẽ gửi đúng <strong>một</strong> sản phẩm.
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-emerald-950 dark:text-emerald-100">Cam kết bảo mật thông tin</p>
          <p className="text-emerald-950/80 dark:text-emerald-100/80">
            Thông tin bạn gửi không tự động được công khai. Veximtrade dùng thông tin để tiếp nhận và hỗ trợ hồ sơ sản phẩm;
            nếu cần chia sẻ hồ sơ với buyer/đối tác, chúng tôi sẽ xin chấp thuận của bạn trước. Một số dữ liệu có thể được xử lý
            bởi nhà cung cấp hạ tầng cần thiết để vận hành dịch vụ.
          </p>
          <a href="/legal/privacy" className="inline-block font-medium text-emerald-800 underline underline-offset-2 dark:text-emerald-300">
            Xem Chính sách bảo mật
          </a>
        </div>
      </div>

      {submitted.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Đã gửi thành công {submitted.length} sản phẩm
                </p>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-200/80">
                  Những sản phẩm dưới đây đã được gửi và không cần gửi lại.
                </p>
              </div>
              <SubmittedList items={submitted} />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setFinished(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  Tôi đã gửi xong
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitted.length > 0 && (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
          Bạn đang điền <strong>sản phẩm thứ {submitted.length + 1}</strong>. Các mục thuộc sản phẩm
          đã được xóa sạch; những mục chung cho nhà cung cấp (
          {SUPPLIER_FIELDS.map((f, i) => (
            <span key={f}>
              {i > 0 && ', '}
              {SUPPLIER_FIELD_LABELS[f]}
            </span>
          ))}
          ) được giữ lại để bạn khỏi nhập lại.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 rounded-lg border bg-card p-6">
        {/* 1. Thông tin cơ bản */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">1. Thông tin cơ bản</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">Tên sản phẩm *</Label>
              <Input id="product_name" name="product_name" value={formData.product_name} onChange={handleChange} required placeholder="VD: Cà phê Arabica Cầu Đất" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_code">Mã SKU</Label>
              <Input id="product_code" name="product_code" value={formData.product_code} onChange={handleChange} placeholder="VD: COFFEE-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Danh mục *</Label>
              <Select value={showCustomCategory ? '__custom__' : formData.category} onValueChange={(v) => handleSelect('category', v)}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Tạo danh mục mới...</SelectItem>
                </SelectContent>
              </Select>
              {showCustomCategory && (
                <div className="flex gap-2 mt-2">
                  <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Nhập tên danh mục mới, VD: Hạt điều rang muối" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCustomCategory(false)}>Hủy</Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategory">Danh mục phụ</Label>
              <Input id="subcategory" name="subcategory" value={formData.subcategory} onChange={handleChange} placeholder="VD: Arabica, Hữu cơ, Rang xay" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả sản phẩm</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Mô tả chi tiết sản phẩm, quy trình sản xuất, chứng nhận..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country_of_origin">Xuất xứ *</Label>
              <Input id="country_of_origin" name="country_of_origin" value={formData.country_of_origin} onChange={handleChange} placeholder="VD: Việt Nam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hs_code">Mã HS</Label>
              <Input id="hs_code" name="hs_code" value={formData.hs_code} onChange={handleChange} placeholder="VD: 090111" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="key_specifications">Thông số kỹ thuật</Label>
              <Input id="key_specifications" name="key_specifications" value={formData.key_specifications} onChange={handleChange} placeholder="VD: Độ ẩm 12%, Screen 16, Grade A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usp">Điểm bán hàng nổi bật (USP)</Label>
              <Input id="usp" name="usp" value={formData.usp} onChange={handleChange} placeholder="VD: Canh tác bền vững, truy xuất trực tiếp từ nông trại" />
            </div>
          </div>
        </div>

        {/* 2. Năng lực & Giá */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">2. Năng lực & Giá</h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_capacity_units">Năng lực sản xuất / tháng</Label>
              <Input id="monthly_capacity_units" name="monthly_capacity_units" type="number" value={formData.monthly_capacity_units} onChange={handleChange} placeholder="VD: 500" />
            </div>
            <div className="space-y-2">
              <Label>Đơn vị</Label>
              <Select value={formData.unit_of_measure} onValueChange={(v) => handleSelect('unit_of_measure', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tiền tệ</Label>
              <Select value={formData.currency} onValueChange={(v) => handleSelect('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_unit_price">Giá tối thiểu</Label>
              <Input id="min_unit_price" name="min_unit_price" type="number" step="0.01" value={formData.min_unit_price} onChange={handleChange} placeholder="4.5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_unit_price">Giá tối đa</Label>
              <Input id="max_unit_price" name="max_unit_price" type="number" step="0.01" value={formData.max_unit_price} onChange={handleChange} placeholder="5.5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_unit">Giá tính theo</Label>
              <Input id="price_unit" name="price_unit" value={formData.price_unit} onChange={handleChange} placeholder="per kg, per container" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="moq_value">MOQ</Label>
              <Input id="moq_value" name="moq_value" type="number" step="0.01" value={formData.moq_value} onChange={handleChange} placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moq_unit">Đơn vị MOQ</Label>
              <Input id="moq_unit" name="moq_unit" value={formData.moq_unit} onChange={handleChange} placeholder="kg, container 20ft" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_time">Lead time</Label>
              <Input id="lead_time" name="lead_time" value={formData.lead_time} onChange={handleChange} placeholder="15-20 ngày" />
            </div>
          </div>
        </div>

        {/* 3. Đóng gói & Bảo quản */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">3. Đóng gói & Bảo quản</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="packing">Quy cách đóng gói</Label>
              <Input id="packing" name="packing" value={formData.packing} onChange={handleChange} placeholder="VD: Bao PP 25kg, thùng carton 10kg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package_size">Kích thước đóng gói</Label>
              <Input id="package_size" name="package_size" value={formData.package_size} onChange={handleChange} placeholder="VD: 60x40x20 cm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shelf_life">Hạn sử dụng</Label>
              <Input id="shelf_life" name="shelf_life" value={formData.shelf_life} onChange={handleChange} placeholder="VD: 12 tháng kể từ NSX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storage_conditions">Điều kiện bảo quản</Label>
              <Input id="storage_conditions" name="storage_conditions" value={formData.storage_conditions} onChange={handleChange} placeholder="VD: Nơi khô mát, tránh ánh nắng trực tiếp" />
            </div>
          </div>
        </div>

        {/* 4. Giao hàng & Thanh toán */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">4. Giao hàng & Thanh toán</h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Incoterm</Label>
              <Select value={formData.incoterm} onValueChange={(v) => handleSelect('incoterm', v)}>
                <SelectTrigger><SelectValue placeholder="Chọn Incoterm" /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="incoterm_place">Cảng giao hàng / Địa điểm</Label>
              <Input id="incoterm_place" name="incoterm_place" value={formData.incoterm_place} onChange={handleChange} placeholder="VD: Cảng Cát Lái, TP.HCM" />
            </div>
            <div className="space-y-2">
              <Label>Điều khoản thanh toán</Label>
              <Select value={formData.payment_terms} onValueChange={(v) => handleSelect('payment_terms', v)}>
                <SelectTrigger><SelectValue placeholder="Chọn điều khoản" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 5. Ảnh sản phẩm */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base border-b pb-2">5. Ảnh sản phẩm</h3>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>• Dán link ảnh hoặc tải file từ máy (tối đa 10 ảnh, mỗi ảnh dưới 5MB).</p>
          </div>

          <ImageLinkInput
            existing={imageUrls}
            max={10 - files.length}
            onAdd={addImageLinks}
            disabled={uploading || compressing}
            placeholder="Dán link ảnh sản phẩm (https://...)"
          />

          {imageUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {imageUrls.map((url, idx) => (
                <div key={`existing-${idx}`} className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Product ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                  <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeImageUrl(idx)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {files.map((file, idx) => (
                <div key={`new-${idx}`} className="relative aspect-square bg-muted rounded-lg overflow-hidden group border-2 border-dashed border-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt={`New ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] py-0.5 text-center">
                    {(file.size / 1024).toFixed(0)}KB
                  </div>
                  <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(idx)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
            <input type="file" id="product-intake-images" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading || compressing} className="hidden" />
            <Label htmlFor="product-intake-images" className="cursor-pointer flex flex-col items-center gap-1">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-medium">Kéo thả ảnh vào đây hoặc bấm để chọn</span>
              <span className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF – Dưới 5MB/ảnh</span>
            </Label>
            {compressing && (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-primary">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý ảnh...
              </div>
            )}
          </div>

          {hasAnyImage && (
            <div className="flex justify-end">
              <label className="text-xs text-primary cursor-pointer underline">
                + Thêm ảnh
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading || compressing} className="hidden" />
              </label>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start space-x-3">
            <Checkbox id="price_confirmed" checked={priceConfirmed} onCheckedChange={(c) => setPriceConfirmed(c === true)} className="mt-0.5" />
            <label htmlFor="price_confirmed" className="text-sm font-medium leading-snug cursor-pointer">
              Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.
              <span className="text-destructive"> *</span>
              <p className="text-xs font-normal text-muted-foreground mt-1">
                Cam kết này được lưu kèm thời gian và dùng để đối chiếu với giá công khai theo chính sách Price Parity của Vexim.
              </p>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={loading || uploading || compressing || !priceConfirmed}>
            {(loading || uploading || compressing) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {compressing ? 'Đang xử lý...' : uploading ? 'Đang tải ảnh...' : 'Gửi sản phẩm'}
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground text-center">
        Sản phẩm sau khi gửi sẽ ở trạng thái chờ duyệt (inactive). AE sẽ kiểm tra và kích hoạt để hiển thị trên catalog công khai.
      </p>
    </div>
  )
}
