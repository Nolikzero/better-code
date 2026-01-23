import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { isMacOS } from "./utils/platform";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMac = isMacOS();
