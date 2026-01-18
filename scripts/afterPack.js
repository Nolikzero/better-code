const fs = require("fs")
const path = require("path")

/**
 * electron-builder afterPack hook to remove non-target platform binaries
 * from the @anthropic-ai/claude-agent-sdk package.
 *
 * This significantly reduces package size by ~38-40MB per build by removing
 * ripgrep binaries for platforms that aren't being targeted.
 */
exports.default = async function (context) {
  const { electronPlatformName, arch, appOutDir } = context

  // electron-builder passes arch as an enum number, convert to string
  // Arch enum: ia32=0, x64=1, armv7l=2, arm64=3, universal=4
  const archMap = {
    0: "ia32",
    1: "x64",
    2: "armv7l",
    3: "arm64",
    4: "universal",
  }
  const archString = archMap[arch] || arch

  // Map electron platform/arch to ripgrep directory naming convention
  const platformMap = {
    "darwin-arm64": "arm64-darwin",
    "darwin-x64": "x64-darwin",
    "linux-arm64": "arm64-linux",
    "linux-x64": "x64-linux",
    "win32-x64": "x64-win32",
  }

  const targetPlatform = platformMap[`${electronPlatformName}-${archString}`]
  if (!targetPlatform) {
    console.log(
      `[afterPack] Unknown platform: ${electronPlatformName}-${archString}, skipping ripgrep cleanup`
    )
    return
  }

  console.log(`[afterPack] Target platform: ${targetPlatform}`)

  // Path to ripgrep vendor directory in unpacked asar
  const resourcesDir =
    electronPlatformName === "darwin"
      ? path.join(
          appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources"
        )
      : path.join(appOutDir, "resources")

  const ripgrepDir = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "@anthropic-ai",
    "claude-agent-sdk",
    "vendor",
    "ripgrep"
  )

  if (!fs.existsSync(ripgrepDir)) {
    console.log(`[afterPack] Ripgrep directory not found: ${ripgrepDir}`)
    return
  }

  // Get all platform directories
  const entries = fs.readdirSync(ripgrepDir, { withFileTypes: true })
  let removedSize = 0

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    // Keep only the target platform
    if (entry.name !== targetPlatform) {
      const dirPath = path.join(ripgrepDir, entry.name)
      console.log(`[afterPack] Removing non-target platform: ${entry.name}`)

      // Calculate size before removal
      const dirSize = getDirSize(dirPath)
      removedSize += dirSize

      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  }

  console.log(
    `[afterPack] Removed ${(removedSize / 1024 / 1024).toFixed(1)} MB of unused ripgrep binaries`
  )

  // Clean up better-sqlite3 build artifacts
  const betterSqlite3Dir = path.join(
    resourcesDir,
    "app.asar.unpacked",
    "node_modules",
    "better-sqlite3"
  )

  if (fs.existsSync(betterSqlite3Dir)) {
    let sqlite3Removed = 0

    // Remove SQLite source files (deps/sqlite3/ contains sqlite3.c ~9.5MB)
    const depsDir = path.join(betterSqlite3Dir, "deps")
    if (fs.existsSync(depsDir)) {
      const size = getDirSize(depsDir)
      sqlite3Removed += size
      fs.rmSync(depsDir, { recursive: true, force: true })
    }

    // Remove build object files (only .node binary is needed)
    const objDir = path.join(betterSqlite3Dir, "build", "Release", "obj")
    if (fs.existsSync(objDir)) {
      const size = getDirSize(objDir)
      sqlite3Removed += size
      fs.rmSync(objDir, { recursive: true, force: true })
    }

    // Remove C source files
    const srcDir = path.join(betterSqlite3Dir, "src")
    if (fs.existsSync(srcDir)) {
      const size = getDirSize(srcDir)
      sqlite3Removed += size
      fs.rmSync(srcDir, { recursive: true, force: true })
    }

    // Remove test_extension.node
    const testExt = path.join(betterSqlite3Dir, "build", "Release", "test_extension.node")
    if (fs.existsSync(testExt)) {
      sqlite3Removed += fs.statSync(testExt).size
      fs.rmSync(testExt)
    }

    // Remove node_gyp_bins
    const nodeGypBins = path.join(betterSqlite3Dir, "build", "node_gyp_bins")
    if (fs.existsSync(nodeGypBins)) {
      const size = getDirSize(nodeGypBins)
      sqlite3Removed += size
      fs.rmSync(nodeGypBins, { recursive: true, force: true })
    }

    if (sqlite3Removed > 0) {
      console.log(
        `[afterPack] Removed ${(sqlite3Removed / 1024 / 1024).toFixed(1)} MB of better-sqlite3 build artifacts`
      )
    }
  }
}

function getDirSize(dirPath) {
  let size = 0
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      size += getDirSize(fullPath)
    } else {
      size += fs.statSync(fullPath).size
    }
  }
  return size
}
