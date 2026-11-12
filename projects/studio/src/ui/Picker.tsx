import { Download } from 'lucide-react';
import { motion } from 'motion/react';
import { scenarioById, scenarios } from '../content/scenarios';
import * as A from '../runtime/actions';
import { useStore } from '../runtime/store';
import { Icon } from './Icon';
import { exportVisit } from './Panels';
import { Mark } from './Studio';

export function Picker() {
  const visits = useStore((s) => s.visits);
  return (
    <div className="picker relative flex h-full flex-col overflow-y-auto">
      <Ambient />
      <header className="relative z-10 flex items-center gap-2.5 px-8 pt-7">
        <Mark />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">RIVECT Studio</span>
        {import.meta.env.MODE === 'portal'
          ? <a className="btn ghost ml-auto" href="/portal">Mis proyectos</a>
          : <span className="ml-auto text-[12.5px] text-fg-3">Demostración interactiva · funciona sin conexión</span>}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center px-8 py-10">
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[16ch] text-[clamp(40px,5.4vw,68px)] font-semibold leading-[1.02] tracking-[-0.035em]"
        >
          ¿Qué tipo de negocio querés recorrer?
        </motion.h1>
        <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-fg-2">
          Elegí un rubro y mirá una situación cotidiana en movimiento: el problema, la solución funcionando y lo que cambia.
        </p>

        <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {scenarios.map((sc, i) => (
            <motion.article
              key={sc.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="biz group"
            >
              <button className="flex flex-1 flex-col items-start text-left" onClick={() => A.startScenario(sc.id, 'tour')}>
                <span className="biz-icon"><Icon name={sc.business.icon} size={22} /></span>
                <span className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">{sc.business.label}</span>
                <span className="mt-1 text-[14.5px] text-fg-2">{sc.business.tagline}</span>
              </button>
              {sc.id === 'restaurante' && import.meta.env.MODE === 'portal' && (
                <a className="btn mt-5 w-full justify-center" href="/studio/restaurantes/">Abrir demo de gestión</a>
              )}
              <div className="mt-6 flex items-center gap-2">
                <button className="btn primary" onClick={() => A.startScenario(sc.id, 'tour')}>Iniciar recorrido</button>
                <button className="btn ghost" onClick={() => A.startScenario(sc.id, 'free')}>Explorar libre</button>
              </div>
            </motion.article>
          ))}
        </div>

        {!!visits.length && (
          <section className="mt-12">
            <h2 className="text-[13px] text-fg-3">Visitas guardadas</h2>
            <ul className="mt-2 divide-y divide-line-soft border-y border-line-soft">
              {visits.slice(0, 6).map((v) => {
                const sc = scenarioById(v.scenarioId);
                return (
                  <li key={v.id} className="flex items-center gap-4 py-2.5 text-[14px]">
                    <span className="font-medium">{v.businessName || 'Sin nombre'}</span>
                    <span className="text-fg-3">{sc?.business.label}</span>
                    <span className="text-fg-3">{v.problems.length} problemas · {v.modules.length} módulos</span>
                    <span className="ml-auto font-mono text-[12px] text-fg-3">{new Date(v.updatedAt).toLocaleDateString('es-AR')}</span>
                    {sc && (
                      <button className="text-fg-2 hover:text-brand" title="Exportar" onClick={() => exportVisit(sc, v)}>
                        <Download size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
      <footer className="relative z-10 px-8 pb-6 text-[12px] text-fg-3">
        Todo lo que se ve es una simulación con datos de ejemplo. Las conexiones reales se definen con cada negocio.
      </footer>
    </div>
  );
}

/** One quiet living line: a message travelling through three systems. The product, in miniature. */
function Ambient() {
  return (
    <svg className="ambient pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path id="amb" d="M1460 170 C1260 170 1240 330 1060 330 S 860 520 700 560 S 420 600 -40 600" fill="none" />
      <use href="#amb" className="amb-line" />
      {[[1060, 330], [700, 560]].map(([x, y]) => <rect key={x} x={x - 9} y={y - 9} width="18" height="18" rx="5" className="amb-node" />)}
      <circle r="4.5" className="amb-dot"><animateMotion dur="9s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1"><mpath href="#amb" /></animateMotion></circle>
    </svg>
  );
}
