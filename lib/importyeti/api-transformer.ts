/**
 * ImportYeti API Response Transformer
 * 
 * Transforms raw ImportYeti API JSON response into Lead form input format.
 * Handles complex field transformations:
 *   - time_series → top 3 peak/low months
 *   - avg_teu_per_month → import trend calculation
 *   - suppliers_table + date_range → purchase history summary
 */

import type { CreateLeadWithAIMatchingInput } from "@/app/admin/leads/new/actions"

// ══════════════════════════════════════════════════════════════════════════════
// ImportYeti API Response Types
// ══════════════════════════════════════════════════════════════════════════════

export interface ImportYetiTimeSeriesEntry {
  shipments: number
  weight: number
  teu: number
}

export interface ImportYetiContainer {
  type: string
  length: string
  group: string
  shipments: number
  weight: number
  teu: number
  count: number
}

export interface ImportYetiHsCode {
  hs_code: string
  shipments: number
  shipments_12m: number
  weight: number
  teu: number
  description: string
  children?: ImportYetiHsCode[]
}

export interface ImportYetiSupplier {
  supplier_name: string
  supplier_address: string
  supplier_address_country: string
  key: string
  total_shipments_company: number
  shipments_percents_company: number
  total_shipments_supplier: number
  shipments_percents_supplier: number
  shipments_12m: number
  total_weight: number
  total_teus: number
  country: string
  country_code: string
  most_recent_shipment: string
  first_shipment: string
  is_new_supplier: boolean
  business_length: string
  product_descriptions?: string[]
}

export interface ImportYetiBol {
  date_formatted: string
  Bill_of_Lading: string
  Master_Bill_of_Lading: string | null
  Bill_Type_Code: string
  Country: string
  Weight_in_KG: string
  TEU: string
  Quantity: string
  Quantity_Unit: string
  Shipper_Name: string
  Shipper_Address: string
  Consignee_Name: string
  Consignee_Address: string
  Notify_Party_Name: string
  Notify_Party_Address: string
  Product_Description: string
  HS_Code: string
  country_code: string
  consignee_basename: string
  shipper_basename: string
  shipping_route: string
  shipping_cost: number
  company_url: string
  supplier_url: string
  supplier_address_country: string
  supplier_address_loc: string
  company_address_country: string
  company_address_loc: string
  lcl: boolean
  containers_count: number
}

export interface ImportYetiMapTable {
  port_to_port_geographic: Array<{
    exit_port_country: string
    exit_port: string
    entry_port: string
  }>
  exit_ports: Record<string, {
    port_location: { lat: number; lon: number }
    shipments: number
  }>
  entry_ports: Record<string, {
    port_location: { lat: number; lon: number }
    shipments: number
  }>
  shipments_by_country: Record<string, number>
}

export interface ImportYetiAPIData {
  title: string
  also_known_names?: string[]
  address: string
  address_plain: string
  other_addresses_contact_info?: Array<{
    address: string
    most_recent_shipment_to: string
    contact_info_data: {
      emails: string[]
      phone_numbers: string[]
    }
  }>
  website: string
  other_websites?: Array<{ website: string; frequency: number }>
  phone_number: string
  total_shipments: number
  country: string
  country_code: string
  containers: ImportYetiContainer[]
  container_types?: Record<string, number>
  containers_load?: {
    less: { shipments: number; shipments_perc: number; weight: number; weight_perc: number; teu: number; teu_perc: number }
    full: { shipments: number; shipments_perc: number; weight: number; weight_perc: number; teu: number; teu_perc: number }
  }
  map_table: ImportYetiMapTable
  lane_permutations?: Array<{
    exit_port: string
    exit_port_country: string
    entry_port: string
    entry_port_country: string
    entry_port_region: string
    shipments: number
    shipments_percents: number
    weight: number
    teu: number
  }>
  date_range: {
    start_date: string
    end_date: string
  }
  time_series: Record<string, ImportYetiTimeSeriesEntry>
  hs_codes: ImportYetiHsCode[]
  bill_type_shipments?: { regular: number; house: number }
  suppliers_table: ImportYetiSupplier[]
  notify_party_table?: Array<{ notify_party: string; shipments: number; internal: boolean }>
  recent_bols: ImportYetiBol[]
  total_shipping_cost: string
  avg_teu_per_shipment: {
    "12m": number
    "24m": number
    "36m": number
    "12_24m": number
    "24_36m": number
  }
  avg_teu_per_month: {
    "12m": number
    "24m": number
    "36m": number
    "12_24m": number
    "24_36m": number
  }
}

