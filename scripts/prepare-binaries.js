const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const projectRoot = path.resolve(__dirname, "..")
const binaryRoot = path.join(projectRoot, "resources", "bin")

function readArgument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function readPackageVersion(packageDirectory) {
  const packageJsonPath = path.join(projectRoot, "node_modules", packageDirectory, "package.json")
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Required package metadata not found: ${packageJsonPath}`)
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new Error(`Package version is missing: ${packageJsonPath}`)
  }
  return packageJson.version
}

function assertSafeOutputDirectory(outputDirectory) {
  const resolvedRoot = path.resolve(binaryRoot)
  const resolvedOutput = path.resolve(outputDirectory)
  if (resolvedOutput === resolvedRoot || !resolvedOutput.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to modify unsafe binary output directory: ${resolvedOutput}`)
  }
}

function copyRequiredBinary(sourceRelativePath, outputDirectory, outputName) {
  const sourcePath = path.join(projectRoot, "node_modules", sourceRelativePath)
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required binary not found: ${sourcePath}`)
  }

  const destinationPath = path.join(outputDirectory, outputName)
  fs.copyFileSync(sourcePath, destinationPath)
  fs.chmodSync(destinationPath, 0o755)
  return destinationPath
}

function verifyBinary(name, binaryPath, expectedVersion) {
  const result = spawnSync(binaryPath, ["--version"], {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  })
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()

  if (result.error) {
    throw new Error(`${name} verification failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`${name} verification exited with ${result.status}: ${output}`)
  }
  if (!output.includes(expectedVersion)) {
    throw new Error(`${name} version mismatch; expected ${expectedVersion}, received: ${output}`)
  }

  console.log(`[prepare-binaries] ${name}: ${output}`)
}

function main() {
  const platform = readArgument("platform")
  const arch = readArgument("arch")
  if (platform !== "win32" || arch !== "x64") {
    throw new Error(
      `Unsupported target ${platform ?? "<missing>"}-${arch ?? "<missing>"}; only win32-x64 is supported`,
    )
  }

  const outputDirectory = path.join(binaryRoot, `${platform}-${arch}`)
  assertSafeOutputDirectory(outputDirectory)
  fs.rmSync(outputDirectory, { recursive: true, force: true })
  fs.mkdirSync(outputDirectory, { recursive: true })

  const claudeVersion = readPackageVersion("@anthropic-ai/claude-code")
  const codexVersion = readPackageVersion("@openai/codex")
  const opencodeVersion = readPackageVersion("opencode-ai")

  const claudePath = copyRequiredBinary(
    "@anthropic-ai/claude-code-win32-x64/claude.exe",
    outputDirectory,
    "claude.exe",
  )
  const codexPath = copyRequiredBinary(
    "@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/codex/codex.exe",
    outputDirectory,
    "codex.exe",
  )
  copyRequiredBinary(
    "@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/codex/codex-command-runner.exe",
    outputDirectory,
    "codex-command-runner.exe",
  )
  copyRequiredBinary(
    "@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/codex/codex-windows-sandbox-setup.exe",
    outputDirectory,
    "codex-windows-sandbox-setup.exe",
  )
  copyRequiredBinary(
    "@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/path/rg.exe",
    outputDirectory,
    "rg.exe",
  )
  const opencodePath = copyRequiredBinary(
    "opencode-windows-x64-baseline/bin/opencode.exe",
    outputDirectory,
    "opencode.exe",
  )

  fs.mkdirSync(binaryRoot, { recursive: true })
  fs.writeFileSync(
    path.join(binaryRoot, "VERSION"),
    [
      claudeVersion,
      `claude=${claudeVersion}`,
      `codex=${codexVersion}`,
      `opencode=${opencodeVersion}`,
      "",
    ].join("\n"),
    "utf8",
  )

  verifyBinary("Claude Code", claudePath, claudeVersion)
  verifyBinary("Codex CLI", codexPath, codexVersion)
  verifyBinary("OpenCode", opencodePath, opencodeVersion)
  console.log(`[prepare-binaries] Prepared ${outputDirectory}`)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[prepare-binaries] ${message}`)
  process.exitCode = 1
}
