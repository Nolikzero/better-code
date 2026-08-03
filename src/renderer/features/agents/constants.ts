/**
 * Agents feature constants
 */

type DevicePreset = {
  name: string;
  label: string;
  width: number;
  height: number;
};

export const DEVICE_PRESETS: DevicePreset[] = [
  { name: "Custom", label: "自定义", width: 397, height: 852 },
  { name: "iPhone 16", label: "iPhone 16", width: 393, height: 852 },
  { name: "iPhone 16 Pro", label: "iPhone 16 Pro", width: 393, height: 852 },
  {
    name: "iPhone 16 Pro Max",
    label: "iPhone 16 Pro Max",
    width: 430,
    height: 932,
  },
  { name: "iPhone 16 Plus", label: "iPhone 16 Plus", width: 430, height: 932 },
  { name: "iPhone SE", label: "iPhone SE", width: 375, height: 667 },
  { name: "iPad Mini", label: "iPad Mini", width: 744, height: 1133 },
  { name: "iPad Air", label: "iPad Air", width: 820, height: 1180 },
  { name: "iPad Pro", label: "iPad Pro", width: 1024, height: 1366 },
  { name: "Android Compact", label: "Android 紧凑型", width: 360, height: 640 },
  {
    name: "Android Medium",
    label: "Android 中等尺寸",
    width: 412,
    height: 915,
  },
] as const;

// Scale presets for preview
const SCALE_PRESETS = [50, 75, 100, 125, 150] as const;

export const AGENTS_PREVIEW_CONSTANTS = {
  DEVICE_PRESETS,
  SCALE_PRESETS,
  DEFAULT_WIDTH: 397,
  DEFAULT_HEIGHT: 852,
  MIN_WIDTH: 100,
  MAX_WIDTH: 2000,
  MIN_HEIGHT: 320,
  MAX_HEIGHT: 2000,
  MIN_SCALE: 25,
  MAX_SCALE: 200,
} as const;

export type AgentsPreviewConstants = typeof AGENTS_PREVIEW_CONSTANTS;