export interface ImportYetiAPIResponse {
  requestCost: number
  creditsRemaining: number
  executionTime: string
  data: ImportYetiAPIData
}

// ══════════════════════════════════════════════════════════════════════════════
// Transform Helper Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Parse time_series to extract top 3 peak and low months by TEU.
 * 
 * Input format: { "01/11/2023": { shipments: 5671, weight: 61249712, teu: 12976 }, ... }
 * Output: { topPeakMonths: "11/2023 (12,976 TEU), 10/2023 (11,500 TEU), ...", topLowMonths: "..." }
 */
export function parseTimeSeries(timeSeries: Record<string, ImportYetiTimeSeriesEntry>): {
  topPeakMonths: string
  topLowMonths: string
  dataYear: number | null
} {
  if (!timeSeries || Object.keys(timeSeries).length === 0) {
    return { topPeakMonths: "", topLowMonths: "", dataYear: null }
  }

  // Convert to array and sort by TEU
  const months = Object.entries(timeSeries).map(([dateStr, data]) => {
    // dateStr format: "01/11/2023" (DD/MM/YYYY)
    const parts = dateStr.split("/")
    const month = parts[1] // MM
    const year = parts[2] // YYYY
    return {
      original: dateStr,
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      teu: data.teu,
      shipments: data.shipments,
      displayMonth: `${month}/${year}`, // "11/2023"
    }
  })

  // Sort by TEU descending for peak months
  const sortedByTeu = [...months].sort((a, b) => b.teu - a.teu)
  
  // Top 3 peak months
  const topPeak = sortedByTeu.slice(0, 3)
  const topPeakMonths = topPeak
    .map(m => `${m.displayMonth} (${m.teu.toLocaleString()} TEU)`)
    .join(", ")

  // Top 3 low months (sort ascending)
  const sortedAsc = [...months].sort((a, b) => a.teu - b.teu)
  const topLow = sortedAsc.slice(0, 3)
  const topLowMonths = topLow
    .map(m => `${m.displayMonth} (${m.teu.toLocaleString()} TEU)`)
    .join(", ")

  // Get most recent year from data
  const years = months.map(m => m.year)
  const dataYear = years.length > 0 ? Math.max(...years) : null

  return { topPeakMonths, topLowMonths, dataYear }
}

/**
 * Calculate import trend by comparing 12-month average vs 12-24 month average.
 * 
 * Returns trend description: "Increasing (+15.3% YoY)" or "Stable (-2.1% YoY)" or "Decreasing (-12.5% YoY)"
 */
export function calculateImportTrend(avgTeuPerMonth: {
  "12m": number
  "24m": number
  "36m": number
  "12_24m": number
  "24_36m": number
}): {
  trend: "increasing" | "stable" | "decreasing"
  changePercent: number
  description: string
} {
  const current12m = avgTeuPerMonth["12m"]
  const previous12m = avgTeuPerMonth["12_24m"]

  if (!current12m || !previous12m || previous12m === 0) {
    return { trend: "stable", changePercent: 0, description: "Stable (no data)" }
  }

  const changePercent = ((current12m - previous12m) / previous12m) * 100

  let trend: "increasing" | "stable" | "decreasing"
  if (changePercent > 10) {
    trend = "increasing"
  } else if (changePercent < -10) {
    trend = "decreasing"
  } else {
    trend = "stable"
  }

  const sign = changePercent >= 0 ? "+" : ""
  const trendLabel = trend === "increasing" ? "Increasing" : trend === "decreasing" ? "Decreasing" : "Stable"
  const description = `${trendLabel} (${sign}${changePercent.toFixed(1)}% YoY)`

  return { trend, changePercent, description }
}

/**
 * Build purchase history summary from suppliers, date range, and recent BOLs.
 * 
 * Output example: "Active since 2015 | 436K shipments | Top: Al Karam (PK) - 9yr relationship"
 */
