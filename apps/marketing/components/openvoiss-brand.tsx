"use client"

import { useEffect, useState } from "react"

import { Benday, type BendayState, useDotMap } from "./ui/benday"

const OPENVOISS_LIME = "#9fe870"
const STATIC_MARK_MAX_SIZE = 24

export interface OpenvoissBrandProps {
  className?: string
  decorative?: boolean
  effect?: "static" | "benday"
  label?: string
  name?: string
  showName?: boolean
  size?: number
  state?: BendayState
  subtitle?: string
}

export function OpenvoissBrand({
  className,
  decorative = false,
  effect = "static",
  label = "Openvoiss",
  name = "Openvoiss",
  showName = false,
  size = 32,
  state = "idle",
  subtitle,
}: OpenvoissBrandProps) {
  const canEnhance = effect === "benday" && size > STATIC_MARK_MAX_SIZE
  const { dotMap } = useDotMap(
    canEnhance ? "/brand/only-logo.png" : null,
    canEnhance ? { grid: Math.max(16, Math.min(32, Math.round(size / 2))) } : undefined
  )
  const reducedMotion = useReducedMotion()
  const showCanvas = canEnhance && Boolean(dotMap) && !reducedMotion

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative && !showName ? label : undefined}
      className={["openvoiss-brand", className]
        .filter(Boolean)
        .join(" ")}
      role={!decorative && !showName ? "img" : undefined}
    >
      <span
        className="openvoiss-brand-mark"
        style={{ height: size, width: size }}
      >
        <span
          aria-hidden="true"
          className="openvoiss-brand-static"
          style={{
            backgroundColor: OPENVOISS_LIME,
            maskImage: "url(/brand/only-logo.png)",
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "122% auto",
            opacity: showCanvas ? 0 : 1,
            WebkitMaskImage: "url(/brand/only-logo.png)",
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "122% auto",
          }}
        />
        {showCanvas ? (
          <Benday
            aria-hidden="true"
            className="openvoiss-brand-canvas"
            color={OPENVOISS_LIME}
            dotMap={dotMap ?? undefined}
            padding={0.06}
            preset="beacon"
            reducedMotion="auto"
            size={size}
            state={state}
            style={{ inset: 0, position: "absolute" }}
          />
        ) : null}
      </span>
      {showName ? (
        <span className="openvoiss-brand-copy">
          <span className="openvoiss-brand-name">{name}</span>
          {subtitle ? (
            <span className="openvoiss-brand-subtitle">{subtitle}</span>
          ) : null}
        </span>
      ) : null}
      <style jsx>{`
        .openvoiss-brand {
          display: inline-flex;
          min-width: 0;
          align-items: center;
          gap: 10px;
        }
        .openvoiss-brand-mark {
          position: relative;
          display: block;
          flex: 0 0 auto;
          overflow: hidden;
        }
        .openvoiss-brand-static,
        .openvoiss-brand-canvas {
          position: absolute;
          inset: 0;
          display: block;
        }
        .openvoiss-brand-static {
          transition: opacity 150ms ease;
        }
        .openvoiss-brand-copy {
          min-width: 0;
          text-align: left;
          line-height: 1.2;
        }
        .openvoiss-brand-name,
        .openvoiss-brand-subtitle {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .openvoiss-brand-name {
          font-size: 14px;
          font-weight: 700;
        }
        .openvoiss-brand-subtitle {
          margin-top: 2px;
          color: currentColor;
          font-size: 12px;
          opacity: 0.65;
        }
      `}</style>
    </span>
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reduced
}
