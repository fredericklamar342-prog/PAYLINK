"use client";

import { useEffect, useRef } from "react";
import { useAnimate } from "motion/react-mini";
import { useReducedMotion } from "motion/react";

// Keep these in step with --motion-feedback / --ease-out in globals.css.
export const feedbackMotion = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Content starts visible. Motion only acknowledges a subsequent state change. */
export function useFeedbackMotion<T extends HTMLElement>(state: string) {
  const [scope, animate] = useAnimate<T>();
  const reducedMotion = useReducedMotion();
  const previous = useRef(state);

  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (!scope.current || reducedMotion) return;
    const animation = animate(
      scope.current,
      {
        opacity: [0.65, 1],
        transform: ["translateY(3px)", "translateY(0px)"],
      },
      feedbackMotion,
    );
    const element = scope.current;
    return () => {
      animation.stop();
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform");
    };
  }, [state, reducedMotion, scope, animate]);

  return scope;
}
