/**
 * File icon utilities - maps file extensions to icon components
 */

import { FilesIcon } from "../../../../components/ui/icons";
import {
  AstroIcon,
  CIcon,
  CppIcon,
  CSharpIcon,
  CSSIcon,
  DockerIcon,
  GoIcon,
  GraphQLIcon,
  HTMLIcon,
  JavaIcon,
  JavaScriptIcon,
  JSONIcon,
  KotlinIcon,
  MarkdownIcon,
  MarkdownInfoIcon,
  PHPIcon,
  PrismaIcon,
  PythonIcon,
  ReactIcon,
  RubyIcon,
  RustIcon,
  SCSSIcon,
  ShellIcon,
  SQLIcon,
  SvelteIcon,
  SwiftIcon,
  TOMLIcon,
  TypeScriptIcon,
  VueIcon,
  YAMLIcon,
} from "../../../../icons/framework-icons";

/**
 * Known file extensions with icons
 */
const _KNOWN_FILE_ICON_EXTENSIONS = new Set([
  "tsx",
  "ts",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "py",
  "pyw",
  "pyi",
  "go",
  "rs",
  "md",
  "mdx",
  "css",
  "html",
  "htm",
  "scss",
  "sass",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "sh",
  "bash",
  "zsh",
  "sql",
  "graphql",
  "gql",
  "prisma",
  "dockerfile",
  "toml",
  "env",
  "java",
  "c",
  "h",
  "cpp",
  "cc",
  "cxx",
  "hpp",
  "cs",
  "php",
  "rb",
  "kt",
  "vue",
  "svelte",
  "astro",
  "swift",
]);

/**
 * Get file icon component based on file extension
 * If returnNullForUnknown is true, returns null for unknown file types instead of default icon
 */
export function getFileIconByExtension(
  filename: string,
  returnNullForUnknown = false,
) {
  const filenameLower = filename.toLowerCase();

  // Special handling for files without extensions (like Dockerfile)
  if (filenameLower === "dockerfile" || filenameLower.endsWith("/dockerfile")) {
    return DockerIcon;
  }

  // Special handling for .env files
  // Get the base filename (without path)
  const baseFilename = filenameLower.split("/").pop() || filenameLower;
  // .env (without suffix) -> TOML icon
  // .env.local, .env.example, .env.development, etc. -> Shell icon
  if (baseFilename === ".env") {
    return TOMLIcon;
  }
  if (baseFilename.startsWith(".env.")) {
    // .env.local, .env.example, .env.development, etc.
    return ShellIcon;
  }

  // Special handling for markdown files
  // README files -> MarkdownInfoIcon (with exclamation mark)
  // Other .md/.mdx files -> MarkdownIcon (standard markdown icon)
  if (filenameLower.endsWith(".md") || filenameLower.endsWith(".mdx")) {
    const nameWithoutExt = filenameLower.replace(/\.(md|mdx)$/, "");
    if (nameWithoutExt === "readme") {
      return MarkdownInfoIcon;
    }
    return MarkdownIcon;
  }

  // Special handling for JavaScript files
  // Ensure .js/.mjs/.cjs files use JavaScriptIcon, not JSONIcon
  if (
    filenameLower.endsWith(".js") ||
    filenameLower.endsWith(".mjs") ||
    filenameLower.endsWith(".cjs")
  ) {
    return JavaScriptIcon;
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "tsx":
      return ReactIcon;
    case "ts":
      return TypeScriptIcon;
    case "js":
    case "mjs":
    case "cjs":
      return JavaScriptIcon;
    case "jsx":
      return ReactIcon;
    case "py":
    case "pyw":
    case "pyi":
      return PythonIcon;
    case "go":
      return GoIcon;
    case "rs":
      return RustIcon;
    case "md":
    case "mdx": {
      // This case is handled above in special handling, but kept as fallback
      // Check if it's README
      const nameWithoutExt = filenameLower.replace(/\.(md|mdx)$/, "");
      if (nameWithoutExt === "readme") {
        return MarkdownInfoIcon;
      }
      return MarkdownIcon;
    }
    case "css":
      return CSSIcon;
    case "html":
    case "htm":
      return HTMLIcon;
    case "scss":
    case "sass":
      return SCSSIcon;
    case "json":
    case "jsonc":
      return JSONIcon;
    case "yaml":
    case "yml":
      return YAMLIcon;
    case "sh":
    case "bash":
    case "zsh":
      return ShellIcon;
    case "sql":
      return SQLIcon;
    case "graphql":
    case "gql":
      return GraphQLIcon;
    case "prisma":
      return PrismaIcon;
    case "dockerfile":
      return DockerIcon;
    case "toml":
      return TOMLIcon;
    case "env":
      // This handles .env files, but we already handled them above
      // This is a fallback for edge cases
      return TOMLIcon;
    case "java":
      return JavaIcon;
    case "c":
    case "h":
      return CIcon;
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return CppIcon;
    case "cs":
      return CSharpIcon;
    case "php":
      return PHPIcon;
    case "rb":
      return RubyIcon;
    case "kt":
      return KotlinIcon;
    case "vue":
      return VueIcon;
    case "svelte":
      return SvelteIcon;
    case "astro":
      return AstroIcon;
    case "swift":
      return SwiftIcon;
    default:
      return returnNullForUnknown ? null : FilesIcon;
  }
}
