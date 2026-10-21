"use client";

import { useEffect, useRef } from "react";

// Keep these in step with --motion-feedback / --ease-out in globals.css.
export const feedbackMotion = {
  duration: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

/** Native feedback avoids loading a timeline engine for a two-keyframe effect. */
export function animateFeedback(element: HTMLElement, distance = 3) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches) return;
  const animation = element.animate(
    [
      { opacity: 0.7, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    feedbackMotion,
  );
  const stop = () => animation.cancel();
  preference.addEventListener("change", stop);
  void animation.finished.catch(() => {}).finally(() => preference.removeEventListener("change", stop));
  return animation;
}

/** Content starts visible. Motion only acknowledges a subsequent state change. */
export function useFeedbackMotion<T extends HTMLElement>(state: string) {
  const scope = useRef<T>(null);
  const previous = useRef(state);

  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (!scope.current) return;
    const animation = animateFeedback(scope.current);
    return () => animation?.cancel();
  }, [state]);

  return scope;
}
