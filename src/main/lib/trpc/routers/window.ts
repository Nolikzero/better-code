import { nativeTheme } from "electron";
import { z } from "zod";
import {
  disableLiquidGlass,
  enableLiquidGlass,
  getLiquidGlassState,
  isLiquidGlassSupported,
} from "../../liquid-glass";
import { publicProcedure, router } from "../index";

// Store current vibrancy state
let currentVibrancy: string | null = null;

/**
 * Vibrancy types supported by Electron on macOS
 */
const vibrancyTypes = [
  "under-window",
  "sidebar",
  "content",
  "fullscreen-ui",
  "hud",
  "sheet",
  "popover",
] as const;

export const windowRouter = router({
  /**
   * Set window vibrancy effect (macOS only)
   * Enables native blur-through transparency
   */
  setVibrancy: publicProcedure
    .input(
      z.object({
        type: z.enum(vibrancyTypes).nullable(),
        visualEffectState: z
          .enum(["followWindow", "active", "inactive"])
          .optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const win = ctx.getWindow();

      if (!win) {
        return { success: false, reason: "no-window" };
      }

      if (process.platform !== "darwin") {
        // Non-macOS: vibrancy not supported, but we can still track the request
        // The renderer will use CSS fallback
        currentVibrancy = input.type;
        return { success: true, fallback: true };
      }

      try {
        if (input.type === null) {
          // Disable vibrancy - restore solid background
          win.setVibrancy(null as any);
          win.setBackgroundColor(
            nativeTheme.shouldUseDarkColors ? "#09090b" : "#ffffff",
          );
          currentVibrancy = null;
          console.log("[Window] Vibrancy disabled");
        } else {
          // Enable vibrancy - must set transparent background first
          win.setBackgroundColor("#00000000");
          win.setVibrancy(input.type as any);
          currentVibrancy = input.type;
          console.log(`[Window] Vibrancy enabled: ${input.type}`);
        }
        return { success: true };
      } catch (error) {
        console.error("[Window] setVibrancy failed:", error);
        return { success: false, reason: "error" };
      }
    }),

  /**
   * Get current vibrancy state and platform support
   */
  getVibrancy: publicProcedure.query(() => {
    return {
      platform: process.platform,
      vibrancy: currentVibrancy,
      supported: process.platform === "darwin",
    };
  }),

  /**
   * Enable liquid glass effect (macOS 26+ Tahoe only)
   * Falls back gracefully on older macOS and other platforms
   */
  setLiquidGlass: publicProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        options: z
          .object({
            cornerRadius: z.number().optional(),
            tintColor: z.string().optional(), // RGBA hex
            opaque: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      const win = ctx.getWindow();

      if (!win) {
        return { success: false, reason: "no-window" };
      }

      if (!isLiquidGlassSupported()) {
        // Fall back to legacy vibrancy for older macOS
        console.log(
          "[Window] Liquid glass not supported, falling back to vibrancy",
        );
        return { success: true, fallback: true, supported: false };
      }

      try {
        if (input.enabled) {
          // Set transparent background before enabling (required for glass effect)
          win.setBackgroundColor("#00000000");
          const glassId = enableLiquidGlass(win, input.options);
          if (glassId !== null) {
            console.log(`[Window] Liquid glass enabled with ID: ${glassId}`);
            return { success: true, glassId };
          }
          return { success: false, reason: "enable-failed" };
        }
        disableLiquidGlass();
        // Restore opaque background when disabling
        win.setBackgroundColor(
          nativeTheme.shouldUseDarkColors ? "#09090b" : "#ffffff",
        );
        console.log("[Window] Liquid glass disabled");
        return { success: true };
      } catch (error) {
        console.error("[Window] setLiquidGlass failed:", error);
        return { success: false, reason: "error" };
      }
    }),

  /**
   * Get current liquid glass state
   */
  getLiquidGlass: publicProcedure.query(() => {
    const state = getLiquidGlassState();
    return {
      ...state,
      platform: process.platform,
    };
  }),
});
