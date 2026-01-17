/**
 * Detect programming language from file extension
 */
const extensionMap: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".json": "json",
	".md": "markdown",
	".mdx": "markdown",
	".css": "css",
	".scss": "scss",
	".less": "less",
	".html": "html",
	".vue": "vue",
	".svelte": "svelte",
	".py": "python",
	".rb": "ruby",
	".go": "go",
	".rs": "rust",
	".java": "java",
	".kt": "kotlin",
	".swift": "swift",
	".c": "c",
	".cpp": "cpp",
	".h": "c",
	".hpp": "cpp",
	".cs": "csharp",
	".php": "php",
	".sql": "sql",
	".sh": "shell",
	".bash": "shell",
	".zsh": "shell",
	".yaml": "yaml",
	".yml": "yaml",
	".toml": "toml",
	".xml": "xml",
	".graphql": "graphql",
	".gql": "graphql",
	".dockerfile": "dockerfile",
	".gitignore": "plaintext",
	".env": "plaintext",
};

export function detectLanguage(filePath: string): string {
	const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
	return extensionMap[ext] || "plaintext";
}
