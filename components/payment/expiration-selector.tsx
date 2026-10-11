"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";

const PRESETS = [
  { label: "15 min", description: "15 minutes", minutes: 15 },
  { label: "30 min", description: "30 minutes", minutes: 30 },
  { label: "1 hour", description: "1 hour", minutes: 60 },
  { label: "6 hours", description: "6 hours", minutes: 360 },
  { label: "24 hours", description: "24 hours", minutes: 1_440 },
  { label: "3 days", description: "3 days", minutes: 4_320 },
  { label: "7 days", description: "7 days", minutes: 10_080 },
] as const;

function localDateTime(timestamp: number) {
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function expiryDescription(value: string) {
  if (!value) return "This payment link will not expire.";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Choose a valid local date and time.";
  return `Expires ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)} in your local timezone.`;
}

export function ExpirationSelector({
  value,
  error,
  disabled,
  onChange,
}: {
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const helpId = useId();
  const [selection, setSelection] = useState<string>(value ? "custom" : "none");
  const selectedPreset = PRESETS.find(({ minutes }) => String(minutes) === selection);

  function selectPreset(id: string, minutes?: number, now = 0) {
    setSelection(id);
    onChange(minutes ? localDateTime(now + minutes * 60_000) : "");
  }

  return (
    <div className="field expiration-field">
      <div className="row-between expiration-label-row">
        <span className="field-label" id="expiry-label">
          Payment link expiration <span className="optional">Optional</span>
        </span>
        <span className="local-time-note"><Icon name="clock" size={14} /> Local time</span>
      </div>
      <div className="expiration-options" role="group" aria-labelledby="expiry-label">
        {PRESETS.map((preset) => (
          <button
            key={preset.minutes}
            type="button"
            className="expiration-option"
            aria-pressed={selection === String(preset.minutes)}
            disabled={disabled}
            onClick={() => selectPreset(String(preset.minutes), preset.minutes, Date.now())}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className="expiration-option"
          aria-pressed={selection === "custom"}
          disabled={disabled}
          onClick={() => setSelection("custom")}
        >
          Custom
        </button>
        <button
          type="button"
          className="expiration-option"
          aria-pressed={selection === "none"}
          disabled={disabled}
          onClick={() => selectPreset("none")}
        >
          No expiry
        </button>
      </div>
      {selection === "custom" && (
        <input
          id="expiry"
          type="datetime-local"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={helpId}
        />
      )}
      <div id={helpId} className={error ? "field-error" : "expiration-summary"}>
        {error ? error : (
          <>
            <strong>{selectedPreset ? `This payment link will expire in ${selectedPreset.description}.` : selection === "custom" ? "This payment link will expire at your selected time." : "This payment link will not expire."}</strong>
            {value && <span>{expiryDescription(value)}</span>}
          </>
        )}
      </div>
    </div>
  );
}
