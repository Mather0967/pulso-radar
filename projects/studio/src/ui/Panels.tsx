import { Check, User, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LIB, type LibKey } from '../content/dsl';
import { integrations } from '../content/integrations';
import type { Comparison, Scenario, StepNode, VisitRecord } from '../engine/types';
import * as A from '../runtime/actions';
import { useStore } from '../runtime/store';
import { CredBadge } from './CredBadge';
import { Icon } from './Icon';

const pop = { initial: { opacity: 0, y: -6, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -6, scale: 0.98 }, transition: { duration: 0.18 } };
const actorLabel = { system: 'Automático', ai: 'Inteligencia artificial', human: 'Una persona del negocio' } as const;
const ActorIcon = ({ a }: { a: StepNode['actor'] }) => (a === 'human' ? <User size={13} /> : a === 'ai' ? <b className="text-[9.5px]">IA</b> : <Zap size={12} />);

/* ── node detail ── */

export function NodeDetail({ sc }: { sc: Scenario }) {
  const id = useStore((s) => s.openNode);
  const expanded = useStore((s) => s.scene.expanded);
  const modules = useStore((s) => s.visit?.modules ?? []);
  const [ownerId, localId] = id?.split('/') ?? [];
  const macro = sc.nodes.find((m) => m.id === ownerId);
  const cmp = sc.comparisons.find((c) => c.id === ownerId);
  const step = localId
    ? macro?.subflow.nodes.find((s) => s.id === localId) ?? (cmp && [...cmp.before.nodes, ...cmp.after.nodes].find((s) => s.id === localId))
    : undefined;
  const show = !!id && (!!macro || !!step);
  return (
    <AnimatePresence>
      {show && (
        <motion.aside key={id} {...pop} className="card absolute left-4 top-[68px] z-30 w-[340px] p-4">
          <button className="absolute right-3 top-3 text-fg-3 hover:text-fg" onClick={() => A.openNode(null)} aria-label="Cerrar"><X size={16} /></button>
          {step ? (
            <>
              <div className="flex items-center gap-2 text-[12px] text-fg-3"><ActorIcon a={step.actor} /> {actorLabel[step.actor]}</div>
              <h3 className="mt-1.5 text-[18px] font-semibold tracking-[-0.01em]">{step.label}</h3>
              {macro && <p className="text-[12.5px] text-fg-3">Parte de {macro.label}</p>}
              {step.detail && <p className="mt-2.5 text-[14px] leading-relaxed text-fg-2">{step.detail}</p>}
              <div className="mt-3"><CredBadge integration={step.integration ?? macro?.integration} /></div>
            </>
          ) : macro && (
            <>
              <div className="flex items-center gap-3 pr-6">
                <span className="macro-icon"><Icon name={macro.icon} size={20} /></span>
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.01em]">{macro.label}</h3>
                  <p className="text-[13px] text-fg-2">{macro.blurb}</p>
                </div>
              </div>
              <ol className="mt-4 flex flex-col gap-1.5">
                {macro.subflow.nodes.map((s) => (
                  <li key={s.id}>
                    <button className="detail-step" onClick={() => A.openNode(`${macro.id}/${s.id}`)}>
                      <span className={`step-actor actor-${s.actor}`}><ActorIcon a={s.actor} /></span>
                      <span>{s.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-2">
                <button className="btn" onClick={() => A.toggleExpand(macro.id)}>{expanded.includes(macro.id) ? 'Cerrar en el mapa' : 'Abrir en el mapa'}</button>
                <button className={`btn ${modules.includes(macro.lib) ? 'on' : ''}`} onClick={() => A.toggleVisitList('modules', macro.lib)}>
                  {modules.includes(macro.lib) && <Check size={14} />} Le interesa
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <CredBadge integration={macro.integration} />
                <span className="text-[12px] text-fg-3">{LIB[macro.lib as LibKey]?.service}</span>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ── diagnosis / service focus ── */

export function FocusCard({ sc }: { sc: Scenario }) {
  const focus = useStore((s) => s.focus)!;
  const f = (focus.kind === 'diagnosis' ? sc.diagnosis : sc.services).find((x) => x.id === focus.id);
  if (!f) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto">
      <p className="caption">{f.blurb ?? f.label}</p>
      <div className="mt-3 flex gap-2">
        {(f.chapter || f.comparison) && <button className="btn primary" onClick={() => A.goToFocus(f)}>Ver cómo se resuelve</button>}
        <button className="btn" onClick={A.clearFocus}>Ver todo el mapa</button>
      </div>
    </motion.div>
  );
}

/* ── before / after ── */

export function CompareOverlay({ sc }: { sc: Scenario }) {
  const view = useStore((s) => s.scene.view);
  const control = useStore((s) => s.tour.control);
  const done = useStore((s) => s.sim.done);
  if (view.kind !== 'compare') return null;
  const cmp = sc.comparisons.find((c) => c.id === view.id);
  if (!cmp) return null;
  const n = (fate: string) => cmp.before.nodes.filter((x) => x.fate === fate).length;
  return (
    <motion.aside {...pop} className="card absolute inset-x-4 top-[64px] z-20 flex items-center gap-6 px-4 py-2.5">
      <div className="min-w-0 shrink-0">
        <h3 className="text-[14px] font-semibold">{cmp.title}</h3>
        <p className="text-[12.5px] text-fg-2">{cmp.caseLabel}</p>
      </div>
      {view.phase !== 'before' && (
        <dl className="flex items-center gap-5 text-[12.5px]">
          <Stat k="Pasos a mano hoy" v={cmp.before.nodes.length} />
          <Stat k="Dejan de hacer falta" v={n('removed')} tone="text-fg-3" />
          <Stat k="Se hacen solos" v={n('automated')} tone="text-brand" />
          <Stat k="Siguen en manos de una persona" v={n('human')} tone="text-human" />
        </dl>
      )}
      <Estimates cmp={cmp} show={view.phase === 'after'} />
      <span className="ml-auto shrink-0 text-[11.5px] text-fg-3">Escenario ilustrativo</span>
      {control === 'manual' && (
        view.phase === 'before'
          ? <button className={`btn ${done ? 'primary' : ''}`} onClick={() => A.startCompare(cmp.id, 'shift')}>Ver qué cambia</button>
          : view.phase === 'shift'
            ? <button className="btn primary" onClick={() => A.startCompare(cmp.id, 'after')}>Ver con RIVECT</button>
            : <button className="btn" onClick={() => A.startCompare(cmp.id, 'before')}>Repetir</button>
      )}
    </motion.aside>
  );
}

const Stat = ({ k, v, tone = 'text-fg' }: { k: string; v: number; tone?: string }) => (
  <div className="flex items-baseline gap-2">
    <dd className={`font-mono text-[18px] font-medium ${tone}`}>{v}</dd>
    <dt className="text-fg-2">{k}</dt>
  </div>
);

function Estimates({ cmp, show }: { cmp: Comparison; show: boolean }) {
  if (!show || !cmp.estimates?.length) return null;
  return (
    <div className="text-[12.5px]">
      {cmp.estimates.map((e) => (
        <div key={e.label} className="flex justify-between gap-2">
          <span className="text-fg-2">{e.label}</span>
          <span><s className="text-fg-3">{e.before}</s> → <b className="text-fg">{e.after}</b></span>
        </div>
      ))}
    </div>
  );
}

/* ── top-bar panels ── */

export function PanelHost({ sc }: { sc: Scenario }) {
  const panel = useStore((s) => s.panel);
  return (
    <AnimatePresence>
      {panel && (
        <motion.div key={panel} {...pop} className="card absolute right-4 top-[60px] z-40 max-h-[calc(100%-80px)] w-[380px] overflow-y-auto p-4">
          {panel === 'diagnosis' && <Diagnosis sc={sc} />}
          {panel === 'services' && <Services sc={sc} />}
          {panel === 'visit' && <Visit sc={sc} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Diagnosis({ sc }: { sc: Scenario }) {
  const problems = useStore((s) => s.visit?.problems ?? []);
  return (
    <>
      <h3 className="text-[16px] font-semibold">¿Qué le pasa hoy al negocio?</h3>
      <p className="mt-0.5 text-[13px] text-fg-2">Tocá lo que te cuenten. Queda anotado para la propuesta.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {sc.diagnosis.map((f) => (
          <button key={f.id} className={`chip ${problems.includes(f.id) ? 'on' : ''}`} onClick={() => { A.showFocus('diagnosis', f); A.setPanel(null); }}>
            {problems.includes(f.id) && <Check size={13} />}{f.label}
          </button>
        ))}
      </div>
    </>
  );
}

function Services({ sc }: { sc: Scenario }) {
  return (
    <>
      <h3 className="text-[16px] font-semibold">Qué hace RIVECT</h3>
      <p className="mt-0.5 text-[13px] text-fg-2">Cada servicio, en el lugar del negocio donde actúa.</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {sc.services.map((f) => (
          <button key={f.id} className="detail-step flex-col !items-start" onClick={() => { A.showFocus('services', f); A.setPanel(null); }}>
            <span className="text-[14px] font-medium text-fg">{f.label}</span>
            <span className="text-[12.5px] text-fg-2">{f.blurb}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Visit({ sc }: { sc: Scenario }) {
  const visit = useStore((s) => s.visit);
  const saved = useStore((s) => s.visits);
  if (!visit) return null;
  const isSaved = saved.some((v) => v.id === visit.id && v.updatedAt === visit.updatedAt);
  return (
    <>
      <h3 className="text-[16px] font-semibold">Lo que vimos hoy</h3>
      <p className="mt-0.5 text-[13px] text-fg-2">Se guarda en esta computadora para armar la propuesta después.</p>
      <label className="field mt-3"><span>Negocio</span>
        <input value={visit.businessName} placeholder={`Nombre de la ${sc.business.label.toLowerCase()}`} onChange={(e) => A.updateVisit({ businessName: e.target.value })} />
      </label>
      <label className="field"><span>Contacto</span>
        <input value={visit.contact} placeholder="Nombre y teléfono" onChange={(e) => A.updateVisit({ contact: e.target.value })} />
      </label>
      <Section title="Problemas que contaron">
        {sc.diagnosis.map((f) => (
          <button key={f.id} className={`chip sm ${visit.problems.includes(f.id) ? 'on' : ''}`} onClick={() => A.toggleVisitList('problems', f.id)}>{f.label}</button>
        ))}
      </Section>
      <Section title="Módulos que le interesaron">
        {sc.nodes.map((m) => (
          <button key={m.id} className={`chip sm ${visit.modules.includes(m.lib) ? 'on' : ''}`} onClick={() => A.toggleVisitList('modules', m.lib)}>{m.label}</button>
        ))}
      </Section>
      <label className="field"><span>Notas</span>
        <textarea rows={3} value={visit.notes} placeholder="Lo que conviene recordar para la propuesta" onChange={(e) => A.updateVisit({ notes: e.target.value })} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn primary" onClick={A.saveVisit}>{isSaved ? <><Check size={14} /> Guardado</> : 'Guardar visita'}</button>
        <button className="btn" onClick={() => exportVisit(sc, visit)}>Exportar</button>
        <button className="btn" onClick={() => window.print()}>Imprimir resumen</button>
      </div>
      <button className="mt-3 text-[12.5px] text-fg-3 underline-offset-2 hover:text-fg hover:underline" onClick={A.startNewVisit}>Empezar una visita nueva</button>
    </>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-3">
    <div className="mb-1.5 text-[12.5px] text-fg-3">{title}</div>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

/** JSON for the later proposal. Each module carries its credibility so a proposal cannot upgrade a claim. */
export function exportVisit(sc: Scenario, v: VisitRecord) {
  const modules = v.modules.map((lib) => {
    const m = sc.nodes.find((n) => n.lib === lib);
    const integ = m?.integration ? integrations[m.integration] : undefined;
    return { lib, label: m?.label ?? lib, service: LIB[lib as LibKey]?.service, credibility: integ?.status ?? 'simulated' };
  });
  const problems = v.problems.map((id) => sc.diagnosis.find((d) => d.id === id)?.label ?? id);
  const data = { ...v, business: sc.business.label, problemLabels: problems, moduleDetails: modules };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `visita-${(v.businessName || sc.business.label).toLowerCase().replace(/\s+/g, '-')}-${v.createdAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Printable summary (hidden on screen, shown by @media print). */
export function VisitPrint({ sc }: { sc: Scenario }) {
  const v = useStore((s) => s.visit);
  if (!v) return null;
  return (
    <div className="print-only">
      <h1>{v.businessName || sc.business.label}</h1>
      <p>{v.contact} · {new Date(v.updatedAt).toLocaleDateString('es-AR')}</p>
      <h2>Problemas que contaron</h2>
      <ul>{v.problems.map((id) => <li key={id}>{sc.diagnosis.find((d) => d.id === id)?.label}</li>)}</ul>
      <h2>Módulos que le interesaron</h2>
      <ul>{v.modules.map((lib) => <li key={lib}>{sc.nodes.find((n) => n.lib === lib)?.label} — {LIB[lib as LibKey]?.service}</li>)}</ul>
      {v.notes && <><h2>Notas</h2><p>{v.notes}</p></>}
      <p className="muted">Resumen de una demostración con datos de ejemplo. Las integraciones reales se definen junto al negocio. RIVECT.</p>
    </div>
  );
}
