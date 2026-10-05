import type { Locale } from "@/lib/i18n/config"

type ProfileCopy = {
  common: {
    companyFallback: string
    logo: string
    coverImage: string
    notSpecified: string
    yes: string
    no: string
    yearCount: (years: number) => string
  }
  metadata: {
    notFound: string
    notFoundDescription: string
    homePage: string
    titleSuffix: string
    description: (companyName: string) => string
  }
  header: {
    verifiedByVexim: string
    verifiedCapabilities: string
    viewAllCapabilities: (count: number) => string
    exportExperience: (years: number) => string
  }
  tabs: {
    companyProfile: string
    products: string
    overview: string
    location: string
    exportingSince: string
    exportExperience: string
    companyScale: string
    highlights: string
    productionCapacity: string
    minimumOrderQuantity: string
    leadTime: string
    qualityControl: string
    qualitySystems: string
    traceability: string
    auditReadiness: string
    certifications: string
    tradeExperience: string
    exportMarkets: string
    incoterms: string
    oemOdm: string
    noProducts: string
  }
  capabilityLabels: {
    qualitySystems: Record<string, string>
    traceability: Record<string, string>
    auditReadiness: Record<string, string>
    markets: Record<string, string>
    oemOdm: Record<string, string>
  }
  media: {
    openFullscreen: string
    verified: string
    factory: string
    factoryVideo: string
    videoThumbnail: string
    playFactoryVideo: string
    showFactoryVideo: string
    showFactoryPhoto: (index: number) => string
    previewTitle: string
    previous: string
    next: string
  }
  products: {
    heading: string
    moreImages: (count: number) => string
    month: string
    numberLocale: string
    categories: Record<string, string>
    complianceBadges: Record<string, string>
  }
  certifications: {
    heading: string
    certificate: string
    document: string
    copyCode: string
    previewUnavailable: string
    previous: string
    next: string
    kindLabels: Record<string, string>
  }
  cta: {
    heading: string
    description: string
    requestQuote: string
    downloadPdf: string
  }
  quote: {
    requiredFields: string
    submitFailed: string
    successTitle: string
    successDescription: string
    reference: string
    close: string
    title: string
    description: string
    companyName: string
    companyNamePlaceholder: string
    contactName: string
    contactNamePlaceholder: string
    email: string
    emailPlaceholder: string
    phone: string
    phonePlaceholder: string
    country: string
    countryPlaceholder: string
    productsInterested: string
    quantity: string
    quantityPlaceholder: string
    notes: string
    notesPlaceholder: string
    cancel: string
    submitting: string
    submit: string
  }
  footer: {
    poweredBy: string
  }
}

