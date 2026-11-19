import { motion, useReducedMotion } from 'framer-motion'
import { EASE_OUT, DUR } from '@/theme/motion'

/** React Bits · RevealText — revela el texto palabra por palabra (opacidad, desplazamiento y leve blur). */
export function RevealText({
  text,
  delay = 0,
  className,
}: {
  text: string
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const words = text.split(' ')

  if (reduce) {
    return (
      <span className={className} aria-label={text}>
        {text}
      </span>
    )
  }

  return (
    <span className={className} aria-label={text}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="inline-block"
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            duration: DUR.slow,
            delay: delay + index * 0.05,
            ease: EASE_OUT,
          }}
        >
          {word}
          {index < words.length - 1 ? '\u00A0' : null}
        </motion.span>
      ))}
    </span>
  )
}
