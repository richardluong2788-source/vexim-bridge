import { NextRequest, NextResponse } from 'next/server'
import { updateM2Target } from '@/app/admin/sla/actions'

/**
 * Quick API endpoint to update M2 (monthly_qualified_leads) target to 2
 * POST /api/sla/update-m2-target
 */
export async function POST(req: NextRequest) {
  try {
    const result = await updateM2Target(2)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json({ ok: true, message: 'M2 updated to 2' })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
