# Remote Device Hub — 发布资料

本次发布范围已确认为服务、Agent、公开下载包和 npm。集成 ZIP 按下载包发布；ChatGPT
公开商店提交不在本次范围内。各渠道实际发布结果与验证证据分别记录，见
[2026-10-01 发布验证记录](../../../remote-device-server/docs/release-validation-20261001.md)。

## 产品资料

- 英文名称：Remote Device Hub
- 中文说明：远程设备中心
- 简介：Connect your Linux and macOS devices. Run commands, manage files, and monitor processes.
- 中文简介：连接你的 Linux 和 macOS 设备，运行命令、管理文件与进程。
- 分类：Productivity
- MCP URL：`https://mcp.xdistribute.site/mcp`
- 认证：OAuth、PKCE S256、`devices:control`
- 支持平台：Linux 和 macOS

Remote Device Hub connects ChatGPT or another MCP client to Linux and macOS computers that a user enrolls and authorizes. It can list devices, inspect directories, run terminal commands, read and edit files, and manage Agent processes. Commands run with the selected device Agent account. Shell commands are not sandboxed by the file root configuration; production deployments should use a dedicated account and operating-system isolation.

## 组件发布线

发布资料对应独立集成版本线：standalone plugin `1.1.1`。Server、Protocol 和 Agent artifact
由各自仓库构建；本仓库只生成不绑定 App 的 plugin ZIP 或显式 connected profile ZIP。

集成包是否已进入公开下载目录，以 `releases/` 中的当前记录和下载回读证据为准。下载包
发布不表示已上传或提交 ChatGPT 商店，也不替代图标和插件页面的客户端验收。

## Plugin profile

standalone plugin 使用 `plugins/remote-device-hub/mcp.json` 声明真实 HTTPS Streamable HTTP MCP
地址，不声明 App ID。构建命令：

```bash
.venv/bin/python scripts/release.py build plugin \
  --profile standalone
```

connected profile 只在明确需要复用既有 ChatGPT/App 连接时使用，并从 `integrations/chatgpt/connected-app.json` 读取现有 App 身份：

```bash
.venv/bin/python scripts/release.py build plugin \
  --profile connected
```

App 配置是可选适配层，不是 canonical plugin、Hub 或 Agent 的依赖。构建命令只生成 artifact
和 prepared 记录；它不会创建插件、上传 private plugin、替换 daily entry 或部署 MCP 服务。

## 审核材料

未来提交前需要维护者补齐：

- 已验证的发布者身份、支持邮箱和产品主页；
- 可公开访问的隐私政策和服务条款；
- 与公开环境隔离的演示账号和演示设备；
- 实际提交系统生成的域名验证、扫描和最终身份；
- 逐项记录 artifact、版本、校验值、构建输入、客户端和设备验证证据。

提交审核不等于公开发布；审核通过后仍需在目标平台明确选择发布。构建、上传、部署和运行验证必须分别记录，不能用其中一个状态替代另一个。

## Private plugin 实验边界

此前关联 App 的 private plugin 更新没有通过稳定的图标持久化和页面回读验收。该实验的
结果元数据保留在 `docs/history/release-records/`。本次服务和下载发布之后，用户明确授权
更新原私有插件，connected `1.1.1` 已保存到相同插件 ID，云端文件和版本已回读，原 App
绑定保留。详见 [当前私有插件更新](../chatgpt.md#当前私有插件更新)。公开商店提交仍未执行。
不要把历史图标验收失败或旧上传记录当作当前云端版本；宿主 UI 图标与会话重载验证需分别记录。

官方参考：

- <https://developers.openai.com/plugins/deploy/submission>
- <https://developers.openai.com/plugins/build/plugins>
- <https://developers.openai.com/apps-sdk/>
