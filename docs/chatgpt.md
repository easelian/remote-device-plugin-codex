# ChatGPT 与 Codex 的安装和连接验证

Remote Device Hub 插件提供设备操作技能和 MCP 连接。每位用户通过 OAuth 授权自己的 Hub 账户，并配对自己的设备。插件包中的连接声明与客户端实际可用的工具需要分别验证。

## 包与连接配置

| 来源 | 用途 | 连接配置 |
| --- | --- | --- |
| `plugins/remote-device-hub/` | Codex 独立包 | `mcp.json` 声明服务类型和 URL，由客户端发现 OAuth |
| `public/remote-device-hub/` | 公开提交包 | 声明 MCP 入口、OAuth 动态客户端注册和 `devices:control` |
| `integrations/chatgpt/connected-app.json` | connected 构建配置 | 使用平台登记的 App 标识，与对应账户绑定 |

MCP 地址默认为 `https://rdh.easelian.com/mcp`。公开上传包不包含 `.app.json`、个人 App 标识、授权头或凭据；平台连接通过目标平台的发布和安装流程建立。

## 构建与加载检查

在仓库根目录执行：

```sh
npm ci
npm test
npm run package:standalone
npm run check:codex
```

加载检查应返回 `loaded_mcp_servers: ["remote-device-hub"]` 和 `passed: true`。该检查只验证实际 Codex 加载器能识别服务，不会安装插件、登录 Hub 或调用设备工具。

`npm run package:draft` 生成公开提交草稿和材料报告。`npm run package` 在必填材料缺失时失败。构建结果与平台上传、审核、发布状态分别管理。

## 客户端验收

分别在 ChatGPT 和 Codex 中，使用目标平台支持的安装方式和没有该插件授权缓存的测试账户执行：

1. 确认安装的插件名称、版本、技能和连接入口与目标包一致。
2. 完成首次 OAuth，确认连接属于测试者自己的 Hub 账户。
3. 调用 `list_devices`，以工具返回结果判断设备列表；新账户可以返回空列表。
4. 按 Hub 网站说明配对隔离的样例设备，再次查询并核对实际设备 ID。
5. 查看根目录和权限，执行文件读取、创建、按哈希修改及读回验证。
6. 在允许 shell 的样例设备上执行固定命令，读取作业输出和退出状态。
7. 使用另一个 Hub 账户检查设备隔离，并验证权限拒绝和离线设备的处理。

只显示技能或连接名称不能证明工具可调用。记录加载、首次授权、工具发现、实际调用及其结果；一个客户端通过不能替代另一个客户端的验证。出现超时或响应丢失时，先检查操作结果再决定是否重试。

公开发布的材料、审核账户和录制要求见[提交准备](publication/submission.md)。
