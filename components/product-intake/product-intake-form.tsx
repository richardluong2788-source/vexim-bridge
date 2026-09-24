'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { submitProductIntakeAction } from '@/app/product-intake/[token]/actions'
import { PRODUCT_UNITS, PRODUCT_CURRENCIES, INCOTERMS, PAYMENT_TERMS_OPTIONS } from '@/lib/constants/product-options'

interface Props {
  token: string
  clientId: string
  companyName: string
}

export function ProductIntakeForm({ token, clientId, companyName }: Props) {
  const [loading, setLoading] = useState(false)
  const [priceConfirmed, setPriceConfirmed] = useState(false)
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    category: '',
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
    hs_code: '',
    key_specifications: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  const handleSelect = (name: string, value: string) => {
    setFormData((p) => ({ ...p, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priceConfirmed) {
      toast.error('Vui lòng xác nhận cam kết giá trước khi gửi.')
      return
    }
    if (!formData.product_name || !formData.category) {
      toast.error('Vui lòng điền tên sản phẩm và danh mục.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        product_name: formData.product_name,
        product_code: formData.product_code || undefined,
        category: formData.category,
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
        hs_code: formData.hs_code || undefined,
        key_specifications: formData.key_specifications || undefined,
        price_confirmed: true,
      }

      const res = await submitProductIntakeAction(token, payload)
      if (res.success) {
        toast.success('Đã gửi sản phẩm thành công! Bạn có thể tiếp tục thêm sản phẩm khác.')
        setFormData((prev) => ({
          ...prev,
          product_name: '',
          product_code: '',
          description: '',
          min_unit_price: '',
          max_unit_price: '',
          key_specifications: '',
        }))
        setPriceConfirmed(false)
      } else {
        toast.error(res.error || 'Gửi thất bại')
      }
    } catch (err) {
      console.error(err)
      toast.error('Lỗi hệ thống, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Điền thông tin sản phẩm</h1>
        <p className="text-sm text-muted-foreground">
          Công ty: <span className="font-medium text-foreground">{companyName}</span> · Link này do AE tạo để supplier tự điền catalog. Mỗi sản phẩm sẽ được AE duyệt trước khi hiển thị công khai.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-card p-6">
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
            <Select value={formData.category} onValueChange={(v) => handleSelect('category', v)}>
              <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coffee">Coffee</SelectItem>
                <SelectItem value="cocoa">Cocoa</SelectItem>
                <SelectItem value="cashew">Cashew</SelectItem>
                <SelectItem value="pepper">Pepper</SelectItem>
                <SelectItem value="spices">Spices</SelectItem>
                <SelectItem value="fruits">Fruits</SelectItem>
                <SelectItem value="vegetables">Vegetables</SelectItem>
                <SelectItem value="grains">Grains</SelectItem>
                <SelectItem value="seafood">Seafood</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hs_code">Mã HS</Label>
            <Input id="hs_code" name="hs_code" value={formData.hs_code} onChange={handleChange} placeholder="VD: 090111" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Mô tả chi tiết sản phẩm, quy trình, USP..." />
        </div>

        <div className="grid grid-cols-3 gap-4">
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
          <div className="space-y-2">
            <Label htmlFor="price_unit">Giá tính theo</Label>
            <Input id="price_unit" name="price_unit" value={formData.price_unit} onChange={handleChange} placeholder="per kg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min_unit_price">Giá tối thiểu</Label>
            <Input id="min_unit_price" name="min_unit_price" type="number" step="0.01" value={formData.min_unit_price} onChange={handleChange} placeholder="4.5" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_unit_price">Giá tối đa</Label>
            <Input id="max_unit_price" name="max_unit_price" type="number" step="0.01" value={formData.max_unit_price} onChange={handleChange} placeholder="5.5" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="moq_value">MOQ</Label>
            <Input id="moq_value" name="moq_value" type="number" step="0.01" value={formData.moq_value} onChange={handleChange} placeholder="1000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moq_unit">Đơn vị MOQ</Label>
            <Input id="moq_unit" name="moq_unit" value={formData.moq_unit} onChange={handleChange} placeholder="kg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead_time">Lead time</Label>
            <Input id="lead_time" name="lead_time" value={formData.lead_time} onChange={handleChange} placeholder="15-20 ngày" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="key_specifications">Thông số kỹ thuật</Label>
            <Input id="key_specifications" name="key_specifications" value={formData.key_specifications} onChange={handleChange} placeholder="Độ ẩm 12%, Screen 16" />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start space-x-3">
            <Checkbox id="price_confirmed" checked={priceConfirmed} onCheckedChange={(c) => setPriceConfirmed(c === true)} className="mt-0.5" />
            <label htmlFor="price_confirmed" className="text-sm font-medium leading-snug cursor-pointer">
              Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.
              <span className="text-destructive"> *</span>
              <p className="text-xs font-normal text-muted-foreground mt-1">
                Cam kết này được lưu kèm thời gian và dùng để đối chiếu với giá công khai (website/Alibaba) theo chính sách Price Parity của Vexim.
              </p>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={loading || !priceConfirmed}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gửi sản phẩm
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground text-center">
        Sản phẩm sau khi gửi sẽ ở trạng thái chờ duyệt (inactive). AE sẽ kiểm tra và kích hoạt để hiển thị trên catalog công khai.
      </p>
    </div>
  )
}
