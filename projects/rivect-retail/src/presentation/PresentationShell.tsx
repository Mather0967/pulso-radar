import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ActionIcon,
  Badge,
  Box,
  Drawer,
  Group,
  Kbd,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Maximize,
  Minimize,
  Radio,
  StickyNote,
} from 'lucide-react'
import { Aurora } from '@/components/reactbits/Aurora'
import { RevealText } from '@/components/reactbits/RevealText'
import { OverviewPage } from '@/features/retail-overview/OverviewPage'
import { SimulatorPage } from '@/features/business-simulator/SimulatorPage'
import { AssistantPage } from '@/features/sales-assistant/AssistantPage'
import { RecoveryPage } from '@/features/customer-recovery/RecoveryPage'
import { StockPage } from '@/features/stock-intelligence/StockPage'
import { CampaignsPage } from '@/features/smart-campaigns/CampaignsPage'
import { ReportPage } from '@/features/impact-report/ReportPage'
import { scenes, type Scene, type SceneSlug } from '@/presentation/scenes'
import { usePresenter } from '@/presentation/usePresenter'
import { LivePanel, LiveDot } from '@/presentation/LivePanel'
import { EASE_OUT } from '@/theme/motion'

const MANDARIN = '#FF762E'
const MIDNIGHT = '#11222C'
const SLATE = '#405C6B'
const WARM = '#F7F5EF'
const SCENE_IN = 0.35
const SCENE_OUT = 0.2
const SLIDE_PX = 56

const PAGES: Record<SceneSlug, ComponentType> = {
  apertura: OverviewPage,
  problema: SimulatorPage,
  asistente: AssistantPage,
  recuperacion: RecoveryPage,
  stock: StockPage,
  campanas: CampaignsPage,
  impacto: ReportPage,
}

const GLASS: CSSProperties = {
  background: 'rgba(17,34,44,0.55)',
  backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)',
  border: '1px solid rgba(247,245,239,0.08)',
}

const clockFmt = new Intl.DateTimeFormat('es-UY', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Un paso sin steps cuenta como uno, para que el progreso siempre avance. */
const stepsIn = (s: Scene) => Math.max(1, s.steps.length)

/** Transición de escena según la dirección (1 = adelante, -1 = atrás). */
const sceneVariants = {
  enter: (d: number) => ({
    opacity: 0,
    x: SLIDE_PX * d,
    scale: 0.98,
    filter: 'blur(6px)',
    transition: { duration: SCENE_IN, ease: EASE_OUT },
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: SCENE_IN, ease: EASE_OUT },
  },
  exit: (d: number) => ({
    opacity: 0,
    x: -SLIDE_PX * d,
    scale: 0.985,
    filter: 'blur(4px)',
    transition: { duration: SCENE_OUT, ease: EASE_OUT },
  }),
}
// Movimiento reducido: solo opacidad, sin desplazamiento ni escala.
const sceneVariantsReduced = {
  enter: { opacity: 0, transition: { duration: 0 } },
  center: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  } catch {
    /* el navegador puede bloquearlo: se ignora */
  }
}

