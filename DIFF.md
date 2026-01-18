## Code Examples for Diffs Library

Below are comprehensive code examples extracted from the Diffs documentation. They are organized by section for clarity, including descriptions and context for each snippet. These cover installation, Vanilla JS APIs, React components (inferred from similar patterns), utilities, styling, worker pool setup, and server-side rendering (SSR). Note that React examples are adapted based on the provided Vanilla JS and SSR patterns, as the docs emphasize Vanilla JS but mention React wrappers.

### Installation

Install the core package or specific sub-packages using npm (or equivalent package managers like yarn, pnpm, or bun).

```bash
npm install @pierre/diffs
```

For React-specific components:
```bash
npm install @pierre/diffs/react
```

For SSR utilities:
```bash
npm install @pierre/diffs/ssr
```

For worker pool:
```bash
npm install @pierre/diffs/worker
```

### Vanilla JS API – Components

These are high-level components for rendering diffs or single files. `FileDiff` can handle two file versions or a pre-parsed diff metadata. `File` is for rendering a single code file without diffing.

```js
import { FileDiff, File } from '@pierre/diffs';

// Create a FileDiff from two file contents
const oldFileContents = { filename: 'old.js', content: 'console.log("old");' };
const newFileContents = { filename: 'new.js', content: 'console.log("new");' };

const diff = new FileDiff({
  oldFile: oldFileContents,
  newFile: newFileContents,
  theme: 'github-dark', // Optional: Shiki theme
  language: 'javascript', // Optional: Language override
});

// Alternatively, from pre-parsed diff metadata
const parsedDiff = parseDiffFromFile({ oldFile: oldFileContents, newFile: newFileContents });
const diffFromMetadata = new FileDiff({
  diffMetadata: parsedDiff,
});

// Render a single file
const fileContents = { filename: 'example.ts', content: 'const x: number = 42;' };
const file = new File({
  file: fileContents,
  theme: 'light',
});
```

After creation, append the component to the DOM, e.g., `document.body.appendChild(diff.element)`.

### Vanilla JS API – Renderers (Low-Level)

Low-level APIs for generating raw HTML Abstract Syntax Tree (HAST) nodes, useful for custom rendering without full components.

```js
import { DiffHunksRenderer, FileRenderer } from '@pierre/diffs';

// Render diff hunks as HAST
const parsedDiffMetadata = parseDiffFromFile({ oldFile, newFile }); // Assume oldFile and newFile defined
const renderer = new DiffHunksRenderer(parsedDiffMetadata);
const hast = renderer.render(); // Returns HAST nodes for custom processing

// Render a single file as syntax-highlighted HAST
const fileContents = { filename: 'file.py', content: 'print("Hello")' };
const fileRenderer = new FileRenderer(fileContents);
const fileHast = fileRenderer.render(); // Returns HAST nodes
```

### React API

The React package provides wrappers around the Vanilla JS components for easier integration. Import from `@pierre/diffs/react`. These components accept similar props as the Vanilla JS options.

```jsx
import { FileDiff, File, MultiFileDiff, PatchDiff } from '@pierre/diffs/react';

// MultiFileDiff: Compare two file versions
<MultiFileDiff
  oldFile={{ filename: 'old.txt', content: 'Old content' }}
  newFile={{ filename: 'new.txt', content: 'New content' }}
  theme="github"
  annotations={[{ lineNumber: 1, side: 'left', content: 'Note here' }]}
/>

// PatchDiff: Render from a unified diff string
const patchString = `--- old.txt\n+++ new.txt\n@@ -1 +1 @@\n-Old\n+New`;
<PatchDiff
  patch={patchString}
  theme="dark"
/>

// FileDiff: From pre-parsed metadata
const diffMetadata = parseDiffFromFile({ oldFile, newFile });
<FileDiff
  diffMetadata={diffMetadata}
  lineDiffType="inline"
/>

// File: Single file rendering
<File
  file={{ filename: 'code.js', content: '// Code here' }}
  theme="light"
/>
```

All components support props like `theme`, `language`, `annotations` (array of `DiffLineAnnotation` or `LineAnnotation`), and styling options.

### Utilities (Framework-Agnostic)

These functions work in any JS environment for parsing, manipulating, and configuring diffs.

```js
import {
  diffAcceptRejectHunk,
  disposeHighlighter,
  getSharedHighlighter,
  parseDiffFromFile,
  parsePatchFiles,
  preloadHighlighter,
  registerCustomTheme,
  setLanguageOverride
} from '@pierre/diffs';

// Parse diff from two files
const oldFile = { filename: 'a.js', content: 'old' };
const newFile = { filename: 'b.js', content: 'new' };
const diffMetadata = parseDiffFromFile({ oldFile, newFile, cacheKey: 'my-cache-key' });

// Parse from a patch string (unified diff)
const patchString = '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new';
const parsedFiles = parsePatchFiles(patchString, 'prefix-'); // Returns array of FileDiffMetadata

// Accept or reject a hunk programmatically
const updatedDiff = diffAcceptRejectHunk(diffMetadata, 0, 'accept'); // hunkIndex 0, 'accept' or 'reject'

// Override language
setLanguageOverride(oldFile, 'typescript');

// Preload highlighter resources to avoid async delays
preloadHighlighter(['github-dark', 'javascript', 'python']);

// Register a custom Shiki theme (themeJson must have a 'name' property)
const customThemeJson = { name: 'my-theme', colors: { /* ... */ } };
registerCustomTheme(customThemeJson);

// Access the shared Shiki highlighter
const highlighter = getSharedHighlighter();

// Dispose the highlighter to free resources
disposeHighlighter();
```