export function buildPurchaseHistory(
  suppliersTable: ImportYetiSupplier[],
  dateRange: { start_date: string; end_date: string },
  totalShipments: number
): string {
  const parts: string[] = []

  // Active since year
  if (dateRange?.start_date) {
    const startYear = dateRange.start_date.split("/")[2]
    if (startYear) {
      parts.push(`Active since ${startYear}`)
    }
  }

  // Total shipments formatted
  if (totalShipments) {
    const formatted = totalShipments >= 1000
      ? `${(totalShipments / 1000).toFixed(totalShipments >= 10000 ? 0 : 1)}K`
      : totalShipments.toString()
    parts.push(`${formatted} shipments`)
  }

  // Top supplier with relationship length
  if (suppliersTable && suppliersTable.length > 0) {
    const top = suppliersTable[0]
    const countryCode = top.country_code || top.country?.slice(0, 2).toUpperCase() || ""
    const businessLength = top.business_length || ""
    
    // Extract years from business_length like "9y 2m 24d"
    const yearsMatch = businessLength.match(/(\d+)y/)
    const years = yearsMatch ? `${yearsMatch[1]}yr` : ""
    
    if (years) {
      parts.push(`Top: ${top.supplier_name} (${countryCode}) - ${years} relationship`)
    } else {
      parts.push(`Top: ${top.supplier_name} (${countryCode})`)
    }
  }

  return parts.join(" | ")
}

/**
 * Format suppliers list for form field.
 * 
 * Output: "Al Karam Towel Industries (Pakistan), Supplier2 (China), ..."
 */
export function formatSuppliersList(suppliersTable: ImportYetiSupplier[], limit: number = 5): string {
  if (!suppliersTable || suppliersTable.length === 0) return ""

  return suppliersTable
    .slice(0, limit)
    .map(s => `${s.supplier_name} (${s.supplier_address_country || s.country})`)
    .join(", ")
}

/**
 * Format HS codes for secondary field.
 * 
 * Output: "9503: Tricycles, scooters..., 6302: Home fabrics..."
 */
export function formatHsCodes(hsCodes: ImportYetiHsCode[], skip: number = 1): string {
  if (!hsCodes || hsCodes.length <= skip) return ""

  return hsCodes
    .slice(skip)
    .map(hs => `${hs.hs_code}: ${hs.description}`)
    .join("; ")
}

/**
 * Format container types.
 * 
 * Output: "40ft General Purpose (230,427), 40ft Ventilated (65,164)"
 */
export function formatContainers(containers: ImportYetiContainer[]): string {
  if (!containers || containers.length === 0) return ""

  return containers
    .map(c => `${c.length} ${c.group.replace(" Container", "").replace(" (no ventilation)", "")} (${c.count.toLocaleString()})`)
    .join(", ")
}

/**
 * Format ports list from map_table.
 * 
 * Output: "Yantian (31,221), Shanghai (25,000), ..."
 */
export function formatPorts(ports: Record<string, { port_location: { lat: number; lon: number }; shipments: number }>, limit: number = 5): string {
  if (!ports || Object.keys(ports).length === 0) return ""

  const sorted = Object.entries(ports)
    .sort((a, b) => b[1].shipments - a[1].shipments)
    .slice(0, limit)

  return sorted
    .map(([name, data]) => `${name} (${data.shipments.toLocaleString()})`)
    .join(", ")
}

/**
 * Format import countries from shipments_by_country.
 * 
 * Output: "China (271,853), India (59,510), ..."
 */
