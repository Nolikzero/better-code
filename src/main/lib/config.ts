/**
 * Shared configuration for the desktop app
 */

const IS_DEV = !!process.env.ELECTRON_RENDERER_URL

/**
 * Check if running in development mode
 */
export function isDev(): boolean {
  return IS_DEV
}
