import { cn } from '@/utils/format'

/** React Bits · Aurora — fondo de gradientes animados (port local, sin dependencias). */
export function Aurora({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div
        className="absolute -left-24 -top-40 h-[420px] w-[420px] rounded-full opacity-60 blur-[110px]"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(91,149,255,0.65), rgba(47,116,255,0.05) 70%)',
          animation: 'auroraDrift 18s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute -right-20 top-0 h-[380px] w-[380px] rounded-full opacity-50 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle at 60% 40%, rgba(74,222,159,0.35), rgba(74,222,159,0) 70%)',
          animation: 'auroraDrift 22s ease-in-out infinite alternate-reverse',
        }}
      />
      <div
        className="absolute bottom-[-160px] left-1/3 h-[360px] w-[360px] rounded-full opacity-40 blur-[110px]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(138,181,255,0.4), rgba(47,116,255,0) 70%)',
          animation: 'auroraDrift 26s ease-in-out infinite alternate',
        }}
      />
      <style>{`
        @keyframes auroraDrift {
          0% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(40px, 30px, 0) scale(1.08); }
          100% { transform: translate3d(-30px, -20px, 0) scale(0.98); }
        }
      `}</style>
    </div>
  )
}
