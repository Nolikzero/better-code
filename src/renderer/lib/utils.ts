import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);
