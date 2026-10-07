"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Hash } from "viem";
import { keccak256, toBytes } from "viem";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("paylink-payment", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("paylink-payment", callback);
  };
};
export const paymentStorageKey = (id: string) =>
  `paylink:transaction:${keccak256(toBytes(id))}`;
export function readPaymentHash(id: string): Hash | undefined {
  try {
    const value = localStorage.getItem(paymentStorageKey(id));
    return value && /^0x[a-fA-F0-9]{64}$/.test(value)
      ? (value as Hash)
      : undefined;
  } catch {
    return undefined;
  }
}
export function savePaymentHash(id: string, hash: Hash) {
  localStorage.setItem(paymentStorageKey(id), hash);
  window.dispatchEvent(new Event("paylink-payment"));
}
export function usePaymentHash(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => readPaymentHash(id),
    () => undefined,
  );
}
export function useBrowserReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
export function useClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
