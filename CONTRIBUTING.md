# 参与贡献 SamBetterCode

感谢你帮助改进 SamBetterCode。本项目基于 BetterCode 上游持续迭代，接受功能增强、缺陷修复、跨平台兼容、文档改进和简体中文本地化修正。

## 开始之前

请先确认本机已安装：

- Bun
- Node.js 18 或更高版本
- Python 3
- Git
- 对应平台的原生编译工具
  - macOS：Xcode Command Line Tools
  - Linux：`build-essential` 等常见构建工具
  - Windows：Visual Studio Build Tools，包含 C++ 桌面开发工具链

如果要验证某个 AI 提供商，还需要安装并登录对应 CLI，或完成 OpenCode 提供商配置。

## 本地开发

在项目根目录安装依赖：

```bash
bun install
```

启动 Electron 开发环境：

```bash
bun run dev
```

生产构建：

```bash
bun run build
```

依赖安装会运行 `electron-rebuild`。如果原生模块编译失败，请优先检查 Python、C++ 编译工具、Node/Bun 架构和 Electron 版本是否匹配，不要直接删除或绕过原生依赖。

## 推荐贡献流程

1. 从最新目标分支创建功能分支。
2. 将改动限制在一个清晰目标内，避免混入无关重构和全仓库格式化。
3. 阅读目标目录及其父目录中的 `AGENTS.md`，遵循对应边界约束。
4. 完成实现、中文文案和必要文档。
5. 运行静态检查、生产构建和实际场景验证。
6. 提交说明清晰的 Pull Request，描述动机、实现、风险和验证证据。

建议使用可读的分支名，例如：

```text
feature/provider-settings
fix/windows-terminal-resize
docs/localization-guide
```

## 代码规范

- 使用 TypeScript 严格类型，避免无必要的 `any`、非空断言和类型逃逸。
- 使用 Bun 执行项目脚本。
- Biome 负责 lint、格式和导入组织；未使用的导入和变量会导致检查失败。
- 不要为通过检查而关闭规则，也不要格式化未修改的文件。
- Electron 生命周期、原生能力和长生命周期服务放在 `src/main`。
- 渲染进程不得直接使用 Node.js 或 Electron 原生 API；通过 tRPC 或受限的 preload bridge 访问。
- tRPC 是主进程与渲染进程之间的主要功能数据边界。
- 新增 preload 能力时，必须同步运行时实现和类型声明，并保持最小权限。
- 用户控制的路径或参数不得直接拼接到 shell 命令中。
- Git 相关修改必须复用安全路径校验、注册工作树检查、命令封装和 `gitQueue`，不得绕过。
- 数据库 schema 变更必须生成并审查 Drizzle 迁移，不得只修改运行时代码。

## 前端与中文本地化规范

- 用户可见文案统一使用简体中文，技术品牌、模型名、命令、路径、环境变量和协议字段按原文保留。
- 中文标点优先使用全角形式；命令、文件名、代码和变量使用反引号包裹。
- 不要翻译机器协议值、Git 状态字母、模型 ID、YAML 字段名或错误 code。
- 新增错误处理时，应确保 toast、对话框、空状态和流式消息中的 fallback 文案均为中文。
- 新建对话默认名称使用 `新建对话`，读取历史数据时继续兼容旧值 `New Chat`。
- 使用语义颜色 token 和共享 UI 原语，不要引入重复组件或无范围限制的全局 CSS。
- 保持中文字体配置在 `src/renderer/index.html`、`src/renderer/styles/globals.css` 和 `src/renderer/lib/fonts.ts` 之间同步。
- 保留桌面标题栏的 `drag` / `no-drag` 交互区域。
- 界面改动必须验证明暗主题、窄窗口、长中文、换行、裁切、键盘操作和焦点状态。

## 兼容性约束

除非有明确迁移方案和升级验证，不要修改以下内部标识：

- npm 包名 `bettercode-desktop`
- Electron `appId`：`app.bettercode.desktop`
- `bettercode` / `bettercode-dev` 协议
- `.bettercode/worktrees` 工作树目录
- `bettercode-updater` 更新缓存标识
- Windows AppUserModelId

用户可见品牌为 SamBetterCode，但这些历史标识需要继续兼容已有安装和数据。

## 验证要求

提交前至少运行：

```bash
bun run lint
bun run typecheck
bun run build
```

可选的综合检查：

```bash
bun run check
bun run knip
```

涉及数据库时：

```bash
bun run db:generate
```

请审查生成的 SQL 和 `drizzle/meta` 变化。`bun run db:push` 仅适合本地开发验证，不应代替持久迁移。

### 手动验证清单

根据改动范围检查：

- onboarding 和提供商安装、登录、刷新状态
- 新建项目、打开项目和项目设置
- 新建对话、历史对话和旧 `New Chat` 数据兼容
- 计划模式、智能体模式、Ralph 和消息队列
- 子对话切换、取消、错误和会话恢复
- Git 状态、暂存、提交、拉取、推送、分支切换、工作树和 PR
- 文件树、搜索、差异查看和文件内容预取
- 集成终端的创建、切换、恢复、调整大小和关闭
- 明暗主题、窄窗口、中文换行与裁切
- 菜单、托盘、Dock、系统通知和更新提示
- 标题栏拖动区域与交互控件的 `no-drag` 区域

如果某项无法验证，请在 Pull Request 中说明原因和剩余风险。

## 提交与 Pull Request

提交信息应描述行为变化，而不是只描述文件操作。例如：

```text
fix: 修复工作树创建错误的中文提示
feat: 增加 OpenCode 提供商状态说明
docs: 完善 Windows 源码构建步骤
```

Pull Request 建议包含：

- 问题背景和目标
- 主要实现方案
- 影响的模块和兼容性考虑
- 已运行的命令及结果
- 界面改动的截图或录屏
- 已知限制和后续工作

不要提交 API 密钥、登录凭据、用户数据库、调试日志中的敏感信息、构建产物或本地缓存。

## 法律与许可证

贡献内容沿用项目的 Apache License 2.0。`LICENSE` 和 `NOTICE` 是法律文件，除非变更经过明确的法律审查，否则不要修改。
