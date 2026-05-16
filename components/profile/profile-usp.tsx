"use client"

import {
  Clock,
  Award,
  Globe,
  Factory,
  Shield,
  Leaf,
  CheckCircle,
  Star,
  Zap,
  Users,
  TrendingUp,
  Package,
} from "lucide-react"
import type { ClientProfileWithRelations, USPPoint } from "@/lib/supabase/types"

interface ProfileUSPProps {
  profile: ClientProfileWithRelations
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  award: Award,
  globe: Globe,
  factory: Factory,
  shield: Shield,
  leaf: Leaf,
  check: CheckCircle,
  star: Star,
  zap: Zap,
  users: Users,
  trending: TrendingUp,
  package: Package,
}

export function ProfileUSP({ profile }: ProfileUSPProps) {
  const uspPoints = profile.usp_points || []

  if (uspPoints.length === 0) return null

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-8 text-center">
          Why Choose Us
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {uspPoints.map((point: USPPoint, index: number) => {
            const IconComponent = iconMap[point.icon?.toLowerCase()] || CheckCircle

            return (
              <div
                key={index}
                className="flex flex-col items-center text-center p-6 rounded-xl bg-card border border-border hover:border-accent/50 hover:shadow-md transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <IconComponent className="w-7 h-7 text-accent" />
                </div>
                <p className="text-sm sm:text-base font-medium text-foreground text-balance">
                  {point.title}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
