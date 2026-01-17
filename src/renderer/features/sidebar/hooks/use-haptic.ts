type HapticIntensity = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error"

/**
 * Mock haptic feedback hook for desktop
 * On desktop, we don't have haptic feedback, so this is a no-op
 */
export function useHaptic() {
  return {
    trigger: (_intensity?: HapticIntensity) => {
      // No-op on desktop - haptics are for mobile only
    },
  }
}
