"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EXPRESSION_BY_ID, type ExpressionId } from "@/lib/bloub/vendor/expressions";
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
const COMPANION_EXPRESSIONS: ExpressionId[] = ["neutre", "curieux", "heureux", "surpris", "attentif"];
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
  /** Opt-in silhouette cycling for the sidebar companion, not identity avatars. */
  cycleShapes?: boolean;
  cycleExpressions?: boolean;
  followPointer?: boolean;
}

/** React adapter for Bloub's MIT SVG engine; upstream attribution is in lib/bloub/vendor. */
export function BloubAvatar({
  size = 56,
  mood = "idle",
  seed = "voysse",
  color = "var(--primary, #5135ff)",
  paper = "var(--card, #ffffff)",
  className,
  label,
  animated = size >= 48,
  cycleShapes = false,
  cycleExpressions = false,
  followPointer = false,
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
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const shape = useRef(shapeFor(seed));
  const [shapeId, setShapeId] = useState(() => shapeFor(seed));
  const expression = useRef<ExpressionId>("neutre");
  const [expressionId, setExpressionId] = useState<ExpressionId>("neutre");
  const [frame, setFrame] = useState<BotFrame>(() => engine.sample(1.2));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    engine.setState(STATES[mood], clock.current);
    // A paused avatar still needs to show the new semantic state, not an old pose.
    if (!running) {
      clock.current += 1.2;
      setFrame({ ...engine.sample(clock.current) });
    }
  }, [engine, mood, running, cycleExpressions]);

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
    if (!running || !followPointer) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointer.current = { x: event.clientX, y: event.clientY };
    };
    const reset = () => { pointer.current = null; engine.setLook(null, clock.current); };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) reset(); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [engine, running, followPointer]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let previous = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (previous) clock.current += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (cycleShapes) {
        const next = SHAPES[(SHAPES.indexOf(shapeFor(seed)) + Math.floor((clock.current - 1.2) / 5)) % SHAPES.length];
        if (next !== shape.current) {
          engine.setShape(SHAPE_BY_ID.get(next)?.radii ?? null, clock.current);
          shape.current = next;
          setShapeId(next);
        }
      }
      if (cycleExpressions) {
        const next = COMPANION_EXPRESSIONS[Math.floor((clock.current - 1.2) / 7) % COMPANION_EXPRESSIONS.length];
        if (next !== expression.current) {
          engine.setExpression(EXPRESSION_BY_ID.get(next) ?? null, clock.current);
          expression.current = next;
          setExpressionId(next);
        }
      }
      // 30fps is sufficient for this small UI companion; don't rerender at 120Hz.
      if (now - lastPaint >= 1000 / 30) {
        const target = pointer.current;
        if (followPointer && target && svg.current) {
          const box = svg.current.getBoundingClientRect();
          if (box.width && box.height) {
            engine.setLook({
              yaw: Math.max(-35, Math.min(35, (target.x - box.x - box.width / 2) * 35 / 300)),
              pitch: Math.max(-25, Math.min(25, -(target.y - box.y - box.height / 2) * 25 / 300)),
              mix: 1, spin: 0, wander: 0,
            }, clock.current);
          }
          pointer.current = null;
        }
        setFrame({ ...engine.sample(clock.current) });
        lastPaint = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, running, cycleShapes, cycleExpressions, followPointer, seed]);

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
      data-expression={cycleExpressions ? expressionId : undefined}
      data-shape={shapeId}
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