const en: ProfileCopy = {
  common: {
    companyFallback: "Company",
    logo: "logo",
    coverImage: "cover image",
    notSpecified: "Not specified",
    yes: "Yes",
    no: "No",
    yearCount: (years) => `${years} ${years === 1 ? "year" : "years"}`,
  },
  metadata: {
    notFound: "Profile Not Found",
    notFoundDescription: "The supplier profile you’re looking for doesn’t exist or has been unpublished.",
    homePage: "Go to Homepage",
    titleSuffix: "Supplier Profile",
    description: (companyName) => `Learn more about ${companyName} and its supplier capabilities.`,
  },
  header: {
    verifiedByVexim: "Verified by Vexim",
    verifiedCapabilities: "Verified Capabilities",
    viewAllCapabilities: (count) => `View all verified capabilities (${count})`,
    exportExperience: (years) => `${years} ${years === 1 ? "year" : "years"} of export experience`,
  },
  tabs: {
    companyProfile: "Company Profile",
    products: "Products",
    overview: "Overview",
    location: "Location",
    exportingSince: "Exporting Since",
    exportExperience: "Export Experience",
    companyScale: "Company Scale",
    highlights: "Highlights",
    productionCapacity: "Production Capacity",
    minimumOrderQuantity: "Minimum Order Quantity (MOQ)",
    leadTime: "Lead Time",
    qualityControl: "Quality Control",
    qualitySystems: "Quality Systems",
    traceability: "Traceability",
    auditReadiness: "Audit Readiness",
    certifications: "Certifications",
    tradeExperience: "Trade Experience",
    exportMarkets: "Export Markets",
    incoterms: "Incoterms",
    oemOdm: "OEM / ODM",
    noProducts: "No products have been posted yet.",
  },
  capabilityLabels: {
    qualitySystems: {
      HACCP: "HACCP certified",
      GMP: "GMP certified",
      ISO22000: "ISO 22000 certified",
      SOP: "Internal Standard Operating Procedures (SOP)",
      QC: "Quality control (QC) process",
    },
    traceability: {
      lot: "Lot-level traceability",
      input: "Input material records",
      finished: "Finished goods records",
      recall: "Product recall procedure",
      "batch-lot": "Batch/lot coding",
    },
    auditReadiness: {
      onsite: "On-site factory audits accepted",
      online: "Online audits supported",
    },
    markets: {
      US: "United States",
      EU: "European Union",
      JP: "Japan",
      KR: "South Korea",
      CN: "China",
      ASEAN: "ASEAN",
      ME: "Middle East",
    },
    oemOdm: {
      OEM: "OEM",
      ODM: "ODM",
      "Private Label": "Private Label",
    },
  },
  media: {
    openFullscreen: "Open factory media full screen",
    verified: "Verified",
    factory: "Factory",
    factoryVideo: "Factory Video",
    videoThumbnail: "Video thumbnail",
    playFactoryVideo: "Play factory video",
    showFactoryVideo: "Show factory video",
    showFactoryPhoto: (index) => `Show factory photo ${index}`,
    previewTitle: "Factory media preview",
    previous: "Previous factory media",
    next: "Next factory media",
  },
  products: {
    heading: "Featured Products",
    moreImages: (count) => `+${count} more`,
    month: "month",
    numberLocale: "en-US",
    categories: {
      Coffee: "Coffee",
      Cocoa: "Cocoa",
      Pepper: "Pepper",
      Cashew: "Cashew",
      Spices: "Spices",
      Nuts: "Nuts",
      "Dried Fruits": "Dried Fruits",
      Grains: "Grains",
      Oils: "Oils",
      Seafood: "Seafood",
      Other: "Other",
    },
    complianceBadges: {
      fda: "FDA",
      coa: "COA",
      organic: "Organic",
      fsvp: "FSVP",
      halal: "Halal",
      kosher: "Kosher",
      brcgs: "BRCGS",
      haccp: "HACCP",
    },
  },
  certifications: {
    heading: "Certifications & Compliance",
    certificate: "Certificate",
    document: "Document",
    copyCode: "Copy code",
    previewUnavailable: "Document preview not available",
    previous: "Previous certificate",
    next: "Next certificate",
    kindLabels: {
      fda_certificate: "FDA",
      coa: "COA",
      other: "Certificate",
    },
  },
  cta: {
    heading: "Ready to start your order?",
    description: "Contact us for pricing, samples, or any questions about our products.",
    requestQuote: "Request Quote",
    downloadPdf: "Download Capability Profile (PDF)",
  },
  quote: {
    requiredFields: "Please fill in all required fields",
    submitFailed: "Failed to submit request",
    successTitle: "Quote Request Submitted",
    successDescription: "Thank you for your interest! Our team will review your request and get back to you within 24–48 hours.",
    reference: "Reference:",
    close: "Close",
    title: "Request a Quote",
    description: "Fill out the form below and we'll get back to you with pricing information.",
    companyName: "Company Name",
    companyNamePlaceholder: "Your company name",
    contactName: "Contact Name",
    contactNamePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@company.com",
    phone: "Phone",
    phonePlaceholder: "+1 (555) 000-0000",
    country: "Country",
    countryPlaceholder: "e.g., United States",
    productsInterested: "Products Interested",
    quantity: "Estimated Quantity/Volume",
    quantityPlaceholder: "e.g., 1 container, 5000 kg",
    notes: "Additional Notes",
    notesPlaceholder: "Any specific requirements or questions...",
    cancel: "Cancel",
    submitting: "Submitting...",
    submit: "Submit Request",
  },
  footer: {
    poweredBy: "Powered by",
  },
}

