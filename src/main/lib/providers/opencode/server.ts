import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { buildOpenCodeEnv, getOpenCodeBinaryPath } from "./env";
import type { ServerState } from "./types";

const DEFAULT_PORT = 4096;
const HEALTH_CHECK_INTERVAL = 100; // ms
const STARTUP_TIMEOUT = 30000; // 30 seconds
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds

/**
 * OpenCode Server Manager
 *
 * Manages the lifecycle of the OpenCode HTTP server.
 * The server can be started, connected to (if already running), or shutdown.
 */
export class OpenCodeServer extends EventEmitter {
  private process: ChildProcess | null = null;
  private port: number;
  private state: ServerState;
  private weStartedServer = false;

  constructor(port: number = DEFAULT_PORT) {
    super();
    this.port = port;
    this.state = { port, pid: 0, status: "stopped" };
  }

  /**
   * Get current server state
   */
  getState(): ServerState {
    return { ...this.state };
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Check if server is healthy by calling /global/health endpoint
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getUrl()}/global/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        const data = (await response.json()) as { healthy?: boolean };
        return data.healthy === true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Connect to an existing OpenCode server
   * Returns true if connected successfully, false if no server is running
   */
  async connect(): Promise<boolean> {
    console.log(
      `[opencode-server] Checking for existing server at port ${this.port}...`,
    );

    const isHealthy = await this.checkHealth();
    if (isHealthy) {
      console.log("[opencode-server] Connected to existing server");
      this.state = {
        port: this.port,
        pid: 0, // Unknown PID for external server
        status: "running",
      };
      this.weStartedServer = false;
      this.emit("connected");
      return true;
    }

    return false;
  }

  /**
   * Start the OpenCode server
   */
  async start(): Promise<void> {
    if (this.state.status === "running") {
      console.log("[opencode-server] Server already running");
      return;
    }

    if (this.state.status === "starting") {
      console.log("[opencode-server] Server already starting, waiting...");
      return this.waitForReady();
    }

    console.log(`[opencode-server] Starting server on port ${this.port}...`);
    this.state = { ...this.state, status: "starting" };
    this.emit("starting");

    // Find binary
    const binaryResult = getOpenCodeBinaryPath();
    if (!binaryResult) {
      this.state = {
        ...this.state,
        status: "error",
        error: "OpenCode binary not found",
      };
      this.emit("error", new Error("OpenCode binary not found"));
      throw new Error(
        "OpenCode binary not found. Install via: npm install -g opencode",
      );
    }

    // Build environment
    const env = buildOpenCodeEnv();

    // Spawn server process
    const args = ["serve", "--port", String(this.port)];
    console.log(
      `[opencode-server] Spawning: ${binaryResult.path} ${args.join(" ")}`,
    );

    this.process = spawn(binaryResult.path, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    this.weStartedServer = true;

    // Handle stdout
    this.process.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log("[opencode-server] stdout:", output.trim());
    });

    // Handle stderr
    this.process.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.error("[opencode-server] stderr:", output.trim());
    });

    // Handle process exit
    this.process.on("exit", (code, signal) => {
      console.log(
        `[opencode-server] Process exited with code ${code}, signal ${signal}`,
      );
      const wasRunning = this.state.status === "running";
      this.state = {
        ...this.state,
        status: "stopped",
        pid: 0,
      };
      this.process = null;
      this.emit("exit", { code, signal });

      // If it was running and we didn't initiate shutdown, it crashed
      if (wasRunning && this.weStartedServer) {
        this.emit("crash", { code, signal });
      }
    });

    // Handle process error
    this.process.on("error", (error) => {
      console.error("[opencode-server] Process error:", error);
      this.state = {
        ...this.state,
        status: "error",
        error: error.message,
      };
      this.emit("error", error);
    });

    // Store PID
    this.state = { ...this.state, pid: this.process.pid || 0 };

    // Wait for server to be ready
    await this.waitForReady();
  }

  /**
   * Wait for server to be ready (health check passes)
   */
  private async waitForReady(): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < STARTUP_TIMEOUT) {
      const isHealthy = await this.checkHealth();
      if (isHealthy) {
        console.log("[opencode-server] Server is ready");
        this.state = { ...this.state, status: "running" };
        this.emit("ready");
        return;
      }

      // Check if process died
      if (this.process && this.process.exitCode !== null) {
        const error = new Error(
          `Server process exited with code ${this.process.exitCode}`,
        );
        this.state = {
          ...this.state,
          status: "error",
          error: error.message,
        };
        throw error;
      }

      // Wait before next check
      await sleep(HEALTH_CHECK_INTERVAL);
    }

    // Timeout
    const error = new Error(
      `Server startup timeout after ${STARTUP_TIMEOUT}ms`,
    );
    this.state = {
      ...this.state,
      status: "error",
      error: error.message,
    };

    // Kill the process if it's still running
    if (this.process) {
      this.process.kill("SIGTERM");
    }

    throw error;
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown(): Promise<void> {
    // Only shutdown if we started the server
    if (!this.weStartedServer) {
      console.log(
        "[opencode-server] Not shutting down - we didn't start this server",
      );
      this.state = { ...this.state, status: "stopped" };
      return;
    }

    if (!this.process) {
      console.log("[opencode-server] No process to shutdown");
      this.state = { ...this.state, status: "stopped" };
      return;
    }

    console.log("[opencode-server] Shutting down server...");
    this.state = { ...this.state, status: "stopping" };
    this.emit("stopping");

    // Send SIGTERM for graceful shutdown
    this.process.kill("SIGTERM");

    // Wait for process to exit
    const exitPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log("[opencode-server] Shutdown timeout, sending SIGKILL...");
        this.process?.kill("SIGKILL");
        resolve();
      }, SHUTDOWN_TIMEOUT);

      this.process?.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await exitPromise;

    this.process = null;
    this.state = { ...this.state, status: "stopped", pid: 0 };
    this.weStartedServer = false;
    console.log("[opencode-server] Server shutdown complete");
    this.emit("shutdown");
  }

  /**
   * Ensure server is running (start if not, connect if already running)
   * This is the main entry point for provider initialization
   */
  async ensureRunning(): Promise<void> {
    // Already running
    if (this.state.status === "running") {
      // Verify it's still healthy
      const isHealthy = await this.checkHealth();
      if (isHealthy) {
        return;
      }
      // Server died, restart it
      console.log("[opencode-server] Server died, restarting...");
      this.state = { ...this.state, status: "stopped" };
    }

    // Try to connect to existing server first
    const connected = await this.connect();
    if (connected) {
      return;
    }

    // Start new server
    await this.start();
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Singleton server instance (one server shared across all sessions)
let serverInstance: OpenCodeServer | null = null;

/**
 * Get or create the singleton server instance
 */
export function getServerInstance(port?: number): OpenCodeServer {
  if (!serverInstance) {
    serverInstance = new OpenCodeServer(port);
  }
  return serverInstance;
}

/**
 * Reset server instance (for testing)
 */
export function resetServerInstance(): void {
  serverInstance = null;
}
