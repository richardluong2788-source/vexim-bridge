"use client"

import { Factory, Package, Truck } from "lucide-react"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileStatsProps {
  profile: ClientProfileWithRelations
}

export function ProfileStats({ profile }: ProfileStatsProps) {
  const hasStats =
    profile.production_capacity || profile.moq || profile.lead_time_days

  if (!hasStats) return null

  const stats = [
    {
      icon: Factory,
      label: "Production Capacity",
      value: profile.production_capacity,
    },
    {
      icon: Package,
      label: "Minimum Order",
      value: profile.moq,
    },
    {
      icon: Truck,
      label: "Lead Time",
      value: profile.lead_time_days,
    },
  ].filter((s) => s.value)

  return (
    <section className="py-12 sm:py-16 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-10 text-center">
          Production Capability
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                  <Icon className="w-8 h-8 text-accent" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold mb-2">{stat.value}</p>
                <p className="text-sm text-primary-foreground/80">{stat.label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
