'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

type EncryptedTextProps = {
  text: string
  className?: string
  /**
   * Time in milliseconds between revealing each subsequent real character.
   * Lower is faster. Defaults to 50ms per character.
   */
  revealDelayMs?: number
  /** Optional custom character set to use for the gibberish effect. */
  charset?: string
  /**
   * Time in milliseconds between gibberish flips for unrevealed characters.
   * Lower is more jittery. Defaults to 50ms.
   */
  flipDelayMs?: number
  /** CSS class for styling the encrypted/scrambled characters */
  encryptedClassName?: string
  /** CSS class for styling the revealed characters */
  revealedClassName?: string
}

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?'

function generateRandomCharacter(charset: string): string {
  const index = Math.floor(Math.random() * charset.length)
  return charset.charAt(index)
}

function generateGibberishPreservingSpaces(original: string, charset: string): string {
  if (!original) return ''
  let result = ''
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i]
    result += ch === ' ' ? ' ' : generateRandomCharacter(charset)
  }
  return result
}

export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  className,
  revealDelayMs = 50,
  charset = DEFAULT_CHARSET,
  flipDelayMs = 50,
  encryptedClassName,
  revealedClassName,
}) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [isInView, setIsInView] = useState(false)
  const reduceMotion = useReducedMotion()

  const [revealCount, setRevealCount] = useState<number>(0)
  const revealCountRef = useRef<number>(0)
  const [, setFlipCount] = useState(0)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastFlipTimeRef = useRef<number>(0)
  const scrambleCharsRef = useRef<string[]>(text ? generateGibberishPreservingSpaces(text, charset).split('') : [])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isInView || reduceMotion) return

    // Reset state for a fresh animation whenever dependencies change
    const initial = text ? generateGibberishPreservingSpaces(text, charset) : ''
    scrambleCharsRef.current = initial.split('')
    startTimeRef.current = performance.now()
    lastFlipTimeRef.current = startTimeRef.current
    revealCountRef.current = 0
    setRevealCount(0)

    let isCancelled = false

    const update = (now: number) => {
      if (isCancelled) return

      const elapsedMs = now - startTimeRef.current
      const totalLength = text.length
      const currentRevealCount = Math.min(totalLength, Math.floor(elapsedMs / Math.max(1, revealDelayMs)))

      if (currentRevealCount !== revealCountRef.current) {
        revealCountRef.current = currentRevealCount
        setRevealCount(currentRevealCount)
      }

      if (currentRevealCount >= totalLength) {
        return
      }

      // Re-randomize unrevealed scramble characters on an interval
      const timeSinceLastFlip = now - lastFlipTimeRef.current
      if (timeSinceLastFlip >= Math.max(0, flipDelayMs)) {
        for (let index = 0; index < totalLength; index += 1) {
          if (index >= currentRevealCount) {
            if (text[index] !== ' ') {
              scrambleCharsRef.current[index] = generateRandomCharacter(charset)
            } else {
              scrambleCharsRef.current[index] = ' '
            }
          }
        }
        lastFlipTimeRef.current = now
        setFlipCount((count) => count + 1)
      }

      animationFrameRef.current = requestAnimationFrame(update)
    }

    animationFrameRef.current = requestAnimationFrame(update)

    return () => {
      isCancelled = true
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isInView, text, revealDelayMs, charset, flipDelayMs, reduceMotion])

  if (!text) return null

  if (reduceMotion) {
    return <span className={cn(className, revealedClassName)}>{text}</span>
  }

  return (
    <motion.span ref={ref} className={cn(className)} data-slot="encrypted-text">
      <span className="sr-only">{text}</span>
      {text.split('').map((char, index) => {
        const isRevealed = index < revealCount
        const displayChar = isRevealed
          ? char
          : char === ' '
            ? ' '
            : (scrambleCharsRef.current[index] ?? generateRandomCharacter(charset))

        return (
          <span key={index} aria-hidden="true" className={cn(isRevealed ? revealedClassName : encryptedClassName)}>
            {displayChar}
          </span>
        )
      })}
    </motion.span>
  )
}
