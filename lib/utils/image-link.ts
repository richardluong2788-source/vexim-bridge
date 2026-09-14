/**
 * Helpers cho thao tác thêm ảnh bằng link ngoài thay vì upload file.
 *
 * Khi người dùng dán link ảnh (Google Drive đã chia sẻ công khai, Imgur,
 * CDN của nhà cung cấp...), hệ thống chỉ lưu mỗi dòng URL vào DB — không
 * có byte ảnh nào đi qua server hay tốn dung lượng Vercel Blob.
 */

/** Kiểm tra một chuỗi có phải URL http(s) hợp lệ không. */
export function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Tách một đoạn text dán vào (có thể chứa 1 hoặc nhiều link, cách nhau bởi
 * dấu cách/xuống dòng/dấu phẩy) thành danh sách URL http(s) hợp lệ, tự động
 * loại trùng và loại các link đã có sẵn trong `existing`.
 */
export function parseImageLinks(input: string, existing: string[] = []): string[] {
  const seen = new Set(existing.map((url) => url.trim()))
  const result: string[] = []

  for (const raw of input.split(/[\s,]+/)) {
    const piece = raw.trim()
    if (!piece || !isValidImageUrl(piece)) continue
    if (seen.has(piece)) continue
    seen.add(piece)
    result.push(piece)
  }

  return result
}

/**
 * Chuyển link Google Drive dạng xem trên web sang link ảnh trực tiếp.
 * VD: https://drive.google.com/file/d/FILE_ID/view -> https://drive.usercontent.google.com/download?id=FILE_ID
 * Các link không phải Google Drive được giữ nguyên.
 */
export function normalizeImageLink(input: string): string {
  const raw = input.trim()

  const driveMatch = raw.match(
    /(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=)([A-Za-z0-9_-]+)/,
  )
  if (driveMatch?.[1]) {
    return `https://drive.usercontent.google.com/download?id=${driveMatch[1]}`
  }

  return raw
}
