import { useEffect, useRef } from 'react'
import { Truck } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'

const checkpointProgress = [0, 1 / 3, 2 / 3, 1]

function routeX(progress: number) {
  return 0.125 + progress * 0.75
}

function routeY(progress: number) {
  const inverse = 1 - progress
  return (
    inverse ** 3 * 0.733 +
    3 * inverse ** 2 * progress * 0.683 +
    3 * inverse * progress ** 2 * 0.4 +
    progress ** 3 * 0.258
  )
}

function routeAngle(progress: number, width: number, height: number) {
  const inverse = 1 - progress
  const derivativeY =
    3 * inverse ** 2 * (0.683 - 0.733) + 6 * inverse * progress * (0.4 - 0.683) + 3 * progress ** 2 * (0.258 - 0.4)
  return (Math.atan2(derivativeY * height, 0.75 * width) * 180) / Math.PI
}

export function HeroRouteSignal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useMotionValue(0)
  const height = useMotionValue(0)
  const progress = useMotionValue(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const rect = container.getBoundingClientRect()
      width.set(rect.width)
      height.set(rect.height)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [height, width])

  useEffect(() => {
    if (reduceMotion) {
      progress.set(0.18)
      return
    }

    const playback = animate(progress, [0, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 1], {
      duration: 10,
      times: [0, 0.28, 0.34, 0.62, 0.68, 1],
      ease: 'linear',
      repeat: Infinity,
      repeatDelay: 0.6,
    })

    return () => playback.stop()
  }, [progress, reduceMotion])

  const truckX = useTransform(() => routeX(progress.get()) * width.get() - 22)
  const truckY = useTransform(() => routeY(progress.get()) * height.get() - 22)
  const truckRotation = useTransform(() => routeAngle(progress.get(), width.get(), height.get()))
  const truckOpacity = useTransform(progress, [0, 0.035, 0.94, 1], [0, 1, 1, 0])

  return (
    <div ref={containerRef} className="route-signal" aria-hidden="true">
      <svg className="route-track" viewBox="0 0 1000 120" preserveAspectRatio="none">
        <path className="route-line-base" d="M 125 88 C 350 82 650 48 875 31" pathLength="1" />
        <motion.path
          className="route-line-progress"
          d="M 125 88 C 350 82 650 48 875 31"
          pathLength="1"
          style={{ pathLength: reduceMotion ? 0.18 : progress }}
        />
      </svg>

      {checkpointProgress.map((checkpoint, index) => (
        <i
          className="route-node"
          key={checkpoint}
          style={{ left: `${routeX(checkpoint) * 100}%`, top: `${routeY(checkpoint) * 100}%` }}
          data-checkpoint={index + 1}
        />
      ))}

      <motion.span
        className="truck-signal"
        style={{ x: truckX, y: truckY, rotate: truckRotation, opacity: truckOpacity }}
      >
        <Truck />
      </motion.span>
    </div>
  )
}
