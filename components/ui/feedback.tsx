"use client";
import { useFeedbackMotion } from "./use-feedback-motion";

export function Feedback({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success" | "neutral";
}) {
  const scope = useFeedbackMotion<HTMLParagraphElement>(message);
  return (
    <p
      ref={scope}
      className={message ? `feedback feedback-${tone}` : "sr-only"}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      {message}
    </p>
  );
}