### Styling

Customize appearance using CSS variables or unsafe CSS injection. These can be applied globally, inline, or per-component.

```css
/* Global overrides in your CSS file */
.diffs-theme {
  --diffs-font-family: 'Fira Code', monospace;
  --diffs-background: #fafafa;
  --diffs-added-background: #e6ffed;
}
```

```js
// Inline style overrides in Vanilla JS
const diff = new FileDiff({
  oldFile,
  newFile,
  style: {
    '--diffs-font-size': '14px',
    '--diffs-line-height': '1.5',
  }
});
```

```js
// Unsafe CSS injection (use sparingly, no backward compatibility guarantee)
const diff = new FileDiff({
  oldFile,
  newFile,
  unsafeCSS: `
    @layer unsafe {
      .diff-line.added { background: #e6ffed; color: #2e7d32; }
      .diff-line.removed { background: #ffebee; color: #c62828; }
    }
  `
});
```

In React, pass `style` as a prop:
```jsx
<FileDiff
  oldFile={oldFile}
  newFile={newFile}
  style={{ '--diffs-font-size': '14px' }}
  unsafeCSS="/* custom CSS here */"
/>
```

### Worker Pool (Experimental)

Offload syntax highlighting to Web Workers. Requires a worker factory tailored to your bundler (e.g., Vite).

```js
// Example worker factory for Vite (in a separate file)
import workerUrl from '@pierre/diffs/worker?worker';

export function createWorkerFactory() {
  return () => new Worker(workerUrl);
}
```

```js
// Vanilla JS usage
import { getOrCreateWorkerPoolSingleton, terminateWorkerPoolSingleton } from '@pierre/diffs/worker';
import { createWorkerFactory } from './worker-factory'; // Your factory

const pool = getOrCreateWorkerPoolSingleton(createWorkerFactory(), { workerCount: 4 }); // Optional workerCount

// Use with FileDiff
const diff = new FileDiff({ oldFile, newFile }, pool); // Pass pool as second arg

// Update render options (applies to all using this pool)
pool.setRenderOptions({
  theme: 'dark',
  lineDiffType: 'inline',
  tokenizeMaxLineLength: 1000,
});

// Terminate when done
terminateWorkerPoolSingleton();
```

In React, use `WorkerPoolContextProvider` and `useWorkerPool` hook:
```jsx
import { WorkerPoolContextProvider, useWorkerPool } from '@pierre/diffs/react/worker';

// App wrapper
<WorkerPoolContextProvider workerFactory={createWorkerFactory}>
  {/* Your app */}
</WorkerPoolContextProvider>

// In a component
const pool = useWorkerPool();
pool.setRenderOptions({ theme: 'light' });

// Then render components as usual; they auto-use the pool
<MultiFileDiff oldFile={oldFile} newFile={newFile} />
```

### Server-Side Rendering (SSR)

Pre-render on the server for faster initial loads, then hydrate on the client. Use async preload functions.

```js
// Server-side: Preload a FileDiff from metadata
import { preloadFileDiff } from '@pierre/diffs/ssr';

const parsedDiffMetadata = parseDiffFromFile({ oldFile, newFile });
const prerendered = await preloadFileDiff(parsedDiffMetadata, { theme: 'github' });

// Pass to React component (server-rendered)
return <FileDiff {...prerendered} />;
```

```jsx
// Client-side: Hydrates automatically with matching props
<FileDiff
  diffMetadata={prerendered.diffMetadata}
  prerenderedHTML={prerendered.prerenderedHTML} // Pre-rendered highlighted HTML
/>
```

Other preloaders:
```js
// Preload single file (no diff)
import { preloadFile } from '@pierre/diffs/ssr';
const filePrerendered = await preloadFile(fileContents);

// Preload from old/new files
import { preloadMultiFileDiff } from '@pierre/diffs/ssr';
const multiPrerendered = await preloadMultiFileDiff({ oldFile, newFile });

// Preload from patch string (single file)
import { preloadPatchDiff } from '@pierre/diffs/ssr';
const patchPrerendered = await preloadPatchDiff(patchString);

// Preload multiple diffs from multi-file patch
import { preloadPatchFile } from '@pierre/diffs/ssr';
const patchFilesPrerendered = await preloadPatchFile(multiPatchString); // Array of prerendered objects
```

For full integration, ensure server and client inputs match exactly to avoid hydration mismatches.