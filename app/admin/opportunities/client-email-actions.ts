"use server"

import { sendMail, SENDERS } from "@/lib/email/mailer"
import { createClient } from "@/lib/supabase/server"

interface SendClientStatusEmailInput {
  opportunityId: string
  clientEmail: string
  clientName: string
  buyerCompany: string
  currentStage: string
  stageLabel: string
}

export async function sendClientStatusEmail(input: SendClientStatusEmailInput) {
  const { clientEmail, clientName, buyerCompany, currentStage, stageLabel } = input

  if (!clientEmail) {
    return { success: false, error: "Client email not found" }
  }

  const supabase = await createClient()
  
  // Get current user (AE) info
  const { data: { user } } = await supabase.auth.getUser()
  const aeName = user?.user_metadata?.full_name || "Account Executive"

  const subject = `[Vexim Trade] Cập nhật trạng thái: ${buyerCompany}`

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; margin-bottom: 24px;">Cập nhật trạng thái thương vụ</h2>
      
      <p style="color: #333; font-size: 15px; line-height: 1.6;">
        Xin chào <strong>${clientName}</strong>,
      </p>
      
      <p style="color: #333; font-size: 15px; line-height: 1.6;">
        Chúng tôi xin gửi đến bạn thông tin cập nhật về thương vụ với <strong>${buyerCompany}</strong>:
      </p>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
        <p style="margin: 0; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Trạng thái hiện tại</p>
        <p style="margin: 8px 0 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">${stageLabel}</p>
      </div>
      
      <p style="color: #333; font-size: 15px; line-height: 1.6;">
        Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ trực tiếp với chúng tôi.
      </p>
      
      <p style="color: #333; font-size: 15px; line-height: 1.6; margin-top: 32px;">
        Trân trọng,<br/>
        <strong>${aeName}</strong><br/>
        <span style="color: #666;">Vexim Trade</span>
      </p>
    </div>
  `

  const result = await sendMail({
    from: SENDERS.trade,
    to: clientEmail,
    subject,
    html,
  })

  if (result.error) {
    console.error("[sendClientStatusEmail] Error:", result.error.message)
    return { success: false, error: result.error.message }
  }

  return { success: true, emailId: result.data?.id }
}