/** Tipeo progresivo de la tagline; con movimiento reducido muestra el texto completo. */
function Typewriter({ text, speed = 22 }: { text: string; speed?: number }) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(reduce ? text.length : 0)

  useEffect(() => {
    if (reduce) {
      setCount(text.length)
      return
    }
    setCount(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setCount(i)
      if (i >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [text, reduce, speed])

  return (
    <>
      {text.slice(0, count)}
      {count < text.length && (
        <motion.span
          aria-hidden
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          style={{ color: MANDARIN }}
        >
          ▍
        </motion.span>
      )}
    </>
  )
}

function Background({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <Aurora />
      <motion.div
        style={{
          position: 'absolute',
          inset: '-20%',
          backgroundImage:
            'linear-gradient(120deg, transparent 0%, rgba(255,118,46,0.07) 50%, transparent 100%)',
          backgroundSize: '200% 200%',
        }}
        animate={reduce ? undefined : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: 640,
          height: 640,
          left: '52%',
          top: '-18%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${MANDARIN}38, transparent 65%)`,
          filter: 'blur(40px)',
        }}
        animate={reduce ? undefined : { x: [0, -90, 30, 0], y: [0, 60, -20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          left: '-8%',
          bottom: '-22%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${SLATE}80, transparent 65%)`,
          filter: 'blur(50px)',
        }}
        animate={reduce ? undefined : { x: [0, 70, -20, 0], y: [0, -50, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(247,245,239,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(247,245,239,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  )
}

/** Punto de estado con pulso, usado en la barra superior. */
function StatusBadge() {
  return (
    <Group gap={6} wrap="nowrap">
      <LiveDot />
      <Text size="xs" fw={600} style={{ color: WARM }}>
        En línea
      </Text>
    </Group>
  )
}

export function PresentationShell() {
  const wide = useMediaQuery('(min-width: 900px)', true)
  const reduce = useReducedMotion()
  const r = !!reduce
  const {
    scene,
    step,
    next,
    prev,
    goTo,
    notesOpen,
    toggleNotes,
    feedOpen,
    toggleFeed,
    exitToExplore,
  } = usePresenter()

  // Reloj en tiempo real.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Estado de pantalla completa, con atajo F.
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return
      if (e.key.toLowerCase() === 'f') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Dirección de la transición entre escenas (adelante / atrás).
  const [seenN, setSeenN] = useState(scene.n)
  const [dir, setDir] = useState(1)
  if (seenN !== scene.n) {
    setSeenN(scene.n)
    setDir(scene.n > seenN ? 1 : -1)
  }

  // Notificación al cambiar de paso (no al montar).
  const lastShown = useRef<string | null>(null)
  useEffect(() => {
    const key = `${scene.slug}:${step}`
    if (lastShown.current === null) {
      lastShown.current = key
      return
    }
    if (lastShown.current === key) return
    lastShown.current = key
    const n = scene.steps[step]?.notify
    if (n) {
      notifications.show({ title: n.title, message: n.message, color: 'mandarin', autoClose: 4000 })
    }
  }, [scene, step])

  // Progreso global: cada escena pesa igual; dentro de la escena, según el paso.
  const sceneIndex = scenes.findIndex((s) => s.slug === scene.slug)
  const stepFraction = (step + 1) / stepsIn(scene)
  const progress = ((sceneIndex + stepFraction) / scenes.length) * 100
  const caption = scene.steps[step]?.caption ?? ''
  const Page = PAGES[scene.slug]

  const iconBtnStyle: CSSProperties = { color: WARM }

  return (
    <div
      style={{
        position: 'relative',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        color: WARM,
        background: `linear-gradient(160deg, #0b1820 0%, ${MIDNIGHT} 45%, #0d1c25 100%)`,
      }}
    >
      <Background reduce={r} />

      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Barra superior */}
        <Paper
          component="header"
          radius={0}
          px="md"
          py={10}
          style={{
            ...GLASS,
            position: 'relative',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
          }}
        >
          {/* Progreso global: ancho con spring, un tramo por escena. */}
          <div
            role="progressbar"
            aria-label="Progreso de la presentación"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              background: 'rgba(247,245,239,0.08)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={r ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 26 }}
              style={{
                height: '100%',
                background: `linear-gradient(90deg, ${MANDARIN}, #ffb88a)`,
                boxShadow: 'none',
              }}
            />
          </div>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="md" wrap="nowrap">
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt="RIVECT"
                style={{ height: 22, display: 'block' }}
              />
              <Text size="sm" visibleFrom="sm" style={{ color: 'rgba(247,245,239,0.6)' }}>
                Retail Intelligence
              </Text>
              <StatusBadge />
            </Group>

            <Group gap="sm" wrap="nowrap">
              <Text
                size="sm"
                visibleFrom="md"
                style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', color: WARM }}
              >
                {clockFmt.format(now)}
              </Text>
              <Badge variant="outline" color="gray" size="sm" radius="sm" visibleFrom="sm">
                Demo · datos de ejemplo
              </Badge>
              <Group gap={4} wrap="nowrap">
                <Tooltip
                  withArrow
                  label={
                    <Group gap={6} wrap="nowrap">
                      <span>Notas</span>
                      <Kbd size="xs">N</Kbd>
                    </Group>
                  }
                >
                  <ActionIcon
                    variant={notesOpen ? 'light' : 'subtle'}
                    color="gray"
                    onClick={toggleNotes}
                    aria-label="Notas"
                    style={iconBtnStyle}
                  >
                    <StickyNote size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  withArrow
                  label={
                    <Group gap={6} wrap="nowrap">
                      <span>Panel en vivo</span>
                      <Kbd size="xs">L</Kbd>
                    </Group>
                  }
                >
                  <ActionIcon
                    variant={feedOpen ? 'light' : 'subtle'}
                    color="gray"
                    onClick={toggleFeed}
                    aria-label="Panel en vivo"
                    style={iconBtnStyle}
                  >
                    <Radio size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  withArrow
                  label={
                    <Group gap={6} wrap="nowrap">
                      <span>Pantalla completa</span>
                      <Kbd size="xs">F</Kbd>
                    </Group>
                  }
                >
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={toggleFullscreen}
                    aria-label="Pantalla completa"
                    style={iconBtnStyle}
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  withArrow
                  label={
                    <Group gap={6} wrap="nowrap">
                      <span>Salir a exploración</span>
                      <Kbd size="xs">Esc</Kbd>
                    </Group>
                  }
                >
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={exitToExplore}
                    aria-label="Salir a exploración"
                    style={iconBtnStyle}
                  >
                    <LogOut size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Group>
        </Paper>

        {/* Encabezado de escena */}
        <Box px="md" pt={10} pb={6} style={{ minWidth: 0 }}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={scene.n}
              custom={dir}
              variants={r ? sceneVariantsReduced : sceneVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {/* Encabezado compacto: el contenido de la escena es el protagonista. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <Text
                  size="xs"
                  fw={600}
                  style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(247,245,239,0.62)', whiteSpace: 'nowrap' }}
                >
                  {`${scene.n}/${scenes.length} · ${scene.label}`}
                </Text>
                <Text
                  component="h1"
                  style={{
                    fontFamily: 'Sora, Inter, sans-serif',
                    fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    margin: 0,
                    color: '#F7F5EF',
                  }}
                >
                  <RevealText key={scene.n} text={scene.title} />
                </Text>
              </div>
              <Text size="sm" style={{ color: 'rgba(247,245,239,0.72)', maxWidth: 900, marginTop: 2 }}>
                <Typewriter text={scene.tagline} />
              </Text>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {caption && (
              <motion.div
                key={`${scene.n}-${step}`}
                initial={{ opacity: 0, y: r ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: r ? 0 : -10 }}
                transition={{ duration: r ? 0 : 0.25, ease: EASE_OUT }}
                style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    flex: 'none',
                    padding: '1px 8px',
                    border: '1px solid rgba(247,245,239,0.28)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(247,245,239,0.85)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`Paso ${step + 1}/${scene.steps.length}`}
                </span>
                <Text size="sm" fw={500} style={{ color: 'rgba(247,245,239,0.9)' }}>
                  {caption}
                </Text>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Contenido principal + panel en vivo */}
        <Box
          px="md"
          pb={12}
          style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}
        >
          <Paper
            radius="xl"
            withBorder
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'rgba(7,11,20,0.55)',
              borderColor: 'rgba(247,245,239,0.08)',
              boxShadow: '0 24px 60px -32px rgba(0,0,0,0.9)',
            }}
          >
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={scene.n}
                custom={dir}
                style={{ flex: 1, minHeight: 0, display: 'flex' }}
                variants={r ? sceneVariantsReduced : sceneVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <ScrollArea h="100%" w="100%" type="auto" offsetScrollbars>
                  <Box p="md">
                    <Page />
                  </Box>
                </ScrollArea>
              </motion.div>
            </AnimatePresence>
          </Paper>

          {/* En pantallas angostas el panel taparía la escena. */}
          {wide && <LivePanel open={feedOpen} />}
        </Box>

        {/* Barra inferior */}
        <Paper
          component="footer"
          radius={0}
          px="md"
          py="sm"
          style={{ ...GLASS, borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}
        >
          <Group gap="md" wrap="nowrap" align="center">
            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={prev}
              aria-label="Anterior"
              style={{ background: 'transparent', color: WARM, borderColor: 'rgba(247,245,239,0.15)' }}
            >
              <ChevronLeft size={18} />
            </ActionIcon>

            <Stack gap={8} style={{ flex: 1, minWidth: 0 }}>
              {/* En celular: indicador compacto con la lista nativa del sistema. */}
              {!wide && (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(247,245,239,0.72)', whiteSpace: 'nowrap' }}>
                    {`${scene.n}/${scenes.length}`}
                  </span>
                  <select
                    aria-label="Ir a la escena"
                    value={scene.n}
                    onChange={(e) => goTo(Number(e.target.value))}
                    style={{
                      minWidth: 0,
                      maxWidth: '100%',
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: '1px solid rgba(247,245,239,0.18)',
                      background: 'rgba(17,34,44,0.9)',
                      color: WARM,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {scenes.map((s) => (
                      <option key={s.slug} value={s.n}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Group gap={6} justify="center" wrap="wrap" style={wide ? undefined : { display: 'none' }}>
                {scenes.map((s) => {
                  const active = s.slug === scene.slug
                  return (
                    <UnstyledButton
                      key={s.slug}
                      onClick={() => goTo(s.n)}
                      aria-current={active ? 'step' : undefined}
                      style={{
                        position: 'relative',
                        padding: '5px 12px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? MIDNIGHT : 'rgba(247,245,239,0.7)',
                        transition: 'color 0.3s',
                      }}
                    >
                      {active && (
                        <motion.span
                          layoutId="scene-chip-indicator"
                          aria-hidden
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 999,
                            background: MANDARIN,
                            boxShadow: 'none',
                          }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>{s.label}</span>
                    </UnstyledButton>
                  )
                })}
              </Group>
            </Stack>

            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={next}
              aria-label="Siguiente"
              style={{ background: MANDARIN, color: MIDNIGHT, borderColor: 'transparent' }}
            >
              <ChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Paper>
      </div>

      <Drawer
        opened={notesOpen}
        onClose={toggleNotes}
        position="right"
        size="md"
        title={<Text fw={700}>{`Notas · ${scene.label}`}</Text>}
      >
        <Stack gap="sm">
          {scene.notes.map((note, i) => (
            <Paper key={i} p="md" radius="md" withBorder>
              <Group align="flex-start" wrap="nowrap" gap="sm">
                <Badge size="sm" variant="light" radius="sm">
                  {i + 1}
                </Badge>
                <Text size="sm">{note}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Drawer>
    </div>
  )
}
