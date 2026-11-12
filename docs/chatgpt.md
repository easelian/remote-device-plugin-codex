# 本地安装、App 授权与实际调用验证

本地安装只决定插件文件从哪里加载。RDH 插件通过必需的已注册 App 获取工具，不启动本地服务，也不直接连接包内 MCP 地址。Hub 的 MCP 接口仍由平台注册的 App 使用。

## 准备与安装

需要 Node.js 22 或更高版本、Python 3，以及支持插件和 App 的 Codex 客户端。当前源码绑定的是个人 RDH 集成；先确认目标 OpenAI 账号有权访问它。个人集成存在，不代表其他账号可以安装或授权。

在仓库根目录执行：

```sh
npm ci
npm run dev:prepare
npm run dev:check
```

`dev:check` 应显示一个与源码一致的 App ID、空的 `direct_mcp_servers` 和 `passed: true`。这仅证明插件加载正确，不代表已授权或已连上设备。

确定要安装时执行：

```sh
npm run dev:install
npm run dev:status
```

`dev:install` 安装 `remote-device-hub@rdh-development`；其他插件和授权分别管理。安装后新建聊天，必要时重启桌面客户端，使工具状态重新加载。

## 连接目标 RDH 账号

1. 在客户端插件管理中打开 Remote Device Hub，使用 App 的 Connect 流程。
2. 在授权页核对访问范围，登录预期的 RDH 账号并确认授权。审核账号和日常账号的设备列表不同；不要通过重新配对设备来补偿账号选错。
3. 返回客户端，选择本次任务使用的连接。具体的多账号入口以目标客户端实际提供的界面为准。
4. 执行以下只读检查：

```sh
npm run dev:connection
npm run dev:verify
```

`dev:connection` 检查指定 App 是否可访问、是否已连接且可调用，并调用它的 `list_devices`。`dev:verify` 额外核对本地插件的安装状态、版本和文件哈希。报告只输出设备数量，不输出密码、令牌、文件内容或设备 ID。

如果运行时同时暴露多个可用连接，验证脚本不会随意选择。先在宿主中选择目标账号，或使用已确认的连接 ID：

```sh
npm run dev:connection -- --connection-id <目标连接ID>
```

连接 ID 只用于选择已有连接，不是密码，也不能创建或授权连接。App 不可用或未授权时，检查明确失败；不会回退到直接 MCP、SSH 或另一个 App。

## 在目标聊天验收

在启用该插件的新聊天中发送：“使用 Remote Device Hub 列出我的设备，暂不写入文件或执行命令。”核对实际工具调用和返回列表。CLI 临时会话验证成功，不能代替这一步。

审核账号应能看到 `Write-Read PC`、`Read-only PC` 和 `Offline PC`。选择在线设备后，调用 `device_info`，核对 `workspace` 根目录及权限，再读取 `README.txt`。普通新账号返回空列表也是合法结果，不能把它记为设备操作通过。

写入和命令测试见[审核用例](publication/review-test-cases.md)。只读设备不能通过 shell 绕过权限；离线设备不能报告操作成功。操作超时可能已经产生效果，应先检查回执和设备状态，再决定是否重试。

## 常见失败与更新

| 结果 | 含义与处理 |
| --- | --- |
| App unavailable | 当前账号无权访问该注册集成，或集成已不存在；核对集成身份及访问范围 |
| App not connected and callable | 尚未授权、已禁用或工具不可调用；完成目标 App 的连接流程 |
| Expected one list_devices tool | 缺少该 App 的工具或存在多连接歧义；核对工具刷新和账号选择 |
| Installed version/files differ | 本地安装仍旧；重新安装并刷新客户端 |
| Direct MCP configuration is not supported | 安装包包含不支持的直接 MCP 配置；重新执行 `dev:prepare` |

修改源码后重新执行 `dev:install`。不要编辑客户端缓存，也不要把公开投稿 ZIP 安装成本地插件。若要移除开发安装：

```sh
codex plugin remove remote-device-hub@rdh-development
codex plugin marketplace remove rdh-development
```

这只移除指定插件与 marketplace，不等于撤销平台 App 的授权。账号连接通过平台正常管理流程撤销。
