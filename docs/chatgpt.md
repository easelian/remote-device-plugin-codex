# Remote Device Hub：ChatGPT 接入

ChatGPT/App 是 Remote Device Hub 的可选入口适配层。Hub、Protocol、Python Agent 和 Node Agent 都可以独立维护和发布，不需要先创建或更新 App。

## 当前在线入口

此前在线并经过验证的入口仍是 0.3.0 线：

| 用途 | 地址 |
| --- | --- |
| MCP | `https://mcp.xdistribute.site/mcp` |
| 设备管理 | `https://xdistribute.site:8090/admin` |
| OAuth 发现 | `https://mcp.xdistribute.site/.well-known/oauth-authorization-server` |
| Protected resource metadata | `https://mcp.xdistribute.site/.well-known/oauth-protected-resource/mcp` |

本次本地组件化改动没有远程验证、部署或 ChatGPT 客户端更新。在线状态不能代表 Protocol 1.0.0、Hub 0.4.0、Python Agent 0.4.0、Node Agent 0.4.1 或 standalone plugin 1.1.0 已经生效。

## Standalone MCP plugin

canonical plugin 默认是 standalone profile：

- `plugins/remote-device-hub/plugin.json` 不包含 App ID；
- `plugins/remote-device-hub/mcp.json` 声明 `https://mcp.xdistribute.site/mcp`；
- 构建只包含显式允许的清单、MCP 配置和品牌资源。

构建命令：

```bash
.venv/bin/python scripts/release.py build plugin \
  --profile standalone --channel hosted
```

这个命令只生成本地 ZIP 和 `releases/` prepared 记录，不上传 ChatGPT、不创建插件、不更新 daily entry。private plugin 上传已暂停；不要把 standalone 构建或 Hub/Agent 构建当成客户端更新。

## Connected profile

如果明确需要复用既有 ChatGPT/App 连接，才使用：

```bash
.venv/bin/python scripts/release.py build plugin \
  --profile connected --channel hosted-connected
```

connected profile 会读取 `integrations/chatgpt/connected-app.json` 中的现有 App 身份。该文件是可选环境配置，不是 Hub、Agent 或 standalone plugin 的运行时依赖。除非完成实际客户端持久化、入口选择和工具调用验收，否则不能把 connected artifact 标记为 uploaded 或 verified。

此前通过 App 关联插件更新图标的 private 实验没有通过稳定的图标持久化/页面回读验收，公开发布仍暂停。因此不要重复上传 private plugin，也不要创建新的云端条目来代替代码组件发布。

## MCP 连接参数

| 字段 | 值 |
| --- | --- |
| Server URL | `https://mcp.xdistribute.site/mcp` |
| Transport | Streamable HTTP |
| Authentication | OAuth + PKCE |
| Registration | Dynamic Client Registration (DCR) |
| Scope | `devices:control` |

健康检查和 OAuth 发现只能证明 HTTP 入口响应正常；它们不等于 ChatGPT 工具调用成功。实际运行验证还需要连接客户端、完成授权并调用 `list_devices`、`device_info`，再确认目标设备 Agent 的动作结果。

## 设备入口

设备应使用构建后的 Node Agent TGZ，不要直接运行旧 npm workspace runtime：

```bash
npx --yes ./dist/remote-device-hub-<agent-version>.tgz \
  --root projects=/home/alice/projects --name '开发机'
```

旧 workspace runtime 是历史内容；新的 bootstrap 会拒绝不包含独立 Agent/Protocol wheels 的清单。0.4.0 npm TGZ 已排除为诊断产物，不发布、不安装、不作为回滚版本。新版本必须通过 `scripts/release.py build agent --channel npm` 生成完整 TGZ 后，才进入后续发布评估。

## 排查边界

- HTTP 健康检查失败：检查 HTTPS 入口、反向代理和 Hub 部署版本。
- OAuth 发现成功但工具调用失败：检查 MCP resource、OAuth scope、客户端连接和实际授权状态。
- 设备离线：检查目标设备上的 Agent 进程、网络、profile 和设备 ID。
- 文件/命令结果异常：先确认 ChatGPT 选择的 `device_id`，再检查 Agent 账户权限和目标目录。

这些检查应记录实际版本和证据。不要用旧 0.3.0 的在线结果替代新组件的发布或运行验证。