const vi: ProfileCopy = {
  common: {
    companyFallback: "Doanh nghiệp",
    logo: "biểu trưng",
    coverImage: "ảnh bìa",
    notSpecified: "Chưa cung cấp",
    yes: "Có",
    no: "Không",
    yearCount: (years) => `${years} năm`,
  },
  metadata: {
    notFound: "Không tìm thấy hồ sơ",
    notFoundDescription: "Hồ sơ nhà cung cấp bạn đang tìm không tồn tại hoặc đã bị gỡ công khai.",
    homePage: "Về trang chủ",
    titleSuffix: "Hồ sơ nhà cung cấp",
    description: (companyName) => `Tìm hiểu thêm về ${companyName} và năng lực cung ứng của doanh nghiệp.`,
  },
  header: {
    verifiedByVexim: "Đã được Vexim xác minh",
    verifiedCapabilities: "Năng lực đã xác minh",
    viewAllCapabilities: (count) => `Xem tất cả ${count} năng lực đã xác minh`,
    exportExperience: (years) => `${years} năm kinh nghiệm xuất khẩu`,
  },
  tabs: {
    companyProfile: "Hồ sơ doanh nghiệp",
    products: "Sản phẩm",
    overview: "Tổng quan",
    location: "Địa điểm",
    exportingSince: "Bắt đầu xuất khẩu từ",
    exportExperience: "Kinh nghiệm xuất khẩu",
    companyScale: "Quy mô doanh nghiệp",
    highlights: "Điểm nổi bật",
    productionCapacity: "Năng lực sản xuất",
    minimumOrderQuantity: "Số lượng đặt hàng tối thiểu (MOQ)",
    leadTime: "Thời gian giao hàng",
    qualityControl: "Kiểm soát chất lượng",
    qualitySystems: "Hệ thống chất lượng",
    traceability: "Truy xuất nguồn gốc",
    auditReadiness: "Mức độ sẵn sàng đón đánh giá",
    certifications: "Chứng nhận",
    tradeExperience: "Kinh nghiệm thương mại quốc tế",
    exportMarkets: "Thị trường xuất khẩu",
    incoterms: "Incoterms",
    oemOdm: "OEM / ODM",
    noProducts: "Chưa có sản phẩm nào được đăng.",
  },
  capabilityLabels: {
    qualitySystems: {
      HACCP: "Đạt chứng nhận HACCP",
      GMP: "Đạt chứng nhận GMP",
      ISO22000: "Đạt chứng nhận ISO 22000",
      SOP: "Có quy trình vận hành nội bộ (SOP)",
      QC: "Có quy trình kiểm soát chất lượng (QC)",
    },
    traceability: {
      lot: "Truy xuất nguồn gốc theo lô (Lot)",
      input: "Ghi nhận nguyên liệu đầu vào",
      finished: "Ghi nhận thành phẩm đầu ra",
      recall: "Có quy trình thu hồi sản phẩm",
      "batch-lot": "Mã hóa theo Batch/Lot",
    },
    auditReadiness: {
      onsite: "Sẵn sàng đón người mua đến khảo sát nhà máy",
      online: "Hỗ trợ đánh giá nhà máy trực tuyến",
    },
    markets: {
      US: "Hoa Kỳ",
      EU: "Liên minh châu Âu",
      JP: "Nhật Bản",
      KR: "Hàn Quốc",
      CN: "Trung Quốc",
      ASEAN: "ASEAN",
      ME: "Trung Đông",
    },
    oemOdm: {
      OEM: "OEM",
      ODM: "ODM",
      "Private Label": "Nhãn riêng",
    },
  },
  media: {
    openFullscreen: "Mở tư liệu nhà máy toàn màn hình",
    verified: "Đã xác minh",
    factory: "Nhà máy",
    factoryVideo: "Video nhà máy",
    videoThumbnail: "Ảnh thu nhỏ video",
    playFactoryVideo: "Phát video nhà máy",
    showFactoryVideo: "Hiển thị video nhà máy",
    showFactoryPhoto: (index) => `Hiển thị ảnh nhà máy ${index}`,
    previewTitle: "Xem trước tư liệu nhà máy",
    previous: "Tư liệu nhà máy trước",
    next: "Tư liệu nhà máy tiếp theo",
  },
  products: {
    heading: "Sản phẩm nổi bật",
    moreImages: (count) => `+${count} ảnh nữa`,
    month: "tháng",
    numberLocale: "vi-VN",
    categories: {
      Coffee: "Cà phê",
      Cocoa: "Ca cao",
      Pepper: "Hồ tiêu",
      Cashew: "Hạt điều",
      Spices: "Gia vị",
      Nuts: "Các loại hạt",
      "Dried Fruits": "Trái cây sấy",
      Grains: "Ngũ cốc",
      Oils: "Dầu",
      Seafood: "Thủy sản",
      Other: "Khác",
    },
    complianceBadges: {
      fda: "FDA",
      coa: "COA",
      organic: "Hữu cơ",
      fsvp: "FSVP",
      halal: "Halal",
      kosher: "Kosher",
      brcgs: "BRCGS",
      haccp: "HACCP",
    },
  },
  certifications: {
    heading: "Chứng nhận & tuân thủ",
    certificate: "Chứng chỉ",
    document: "Tài liệu",
    copyCode: "Sao chép mã",
    previewUnavailable: "Không thể xem trước tài liệu này",
    previous: "Chứng chỉ trước",
    next: "Chứng chỉ tiếp theo",
    kindLabels: {
      fda_certificate: "FDA",
      coa: "COA",
      other: "Chứng chỉ",
    },
  },
  cta: {
    heading: "Bạn đã sẵn sàng đặt hàng?",
    description: "Liên hệ với chúng tôi để nhận báo giá, yêu cầu mẫu hoặc giải đáp thắc mắc về sản phẩm.",
    requestQuote: "Yêu cầu báo giá",
    downloadPdf: "Tải hồ sơ năng lực (PDF)",
  },
  quote: {
    requiredFields: "Vui lòng điền đầy đủ các trường bắt buộc",
    submitFailed: "Không thể gửi yêu cầu. Vui lòng thử lại.",
    successTitle: "Đã gửi yêu cầu báo giá",
    successDescription: "Cảm ơn bạn đã quan tâm! Đội ngũ của chúng tôi sẽ xem xét yêu cầu và phản hồi trong vòng 24–48 giờ.",
    reference: "Mã tham chiếu:",
    close: "Đóng",
    title: "Yêu cầu báo giá",
    description: "Điền biểu mẫu dưới đây; chúng tôi sẽ liên hệ lại và gửi thông tin giá.",
    companyName: "Tên công ty",
    companyNamePlaceholder: "Tên công ty của bạn",
    contactName: "Người liên hệ",
    contactNamePlaceholder: "Tên của bạn",
    email: "Địa chỉ email",
    emailPlaceholder: "ban@congty.com",
    phone: "Điện thoại",
    phonePlaceholder: "+84 000 000 000",
    country: "Quốc gia",
    countryPlaceholder: "Ví dụ: United States",
    productsInterested: "Sản phẩm quan tâm",
    quantity: "Số lượng/khối lượng dự kiến",
    quantityPlaceholder: "Ví dụ: 1 lô hàng, 5.000 kg",
    notes: "Ghi chú thêm",
    notesPlaceholder: "Yêu cầu hoặc câu hỏi cụ thể...",
    cancel: "Hủy",
    submitting: "Đang gửi...",
    submit: "Gửi yêu cầu",
  },
  footer: {
    poweredBy: "Được cung cấp bởi",
  },
}

/**
 * Localized system copy for public profiles. Supplier-entered names, descriptions,
 * certification details, country values and address data are intentionally left
 * unchanged; standard acronyms and trade terms remain in their canonical form.
 */
export const PROFILE_COPY: Record<Locale, ProfileCopy> = { en, vi }

export function getProfileCopy(locale: Locale): ProfileCopy {
  return PROFILE_COPY[locale]
}
