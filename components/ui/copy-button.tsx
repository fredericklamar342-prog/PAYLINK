"use client";
import { useState } from "react";
import { Icon } from "./icon";
export function CopyButton({
  value,
  label = "Copy",
  className = "button secondary compact",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied");
    } catch {
      setMessage("Copy unavailable. Select and copy the text.");
    }
  }
  return (
    <span className="copy-control">
      <button type="button" className={className} onClick={copy}>
        <Icon name={message === "Copied" ? "check" : "copy"} size={16} />
        {message === "Copied" ? "Copied" : label}
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
