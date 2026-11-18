import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SpotlightCard } from '@/components/reactbits/SpotlightCard'
import { Stagger, StaggerItem } from '@/components/reactbits/Stagger'
import { TiltCard } from '@/components/reactbits/TiltCard'
import { NAV_ITEMS } from '@/components/layout/nav'

export interface ModuleStat {
  to: string
  stat: string
  statLabel: string
  ready?: boolean
}

export function ModuleGrid({ stats }: { stats: ModuleStat[] }) {
  return (
    <Stagger>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {NAV_ITEMS.filter((item) => item.to !== '/overview').map((item) => {
          const stat = stats.find((s) => s.to === item.to)
          return (
            <StaggerItem key={item.to}>
              <TiltCard className="h-full">
                <Link to={item.to} className="group/card block h-full focus:outline-none">
                  <SpotlightCard className="h-full transition-all duration-300 group-hover/card:border-brand-500/40">
                    <>
                      <div className="flex h-full flex-col justify-between p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line/80 bg-ink-800 text-brand-300 transition-all duration-300 group-hover/card:border-brand-500/50 group-hover/card:bg-brand-500/20 group-hover/card:text-brand-200 group-hover/card:shadow-[0_0_16px_rgba(255,118,46,0.3)]">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform duration-300 group-hover/card:translate-x-1 group-hover/card:-translate-y-1 group-hover/card:text-brand-300" />
                        </div>
                        <div className="mt-6">
                          <p className="font-display text-base font-semibold text-slate-100 transition-colors group-hover/card:text-white">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
                          {stat ? (
                            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-line/70 pt-3">
                              <span className="font-display text-xl font-bold tracking-tight text-white">{stat.stat}</span>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {stat.statLabel}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  </SpotlightCard>
                </Link>
              </TiltCard>
            </StaggerItem>
          )
        })}
      </div>
    </Stagger>
  )
}
