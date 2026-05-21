"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Package,
  FileCheck,
  Globe,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ProductInfoStep } from "./steps/product-info-step"
import { ComplianceStep } from "./steps/compliance-step"
import { ExportExperienceStep } from "./steps/export-experience-step"
import { BusinessReadinessStep } from "./steps/business-readiness-step"
import {
  saveStepAnswersAction,
  completeAssessmentAction,
} from "@/app/client/onboarding/actions"
import type { AssessmentAnswers } from "@/lib/types/readiness"

// ============================================================
// Types
// ============================================================

interface ReadinessWizardProps {
  assessmentId: string
  initialStep: number
  initialAnswers: AssessmentAnswers
  companyName?: string
  language: "vi" | "en"
}

interface StepConfig {
  id: number
  key: keyof AssessmentAnswers
  title: string
  titleVi: string
  description: string
  descriptionVi: string
  icon: typeof Package
}

// ============================================================
// Step Configuration
// ============================================================

const STEPS: StepConfig[] = [
  {
    id: 1,
    key: "productInfo",
    title: "Product Information",
    titleVi: "Thông tin sản phẩm",
    description: "Tell us about your products and production capacity",
    descriptionVi: "Giới thiệu về sản phẩm và năng lực sản xuất của bạn",
    icon: Package,
  },
  {
    id: 2,
    key: "compliance",
    title: "Compliance & Documents",
    titleVi: "Chứng chỉ & Hồ sơ",
    description: "Your certifications and compliance documents",
    descriptionVi: "Các chứng chỉ và hồ sơ tuân thủ của bạn",
    icon: FileCheck,
  },
  {
    id: 3,
    key: "exportExperience",
    title: "Export Experience",
    titleVi: "Kinh nghiệm xuất khẩu",
    description: "Your history and experience in international trade",
    descriptionVi: "Lịch sử và kinh nghiệm trong thương mại quốc tế",
    icon: Globe,
  },
  {
    id: 4,
    key: "businessReadiness",
    title: "Business Readiness",
    titleVi: "Sẵn sàng kinh doanh",
    description: "Your operational readiness for US market",
    descriptionVi: "Sự sẵn sàng vận hành cho thị trường Mỹ",
    icon: Briefcase,
  },
]

// ============================================================
// Main Component
// ============================================================

export function ReadinessWizard({
  assessmentId,
  initialStep,
  initialAnswers,
  companyName,
  language,
}: ReadinessWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [answers, setAnswers] = useState<AssessmentAnswers>(initialAnswers)
  const [error, setError] = useState<string | null>(null)

  const isVi = language === "vi"
  const progress = (currentStep / STEPS.length) * 100
  const currentStepConfig = STEPS[currentStep - 1]
  const isLastStep = currentStep === STEPS.length
  const isFirstStep = currentStep === 1

  // ============================================================
  // Handlers
  // ============================================================

  function handleStepDataChange(
    stepKey: keyof AssessmentAnswers,
    data: AssessmentAnswers[keyof AssessmentAnswers]
  ) {
    setAnswers((prev) => ({
      ...prev,
      [stepKey]: data,
    }))
  }

  function handleNext() {
    if (!currentStepConfig) return

    const stepData = answers[currentStepConfig.key]
    const nextStep = currentStep + 1

    startTransition(async () => {
      setError(null)

      const result = await saveStepAnswersAction(
        assessmentId,
        currentStepConfig.key,
        stepData,
        nextStep
      )

      if (!result.ok) {
        setError(isVi ? "Lỗi lưu dữ liệu. Vui lòng thử lại." : "Error saving data. Please try again.")
        return
      }

      setCurrentStep(nextStep)
    })
  }

  function handlePrevious() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  function handleComplete() {
    if (!currentStepConfig) return

    const stepData = answers[currentStepConfig.key]

    startTransition(async () => {
      setError(null)

      // Save last step first
      const saveResult = await saveStepAnswersAction(
        assessmentId,
        currentStepConfig.key,
        stepData,
        currentStep
      )

      if (!saveResult.ok) {
        setError(isVi ? "Lỗi lưu dữ liệu. Vui lòng thử lại." : "Error saving data. Please try again.")
        return
      }

      // Complete assessment
      const completeResult = await completeAssessmentAction(assessmentId)

      if (!completeResult.ok) {
        setError(isVi ? "Lỗi hoàn tất đánh giá. Vui lòng thử lại." : "Error completing assessment. Please try again.")
        return
      }

      // Redirect to results
      router.push(`/client/onboarding/results?id=${assessmentId}`)
    })
  }

  // ============================================================
  // Render Step Content
  // ============================================================

  function renderStepContent() {
    switch (currentStep) {
      case 1:
        return (
          <ProductInfoStep
            data={answers.productInfo}
            onChange={(data) => handleStepDataChange("productInfo", data)}
            language={language}
          />
        )
      case 2:
        return (
          <ComplianceStep
            data={answers.compliance}
            onChange={(data) => handleStepDataChange("compliance", data)}
            language={language}
          />
        )
      case 3:
        return (
          <ExportExperienceStep
            data={answers.exportExperience}
            onChange={(data) => handleStepDataChange("exportExperience", data)}
            language={language}
          />
        )
      case 4:
        return (
          <BusinessReadinessStep
            data={answers.businessReadiness}
            onChange={(data) => handleStepDataChange("businessReadiness", data)}
            language={language}
          />
        )
      default:
        return null
    }
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {isVi ? "Đánh giá mức độ sẵn sàng xuất khẩu" : "Export Readiness Assessment"}
        </h1>
        <p className="text-muted-foreground">
          {companyName
            ? isVi
              ? `Chào mừng ${companyName}! Hãy hoàn thành đánh giá để chúng tôi hiểu rõ hơn về doanh nghiệp của bạn.`
              : `Welcome ${companyName}! Complete this assessment so we can better understand your business.`
            : isVi
              ? "Hoàn thành đánh giá để chúng tôi hiểu rõ hơn về doanh nghiệp của bạn."
              : "Complete this assessment so we can better understand your business."}
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isVi ? `Bước ${currentStep} / ${STEPS.length}` : `Step ${currentStep} of ${STEPS.length}`}
          </span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon
          const isCompleted = currentStep > step.id
          const isCurrent = currentStep === step.id

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center",
                index < STEPS.length - 1 && "flex-1"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-background text-primary",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium text-center max-w-[80px]",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {isVi ? step.titleVi : step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStepConfig && (
              <>
                <currentStepConfig.icon className="h-5 w-5 text-primary" />
                {isVi ? currentStepConfig.titleVi : currentStepConfig.title}
              </>
            )}
          </CardTitle>
          <CardDescription>
            {currentStepConfig &&
              (isVi ? currentStepConfig.descriptionVi : currentStepConfig.description)}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstStep || isPending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {isVi ? "Quay lại" : "Previous"}
        </Button>

        {isLastStep ? (
          <Button onClick={handleComplete} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isVi ? "Đang xử lý..." : "Processing..."}
              </>
            ) : (
              <>
                {isVi ? "Hoàn tất đánh giá" : "Complete Assessment"}
                <CheckCircle2 className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isVi ? "Đang lưu..." : "Saving..."}
              </>
            ) : (
              <>
                {isVi ? "Tiếp theo" : "Next"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
