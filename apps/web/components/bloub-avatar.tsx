"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BotEngine, type BotFrame } from "@/lib/bloub/vendor/engine";
import { SHAPE_BY_ID, type ShapeId } from "@/lib/bloub/vendor/skins";
import type { StateId } from "@/lib/bloub/vendor/states";

export type BloubMood =
  "idle" | "thinking" | "success" | "error" | "sleep" | "listening";
const STATES: Record<BloubMood, StateId> = {
  idle: "idle",
  thinking: "thinking",
  success: "wink",
  error: "alert",
  sleep: "sleep",
  listening: "wide",
};
const SHAPES: ShapeId[] = ["galet", "squircle", "nuage", "capsule", "hexagone"];

/** Stable identity across SSR, reloads and lists. Never randomise during render. */
function shapeFor(seed: string): ShapeId {
  let hash = 0;
  for (const char of seed)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return SHAPES[hash % SHAPES.length];
}

export interface BloubAvatarProps {
  size?: number;
  mood?: BloubMood;
  seed?: string;
  color?: string;
  paper?: string;
  className?: string;
  label?: string;
  /** Small list avatars are static by default. Prominent companions can animate. */
  animated?: boolean;
}

/** React adapter for Bloub's MIT SVG engine; upstream attribution is in lib/bloub/vendor. */
export function BloubAvatar({
  size = 56,
  mood = "idle",
  seed = "voysse",
  color = "var(--primary, #20365b)",
  paper = "var(--card, #ffffff)",
  className,
  label,
  animated = size >= 48,
}: BloubAvatarProps) {
  const uid = `bloub-${useId().replace(/:/g, "")}`;
  const svg = useRef<SVGSVGElement>(null);
  const engine = useMemo(
    () =>
      new BotEngine(
        100,
        STATES[mood],
        SHAPE_BY_ID.get(shapeFor(seed))?.radii ?? null,
      ),
    [seed],
  );
  const clock = useRef(1.2);
  const [frame, setFrame] = useState<BotFrame>(() => engine.sample(1.2));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    engine.setState(STATES[mood], clock.current);
    // A paused avatar still needs to show the new semantic state, not an old pose.
    if (!running) {
      clock.current += 1.2;
      setFrame({ ...engine.sample(clock.current) });
    }
  }, [engine, mood, running]);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () =>
      setRunning(
        animated &&
          visible &&
          !document.hidden &&
          !reduce.matches,
      );
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      reduce.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [animated]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let previous = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (previous) clock.current += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      // 30fps is sufficient for this small UI companion; don't rerender at 120Hz.
      if (now - lastPaint >= 1000 / 30) {
        setFrame({ ...engine.sample(clock.current) });
        lastPaint = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, running]);

  const dots = (
    <g>
      {frame.dots.map((dot, i) => {
        const common = {
          fill: dot.color ?? color,
          opacity: dot.opacity * (dot.depth ?? 1),
        };
        return dot.d ? (
          <path
            key={i}
            {...common}
            d={dot.d}
            transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(100)`}
          />
        ) : (
          <circle key={i} {...common} cx={dot.x} cy={dot.y} r={dot.r} />
        );
      })}
    </g>
  );
  const arcs = (side: "front" | "back") => (
    <g fill="none" strokeLinecap="round">
      {frame.arcs.map((arc) => (
        <path
          key={arc.id}
          d={arc[side]}
          stroke={`url(#${uid}-${arc.id})`}
          strokeWidth={arc.width}
          opacity={arc.opacity}
        />
      ))}
    </g>
  );
  return (
    <svg
      ref={svg}
      data-bloub=""
      data-mood={mood}
      data-animated={running ? "true" : "false"}
      className={className}
      width={size}
      height={size}
      viewBox="-158 -158 316 316"
      style={{ flexShrink: 0, overflow: "visible" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <mask
          id={uid}
          maskUnits="userSpaceOnUse"
          x={-158}
          y={-158}
          width={316}
          height={316}
        >
          <path d={frame.bodyPath} fill="white" />
          {frame.eyes.map((eye, i) => (
            <path
              key={i}
              d={eye.d}
              transform={eye.matrix}
              opacity={eye.alpha}
              fill="black"
            />
          ))}
          {frame.notch && (
            <circle
              cx={frame.notch.x}
              cy={frame.notch.y}
              r={frame.notch.r}
              fill="black"
            />
          )}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((stop, i) => (
              <stop
                key={i}
                offset={i / (arc.grad.stops.length - 1)}
                stopColor={stop}
              />
            ))}
          </linearGradient>
        ))}
      </defs>
      {arcs("back")}
      {frame.dotsBehind && dots}
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={paper} />
        <g mask={`url(#${uid})`}>
          <rect x={-158} y={-158} width={316} height={316} fill={color} />
        </g>
      </g>
      {!frame.dotsBehind && dots}
      {frame.notif && (
        <circle
          cx={frame.notif.x}
          cy={frame.notif.y}
          r={frame.notif.r}
          fill="#4e86cb"
        />
      )}
      {arcs("front")}
    </svg>
  );
}
