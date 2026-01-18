/**
 * DOM utilities for creating icon elements
 * Used by the contenteditable editor to insert icons into the DOM
 */

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  CustomAgentIcon,
  FilesIcon,
  OriginalMCPIcon,
  SkillIcon,
} from "../../../../components/ui/icons";
import { getFileIconByExtension } from "./file-icons";
import { FolderOpenIcon } from "./folder-icon";

/**
 * Tool icon component (MCP icon) - slightly larger for visibility
 */
function ToolIcon({ className }: { className?: string }) {
  // Override size to h-3.5 w-3.5 for better visibility
  const sizeClass =
    className?.replace(/h-3\b/, "h-3.5").replace(/w-3\b/, "w-3.5") || className;
  return createElement(OriginalMCPIcon, { className: sizeClass });
}

/**
 * Create SVG icon element in DOM based on file extension or type
 * Used by the contenteditable editor to insert styled mention chips
 */
export function createFileIconElement(
  filename: string,
  type?: "file" | "folder" | "skill" | "agent" | "category" | "tool",
): SVGSVGElement {
  const IconComponent =
    type === "skill"
      ? SkillIcon
      : type === "agent"
        ? CustomAgentIcon
        : type === "tool"
          ? ToolIcon
          : type === "folder"
            ? FolderOpenIcon
            : getFileIconByExtension(filename) ?? FilesIcon;
  // Note: "category" type will use the default file icon based on filename, which is fine since
  // categories won't be inserted as mentions in the editor (they navigate to subpages)

  // Create a temporary container
  const container = document.createElement("div");
  container.style.display = "none";
  container.style.position = "absolute";
  container.style.visibility = "hidden";
  document.body.appendChild(container);

  // Create React element
  const iconElement = createElement(IconComponent, {
    className: "h-3 w-3 text-muted-foreground flex-shrink-0",
  });

  const root = createRoot(container);

  // Render synchronously using flushSync
  flushSync(() => {
    root.render(iconElement);
  });

  // Extract the SVG element
  const svgElement = container.querySelector("svg");

  // Clean up
  root.unmount();
  if (container.parentNode) {
    document.body.removeChild(container);
  }

  if (!svgElement || !(svgElement instanceof SVGSVGElement)) {
    // Fallback: create a simple file icon
    const fallbackSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    fallbackSvg.setAttribute("width", "12");
    fallbackSvg.setAttribute("height", "12");
    fallbackSvg.setAttribute("viewBox", "0 0 24 24");
    fallbackSvg.setAttribute("fill", "none");
    fallbackSvg.setAttribute("stroke", "currentColor");
    fallbackSvg.setAttribute("stroke-width", "2");
    fallbackSvg.setAttribute("stroke-linecap", "round");
    fallbackSvg.setAttribute("stroke-linejoin", "round");
    fallbackSvg.className.baseVal =
      "h-3 w-3 text-muted-foreground flex-shrink-0";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    );
    fallbackSvg.appendChild(path);

    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    polyline.setAttribute("points", "14 2 14 8 20 8");
    fallbackSvg.appendChild(polyline);

    return fallbackSvg;
  }

  // Clone the SVG to avoid issues
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute(
    "class",
    "h-3 w-3 text-muted-foreground flex-shrink-0",
  );

  return clonedSvg;
}