export function formatImportCountries(shipmentsByCountry: Record<string, number>, limit: number = 5): string {
  if (!shipmentsByCountry || Object.keys(shipmentsByCountry).length === 0) return ""

  const sorted = Object.entries(shipmentsByCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  return sorted
    .map(([country, shipments]) => `${country} (${shipments.toLocaleString()})`)
    .join(", ")
}

/**
 * Extract company slug from ImportYeti URL.
 * 
 * Input: "https://importyeti.com/company/walmart" or "https://www.importyeti.com/company/wal-mart"
 * Output: "walmart" or "wal-mart"
 */
export function extractSlugFromUrl(url: string): string | null {
  if (!url) return null
  
  // Match patterns:
  // - https://importyeti.com/company/walmart
  // - https://www.importyeti.com/company/wal-mart
  // - importyeti.com/company/walmart
  const match = url.match(/importyeti\.com\/company\/([a-z0-9-]+)/i)
  return match ? match[1].toLowerCase() : null
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Transform Function
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Transform ImportYeti API response to Lead form input format.
 * 
 * This is the main function that takes raw API response and returns
 * an object ready to be passed to createLeadWithAIMatchingAction().
 */
export function transformImportYetiApiResponse(
  response: ImportYetiAPIResponse,
  importYetiUrl: string
): Partial<CreateLeadWithAIMatchingInput> {
  const data = response.data

  // Parse complex fields
  const { topPeakMonths, topLowMonths, dataYear } = parseTimeSeries(data.time_series)
  const importTrendResult = calculateImportTrend(data.avg_teu_per_month)
  const purchaseHistorySummary = buildPurchaseHistory(
    data.suppliers_table,
    data.date_range,
    data.total_shipments
  )

  // Get primary HS code and product
  const primaryHsCode = data.hs_codes?.[0]
  const hsCode = primaryHsCode?.hs_code || ""
  const mainProduct = primaryHsCode?.description || ""
  const secondaryHsCodes = formatHsCodes(data.hs_codes, 1)

  // Get BOL description from most recent BOL
  const recentBol = data.recent_bols?.[0]
  const bolDescription = recentBol?.Product_Description || ""

  // Format website (add https:// if missing)
  let website = data.website || ""
  if (website && !website.startsWith("http")) {
    website = `https://${website}`
  }

  return {
    // Section 1: THÔNG TIN ĐỊNH DANH
    companyName: data.title,
    importAddress: data.address_plain || data.address || "",
    website,
    importYetiLink: importYetiUrl,
    contactPhone: data.phone_number || "",
    country: data.country || "",
    // Note: contactPerson, contactTitle, contactEmail are NOT available from API

    // Section 2: DỮ LIỆU ĐỊNH LƯỢNG
    totalShipments: data.total_shipments,
    lastShipmentDate: data.date_range?.end_date || "",
    avgTeuPerMonth: data.avg_teu_per_month?.["12m"] || null,
    topPeakMonths,
    topLowMonths,
    peakMonthsDataYear: dataYear,
    importTrend: importTrendResult.description,

    // Section 3: MÃ HS & SẢN PHẨM
    hsCode,
    mainProduct,
    secondaryHsCodes,
    // Note: industry needs to be manually selected by LR

    // Section 4: CHUỖI CUNG ỨNG
    topSuppliers: formatSuppliersList(data.suppliers_table, 5),
    mainImportCountries: formatImportCountries(data.map_table?.shipments_by_country, 5),

    // Section 5: LOGISTICS
    originPorts: formatPorts(data.map_table?.exit_ports, 5),
    destinationPorts: formatPorts(data.map_table?.entry_ports, 5),
    containerTypes: formatContainers(data.containers),

    // Section 6: GHI CHÚ CHO AI
    bolDescription,
    purchaseHistory: purchaseHistorySummary,
    // Note: notes and priorityRating are manually entered by LR
  }
}

/**
 * Fetch and transform company data from ImportYeti API.
 * 
 * @param companySlug - The company slug (e.g., "walmart", "wal-mart")
 * @param apiKey - ImportYeti API key
 * @returns Transformed data ready for Lead form, or error
 */
export async function fetchAndTransformImportYetiData(
  companySlug: string,
  apiKey: string
): Promise<{ success: true; data: Partial<CreateLeadWithAIMatchingInput> } | { success: false; error: string }> {
  if (!companySlug) {
    return { success: false, error: "Company slug is required" }
  }

  if (!apiKey) {
    return { success: false, error: "ImportYeti API key is not configured" }
  }

  const apiUrl = `https://data.importyeti.com/v1.0/company/${encodeURIComponent(companySlug)}`
  const importYetiUrl = `https://importyeti.com/company/${companySlug}`

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Invalid ImportYeti API key" }
      }
      if (response.status === 404) {
        return { success: false, error: `Company "${companySlug}" not found on ImportYeti` }
      }
      if (response.status === 429) {
        return { success: false, error: "ImportYeti API rate limit exceeded. Please try again later." }
      }
      return { success: false, error: `ImportYeti API error: ${response.status} ${response.statusText}` }
    }

    const json: ImportYetiAPIResponse = await response.json()

    if (!json.data) {
      return { success: false, error: "Invalid response from ImportYeti API" }
    }

    const transformedData = transformImportYetiApiResponse(json, importYetiUrl)

    return { success: true, data: transformedData }
  } catch (error) {
    console.error("[ImportYeti] API fetch error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch data from ImportYeti" 
    }
  }
}
