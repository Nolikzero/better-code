/** Represents an externally installed application that can open files/folders */
export interface ExternalApp {
  /** Unique identifier (e.g., "vscode", "cursor", "finder") */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Category for grouping in the dropdown */
  category: "file-manager" | "editor" | "ide" | "terminal";
  /** The CLI command or executable path to launch the app */
  command: string;
  /** Arguments pattern. Use {path} as placeholder for the target path */
  args: string[];
  /** If true, the target path is used as the working directory instead of being substituted in args */
  useCwd?: boolean;
  /** Which platforms this app supports */
  platforms: ("darwin" | "win32" | "linux")[];
}
