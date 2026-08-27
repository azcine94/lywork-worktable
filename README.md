# LYWork Worktable

LYWork 的官方 Worktable 插件。该仓库独立维护插件源码、版本和 Release；LYWork 主仓库负责 Plugin Host、安装回滚、安全协议，以及经过验证的随包兜底副本。

当前 `0.6.1` 实现对应 LYWork Worktable 插件化开发计划的 Phase 0–6，并建立无需签名密钥的独立 SHA-256 更新通道：

- Worktable 控制室和多项目状态聚合；
- 与 LYWork 原生 Agent Session 共用的工作台布局；
- 项目级 Session Binding、分窗、标签、锁定和布局恢复；
- 受控 HTML Artifact 发现、挂载、刷新和项目级存储；
- Agent 创建任务、产物监听和自动挂载；
- 插件诊断、显式更新、健康激活和失败回滚。

## 开发与验证

```powershell
npm test
```

`src/` 是插件源码，`dist/` 是 LYWork 可直接装载的构建结果。`npm test` 会重新生成 `dist/`，校验 Plugin Manifest、固定 Release 资产、公钥、入口、样式、许可证和核心行为。

## 打包

```powershell
npm run package
```

该命令生成确定性的 `release/lywork-worktable.lywork-plugin`、SHA-256 文件和 Release 元数据。`release/` 不进入 Git。

## 正式发布

正式 Tag Workflow 不依赖签名密钥。Tag 必须与 `plugin.json` 和 `package.json` 版本一致；Workflow 会生成固定名称的插件包、SHA-256 和 Release 元数据。

LYWork 只会从 `update.json` 指定的官方 GitHub 仓库检查更新，并在用户确认后校验 HTTPS 来源、SHA-256 和插件身份。

## 与 LYWork 同步

LYWork 主仓库的 `resources/plugins/worktable/` 保存经过验证的随包兜底镜像。插件日常更新通过本仓库独立发布，不要求 LYWork 主程序同步发版；需要更新随包兜底版本时，再把验证后的 Release 内容同步回 LYWork。
