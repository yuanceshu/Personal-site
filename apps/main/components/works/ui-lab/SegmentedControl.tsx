"use client";

import { useLayoutEffect, useRef } from "react";

// Critical damping: retain presentation and velocity when a new selection interrupts.
export function SegmentedControl<T extends string | number>({ label, value, options, onChange, className = "" }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const motion = useRef({ x: 0, velocity: 0, initialized: false });
  useLayoutEffect(() => {
    const group = root.current;
    const layer = indicator.current;
    if (!group || !layer) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    let target = 0;
    const state = motion.current;
    const omega = 2 * Math.PI / .3;
    function draw() { layer!.style.transform = `translateX(${state.x}px)`; }
    function tick(now: number) {
      const dt = Math.min((now - previous) / 1000, .05);
      previous = now;
      const offset = state.x - target;
      const speed = state.velocity + omega * offset;
      const decay = Math.exp(-omega * dt);
      state.x = target + (offset + speed * dt) * decay;
      state.velocity = (state.velocity - omega * speed * dt) * decay;
      if (Math.abs(state.x - target) < .1 && Math.abs(state.velocity) < .1) {
        state.x = target;
        state.velocity = 0;
        frame = 0;
      } else frame = requestAnimationFrame(tick);
      draw();
    }
    function measure() {
      const button = group!.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (!button || !group!.getClientRects().length) return;
      target = button.offsetLeft;
      layer!.style.width = `${button.offsetWidth}px`;
      layer!.style.height = `${button.offsetHeight}px`;
      layer!.style.top = `${button.offsetTop}px`;
      if (!state.initialized || media.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        state.x = target;
        state.velocity = 0;
        state.initialized = true;
        draw();
      } else if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
      group!.dataset.enhanced = "true";
    }
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    group.querySelectorAll("button").forEach(button => observer.observe(button));
    media.addEventListener("change", measure);
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); media.removeEventListener("change", measure); };
  }, [value]);
  return <div ref={root} className={`uil-segment ${className}`} role="group" aria-label={label}>
    <span className="uil-segment-indicator" ref={indicator} aria-hidden="true" />
    {options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
