import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SpotlightCard } from '@/components/reactbits/SpotlightCard'
import { GlareHover } from '@/components/reactbits/GlareHover'
import { NAV_ITEMS } from '@/components/layout/nav'

export interface ModuleStat {
  to: string
  stat: string
  statLabel: string
  ready?: boolean
}

export function ModuleGrid({ stats }: { stats: ModuleStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {NAV_ITEMS.filter((item) => item.to !== '/overview').map((item) => {
        const stat = stats.find((s) => s.to === item.to)
        return (
          <Link key={item.to} to={item.to} className="block focus:outline-none">
            <SpotlightCard className="h-full">
              <GlareHover>
                <div className="flex h-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-ink-800 text-brand-300">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-300" />
                  </div>
                  <div className="mt-5">
                    <p className="font-display text-sm font-medium text-slate-100">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{item.description}</p>
                    {stat ? (
                      <div className="mt-3 flex items-baseline gap-1.5 border-t border-line/70 pt-3">
                        <span className="font-display text-lg font-semibold text-white">{stat.stat}</span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          {stat.statLabel}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </GlareHover>
            </SpotlightCard>
          </Link>
        )
      })}
    </div>
  )
}
