"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { useFeedbackMotion } from "./use-feedback-motion";
import { LoadingIndicator } from "./loading-indicator";
export function CopyButton({
  value,
  label = "Copy",
  className = "button secondary compact",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [feedback, setFeedback] = useState({ value: "", message: "" });
  const message = feedback.value === value ? feedback.message : "";
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestVersion = useRef(0);
  const iconScope = useFeedbackMotion<HTMLSpanElement>(message);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      requestVersion.current++;
    },
    [],
  );
  async function copy() {
    clearTimeout(timer.current);
    const version = ++requestVersion.current;
    setFeedback({ value, message: "Copying…" });
    try {
      await navigator.clipboard.writeText(value);
      if (version !== requestVersion.current) return;
      setFeedback({ value, message: "Copied" });
      timer.current = setTimeout(
        () => setFeedback({ value, message: "" }),
        2400,
      );
    } catch {
      if (version === requestVersion.current)
        setFeedback({
          value,
          message: "Copy unavailable. Select and copy the text.",
        });
    }
  }
  return (
    <span className="copy-control">
      <button
        type="button"
        className={`${className} copy-button`}
        onClick={copy}
        disabled={message === "Copying…"}
        data-copied={message === "Copied" || undefined}
      >
        <span ref={iconScope} className="button-icon">
          {message === "Copying…" ? (
            <LoadingIndicator />
          ) : (
            <Icon name={message === "Copied" ? "check" : "copy"} size={16} />
          )}
        </span>
        <span className="button-label">
          <span className="button-label-reserve" aria-hidden="true">
            {label.length > 7 ? label : "Copying…"}
          </span>
          <span>
            {message === "Copied" || message === "Copying…" ? message : label}
          </span>
        </span>
      </button>
      <span
        className={
          message.startsWith("Copy unavailable") ? "field-error" : "sr-only"
        }
        role="status"
      >
        {message}
      </span>
    </span>
  );
}
