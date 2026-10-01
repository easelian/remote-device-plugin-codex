# ChatGPT 集成

本仓库维护 MCP plugin 清单、主题资源和可选的既有 App 适配配置。它不创建 App，也不构建或部署 Server/Agent。集成版本为 `1.1.1`；本次只准备本地 ZIP，没有上传或更新 ChatGPT 客户端。

## Standalone profile

默认 profile 使用 `plugins/remote-device-hub/mcp.json` 中配置的 HTTPS Streamable HTTP MCP endpoint，当前配置值为 `https://mcp.xdistribute.site/mcp`。该值是包配置，不是本次线上可达性证明。

```bash
.venv/bin/python scripts/release.py build plugin --profile standalone
.venv/bin/python scripts/release.py check releases/plugin-standalone-1.1.1.json
```

包内只有清单、MCP 配置和清单引用的图标。它不绑定 App ID，也不包含 Server 源码、设备运行时、部署配置或 token。

## Connected profile

只有显式选择时，构建器才读取 `integrations/chatgpt/connected-app.json`，并生成引用既有 App 身份的 `.app.json`：

```bash
.venv/bin/python scripts/release.py build plugin --profile connected
.venv/bin/python scripts/release.py check releases/plugin-connected-1.1.1.json
```

这是已有连接的适配与验证产物。它不能作为当前公共 Plugin 提交流程的 standalone 包替代物。`channels.json` 保存分仓前的入口元数据与暂停状态，不能据此推断客户端仍有该入口或已经更新。

## 服务契约与客户端验收

Server 提供 `/mcp`、OAuth 授权码、PKCE S256、动态客户端注册和 `devices:control` scope。实际 URL、OAuth metadata、callback 和账号策略由 Server 的部署配置决定。

一次集成验收应记录实际包版本和 SHA、服务器版本、客户端授权结果，再从客户端调用 `list_devices`、`device_info`，以及隔离测试设备上的文件和进程操作。HTTP 健康检查或 ZIP 校验不能替代客户端调用。

设备安装使用独立 Agent 发布流程提供的 TGZ；Integrations 不提供 Agent 构建命令。Server、Agent 和集成版本可以分别演进，发生协议或 endpoint 改动时需要显式兼容验证。

Hub `0.5.0` 的工具表增加 8 个文件和搜索接口；这些接口要求设备 Agent 在 hello 中明确声明相应 capabilities。Node Agent `0.6.0` 提供文件元数据、多文件 UTF-8 预览、同 root 文件移动、大文件 chunk/tail，以及后台搜索、分页、取消和任务列表。Python Agent `0.4.0` 继续提供 core 工具，调用扩展接口会明确报不支持。工具来自 Server 的 MCP discovery，此次功能扩展不改变 Plugin `1.1.1` 清单或 App 身份。

新版本客户端验收应另外覆盖：多文件读取中单文件失败、大日志尾部读取、文件移动目标冲突、搜索分页/取消，以及网络短暂断开后使用同一 job ID 继续读取进程输出。应记录实际 Server/Agent 版本与 artifact SHA；本地运行证据不能替代真实客户端验收。

本次发布范围为服务、Agent、公开下载包和 npm；ChatGPT 商店提交和 private plugin
云端更新不在本次范围内。`integrations/chatgpt/channels.json` 保留分仓前的暂停状态与
入口基线，`docs/history/` 保留历史云端实验结果。当前版本的实际下载发布结果以
`releases/` 记录和 [2026-10-01 发布验证记录](../../remote-device-server/docs/release-validation-20261001.md)
为准；本地构建不表示任何云端动作已经完成。
