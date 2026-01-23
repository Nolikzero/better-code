export interface AppDetection {
  /** App bundle paths to check in /Applications (macOS) */
  appBundles?: string[];
  /** CLI commands to check via `which` (macOS/Linux) */
  cliCommands?: string[];
  /** Executable names to check via `where` (Windows) */
  exeNames?: string[];
  /** Program Files subdirectories to check (Windows) */
  programFilesPaths?: string[];
}

export interface AppDefinition {
  id: string;
  name: string;
  category: "file-manager" | "editor" | "ide" | "terminal";
  platforms: ("darwin" | "win32" | "linux")[];
  detection: {
    darwin?: AppDetection;
    win32?: AppDetection;
    linux?: AppDetection;
  };
  launch: {
    darwin?: { command: string; args: string[]; useCwd?: boolean };
    win32?: { command: string; args: string[]; useCwd?: boolean };
    linux?: { command: string; args: string[]; useCwd?: boolean };
  };
}

export const APP_REGISTRY: AppDefinition[] = [
  // File Managers
  {
    id: "finder",
    name: "Finder",
    category: "file-manager",
    platforms: ["darwin"],
    detection: { darwin: { cliCommands: ["open"] } },
    launch: { darwin: { command: "open", args: ["{path}"] } },
  },
  {
    id: "explorer",
    name: "Explorer",
    category: "file-manager",
    platforms: ["win32"],
    detection: { win32: { exeNames: ["explorer.exe"] } },
    launch: { win32: { command: "explorer.exe", args: ["{path}"] } },
  },
  {
    id: "file-manager",
    name: "File Manager",
    category: "file-manager",
    platforms: ["linux"],
    detection: {
      linux: { cliCommands: ["xdg-open", "nautilus", "dolphin", "thunar"] },
    },
    launch: { linux: { command: "xdg-open", args: ["{path}"] } },
  },

  // Editors
  {
    id: "vscode",
    name: "VS Code",
    category: "editor",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: {
        appBundles: ["Visual Studio Code.app"],
        cliCommands: ["code"],
      },
      win32: {
        exeNames: ["code.cmd", "code"],
        programFilesPaths: ["Microsoft VS Code/Code.exe"],
      },
      linux: { cliCommands: ["code"] },
    },
    launch: {
      darwin: { command: "code", args: ["{path}"] },
      win32: { command: "code", args: ["{path}"] },
      linux: { command: "code", args: ["{path}"] },
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    category: "editor",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: { appBundles: ["Cursor.app"], cliCommands: ["cursor"] },
      win32: { exeNames: ["cursor.cmd", "cursor"] },
      linux: { cliCommands: ["cursor"] },
    },
    launch: {
      darwin: { command: "cursor", args: ["{path}"] },
      win32: { command: "cursor", args: ["{path}"] },
      linux: { command: "cursor", args: ["{path}"] },
    },
  },
  {
    id: "sublime",
    name: "Sublime Text",
    category: "editor",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: {
        appBundles: ["Sublime Text.app"],
        cliCommands: ["subl"],
      },
      win32: {
        exeNames: ["subl.exe"],
        programFilesPaths: ["Sublime Text/subl.exe"],
      },
      linux: { cliCommands: ["subl"] },
    },
    launch: {
      darwin: { command: "subl", args: ["{path}"] },
      win32: { command: "subl", args: ["{path}"] },
      linux: { command: "subl", args: ["{path}"] },
    },
  },

  // IDEs
  {
    id: "xcode",
    name: "Xcode",
    category: "ide",
    platforms: ["darwin"],
    detection: {
      darwin: { appBundles: ["Xcode.app"], cliCommands: ["xed"] },
    },
    launch: { darwin: { command: "xed", args: ["{path}"] } },
  },
  {
    id: "phpstorm",
    name: "PHPStorm",
    category: "ide",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: { appBundles: ["PhpStorm.app"], cliCommands: ["pstorm"] },
      win32: {
        exeNames: ["pstorm64.exe", "pstorm.cmd"],
        programFilesPaths: ["JetBrains/PhpStorm/bin/pstorm64.exe"],
      },
      linux: { cliCommands: ["pstorm", "phpstorm"] },
    },
    launch: {
      darwin: { command: "pstorm", args: ["{path}"] },
      win32: { command: "pstorm", args: ["{path}"] },
      linux: { command: "pstorm", args: ["{path}"] },
    },
  },
  {
    id: "webstorm",
    name: "WebStorm",
    category: "ide",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: { appBundles: ["WebStorm.app"], cliCommands: ["webstorm"] },
      win32: { exeNames: ["webstorm64.exe", "webstorm.cmd"] },
      linux: { cliCommands: ["webstorm"] },
    },
    launch: {
      darwin: { command: "webstorm", args: ["{path}"] },
      win32: { command: "webstorm", args: ["{path}"] },
      linux: { command: "webstorm", args: ["{path}"] },
    },
  },
  {
    id: "intellij",
    name: "IntelliJ IDEA",
    category: "ide",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: {
        appBundles: ["IntelliJ IDEA.app", "IntelliJ IDEA CE.app"],
        cliCommands: ["idea"],
      },
      win32: { exeNames: ["idea64.exe", "idea.cmd"] },
      linux: { cliCommands: ["idea"] },
    },
    launch: {
      darwin: { command: "idea", args: ["{path}"] },
      win32: { command: "idea", args: ["{path}"] },
      linux: { command: "idea", args: ["{path}"] },
    },
  },
  {
    id: "pycharm",
    name: "PyCharm",
    category: "ide",
    platforms: ["darwin", "win32", "linux"],
    detection: {
      darwin: {
        appBundles: ["PyCharm.app", "PyCharm CE.app"],
        cliCommands: ["pycharm"],
      },
      win32: { exeNames: ["pycharm64.exe", "pycharm.cmd"] },
      linux: { cliCommands: ["pycharm"] },
    },
    launch: {
      darwin: { command: "pycharm", args: ["{path}"] },
      win32: { command: "pycharm", args: ["{path}"] },
      linux: { command: "pycharm", args: ["{path}"] },
    },
  },

  // Terminals
  {
    id: "terminal",
    name: "Terminal",
    category: "terminal",
    platforms: ["darwin"],
    detection: {
      darwin: { appBundles: ["Utilities/Terminal.app"] },
    },
    launch: {
      darwin: { command: "open", args: ["-a", "Terminal", "{path}"] },
    },
  },
  {
    id: "iterm",
    name: "iTerm",
    category: "terminal",
    platforms: ["darwin"],
    detection: {
      darwin: { appBundles: ["iTerm.app"] },
    },
    launch: {
      darwin: { command: "open", args: ["-a", "iTerm", "{path}"] },
    },
  },
  {
    id: "warp",
    name: "Warp",
    category: "terminal",
    platforms: ["darwin"],
    detection: {
      darwin: { appBundles: ["Warp.app"] },
    },
    launch: {
      darwin: { command: "open", args: ["-a", "Warp", "{path}"] },
    },
  },
  {
    id: "cmd",
    name: "Command Prompt",
    category: "terminal",
    platforms: ["win32"],
    detection: { win32: { exeNames: ["cmd.exe"] } },
    launch: {
      win32: {
        command: "cmd.exe",
        args: [],
        useCwd: true,
      },
    },
  },
  {
    id: "powershell",
    name: "PowerShell",
    category: "terminal",
    platforms: ["win32"],
    detection: { win32: { exeNames: ["pwsh.exe", "powershell.exe"] } },
    launch: {
      win32: {
        command: "pwsh.exe",
        args: ["-NoExit"],
        useCwd: true,
      },
    },
  },
  {
    id: "gnome-terminal",
    name: "GNOME Terminal",
    category: "terminal",
    platforms: ["linux"],
    detection: { linux: { cliCommands: ["gnome-terminal"] } },
    launch: {
      linux: {
        command: "gnome-terminal",
        args: ["--working-directory", "{path}"],
      },
    },
  },
  {
    id: "konsole",
    name: "Konsole",
    category: "terminal",
    platforms: ["linux"],
    detection: { linux: { cliCommands: ["konsole"] } },
    launch: {
      linux: {
        command: "konsole",
        args: ["--workdir", "{path}"],
      },
    },
  },
  {
    id: "xfce4-terminal",
    name: "Xfce Terminal",
    category: "terminal",
    platforms: ["linux"],
    detection: { linux: { cliCommands: ["xfce4-terminal"] } },
    launch: {
      linux: {
        command: "xfce4-terminal",
        args: ["--working-directory", "{path}"],
      },
    },
  },
];
