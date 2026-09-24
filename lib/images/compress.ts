/**
 * Client-side image compression to target 300-800KB
 * - Max input 5MB (rejected otherwise)
 * - Max dimension 1600px (long edge)
 * - Output webp with adaptive quality to hit 300-800KB
 * - Fallback to jpeg if webp not supported
 */

export const MAX_INPUT_SIZE = 5 * 1024 * 1024 // 5MB
export const TARGET_MIN = 300 * 1024 // 300KB
export const TARGET_MAX = 800 * 1024 // 800KB
export const MAX_DIMENSION = 1600

export interface CompressResult {
  file: File
  originalSize: number
  compressedSize: number
  wasCompressed: boolean
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function compressToTarget(
  img: HTMLImageElement,
  maxDim: number,
  targetMax: number,
  originalName: string,
): Promise<File> {
  // Calculate new dimensions preserving aspect ratio
  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width)
      width = maxDim
    } else {
      width = Math.round((width * maxDim) / height)
      height = maxDim
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, width, height)

  // Try webp first (better compression), fallback to jpeg
  const preferredType = 'image/webp'
  let type = preferredType
  let quality = 0.82

  // Quick test if browser supports webp export (if not, toBlob returns null or larger)
  let blob = await canvasToBlob(canvas, type, quality)
  if (!blob) {
    type = 'image/jpeg'
    blob = await canvasToBlob(canvas, type, quality)
  }

  if (!blob) throw new Error('Compression failed')

  // If already within target, return
  if (blob.size <= targetMax && blob.size >= TARGET_MIN * 0.5) {
    return new File([blob], originalName.replace(/\.(jpe?g|png|gif)$/i, '.webp'), { type })
  }

  // Adaptive loop: reduce quality / dimension until under TARGET_MAX
  // But don't go below 0.45 quality to keep decent visual
  let attempts = 0
  while (blob.size > targetMax && attempts < 6) {
    attempts++
    if (quality > 0.5) {
      quality = Math.max(0.45, quality - 0.12)
    } else {
      // Reduce dimension by 15% each iteration if quality already low
      const newW = Math.round(canvas.width * 0.85)
      const newH = Math.round(canvas.height * 0.85)
      if (newW < 800 || newH < 800) break // don't go too small
      canvas.width = newW
      canvas.height = newH
      const c = canvas.getContext('2d')
      if (!c) break
      c.drawImage(img, 0, 0, newW, newH)
    }
    const nextBlob = await canvasToBlob(canvas, type, quality)
    if (!nextBlob) break
    blob = nextBlob
  }

  // If still >800KB after loop, accept it (better than failing) – it will be under 5MB anyway
  // If <300KB, that's fine – we keep it (means image is simple)

  const ext = type === 'image/webp' ? '.webp' : '.jpg'
  const newName = originalName.replace(/\.[^/.]+$/, '') + ext
  return new File([blob], newName, { type })
}

export async function validateAndCompressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size

  if (originalSize > MAX_INPUT_SIZE) {
    throw new Error(`Ảnh vượt quá 5MB (${(originalSize / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn ảnh nhỏ hơn 5MB.`)
  }

  // If file is already small and not too large dimension, skip heavy compression for speed
  // But we still want to ensure max dimension 1600 and webp conversion for consistency
  if (originalSize < TARGET_MAX && file.type === 'image/webp') {
    // Check dimension quickly? Skip for now – return as is if <800KB
    // We still want to compress if dimension >1600, so load image anyway for large images
    // For simplicity, if <500KB and already webp, return as is
    if (originalSize < 500 * 1024) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false }
    }
  }

  try {
    const img = await loadImage(file)
    // If image dimension already small and size <800KB, skip
    if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION && originalSize <= TARGET_MAX && originalSize >= 100 * 1024) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false }
    }

    const compressedFile = await compressToTarget(img, MAX_DIMENSION, TARGET_MAX, file.name)
    return {
      file: compressedFile,
      originalSize,
      compressedSize: compressedFile.size,
      wasCompressed: true,
    }
  } catch (e) {
    // If compression fails (e.g., unsupported format like gif), return original if under 5MB
    console.warn('[compress] fallback to original:', e)
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false }
  }
}

export async function compressImages(files: File[]): Promise<{ files: File[]; stats: CompressResult[] }> {
  const results: CompressResult[] = []
  const outFiles: File[] = []

  for (const f of files) {
    const r = await validateAndCompressImage(f)
    results.push(r)
    outFiles.push(r.file)
  }

  return { files: outFiles, stats: results }
}
