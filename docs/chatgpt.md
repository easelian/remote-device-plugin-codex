# 本地安装、授权和工具验证

本指南用于验证 RDH 的完整插件：先安装，再完成 OAuth，最后在新对话中实际调用工具。插件源码统一位于 `plugins/remote-device-hub/`；构建成功或能显示技能名称，都不能代替这三个步骤。

## 准备开发安装

需要 Node.js 22 或更新版本、Python 3，以及支持 `codex plugin marketplace` 和 `codex plugin add` 的客户端。在仓库根目录执行：

```sh
npm ci
npm test
npm run dev:prepare
npm run dev:check
npm run dev:install
npm run dev:status
```

`dev:prepare` 生成 `.build/development/`。其中的 `.agents/plugins/marketplace.json` 指向同目录下的插件副本，marketplace 名称为 `rdh-development`。

`dev:check` 应返回 `loaded_mcp_servers: ["remote-device-hub"]` 和 `passed: true`。该检查只读取真实客户端的加载结果，不会安装插件、登录 Hub 或调用设备。

`dev:install` 使用官方命令登记 marketplace 并安装 `remote-device-hub@rdh-development`，会修改当前用户的本地 Codex 安装。它不会公开发布插件。`dev:status` 用于检查这个 marketplace 中的安装状态。

当前 Codex 0.167 本地加载器拒绝 MCP 服务声明中的 `extensions` 字段。因此开发构建仅在生成副本中移除该字段，让客户端从 Hub 发现 OAuth；唯一源码和公开 ZIP 仍保留 OAuth DCR 与 `devices:control` 声明。该处理不改变 Hub 的身份校验和设备权限。

## 完成授权

1. 在桌面端的插件目录找到 `rdh-development` 中的 Remote Device Hub，确认使用的是本次开发安装。
2. 选择连接操作，打开 Hub 的正常授权页面。核对请求的访问范围和目标账户；页面支持继续或取消。
3. 登录后确认授权，回到客户端查看连接结果。已有授权被复用时，记录为授权复用，不能记为首次登录通过。
4. 新建对话并启用开发插件。测试时只启用一个 RDH 安装，避免同名插件混淆；其他插件安装和授权无需删除。

密码、令牌和配对密钥不进入聊天、源码或测试报告。不要通过复制凭据来替代客户端授权流程。若授权需要人工操作，保持该步骤为待完成，先继续独立的构建检查。

授权完成后，在同一台开发机执行：

```sh
npm run dev:verify
```

该命令核对 `rdh-development` 的安装版本与文件哈希，建立临时只读会话，确认 MCP 连接属于这个开发插件，并实际调用一次 `list_devices`。成功报告含 `passed: true`、`auth_status: "oAuth"`、工具数量和设备数量，不保存设备标识或文件内容。旧安装、其他插件的同名连接、未授权状态和工具错误都会返回非零退出码。此命令不修改文件或执行设备命令，也不能代替下面的新对话任务测试。

## 验证实际工具调用

先发送：“列出我的在线设备，暂不写入文件或执行命令。”检查是否实际调用 `list_devices`，并以返回值判断结果。新账户返回空列表也是有效调用；不能据此宣称已经验证设备上的文件操作。

如需验证设备操作，明确选定一个已授权的测试设备，并使用样例数据：

1. 调用 `device_info`，核对设备 ID、在线状态、根目录和权限。
2. 在已确认的样例根目录中读取一个测试文件，核对实际内容和哈希。
3. 需要验证写入时，使用本轮创建的文件，按当前哈希修改并读回。
4. 需要验证命令时，执行事先说明的无害命令，读取作业输出和退出状态；只终止本轮创建的作业。
5. 对离线设备、无写入权限和不存在的设备，检查错误与拒绝结果，不能切换设备或编造成功。

只读验证不自动授权写入和命令。完整的公开审核场景见[审核用例](publication/review-test-cases.md)。记录客户端版本、安装来源、插件版本、授权方式、实际工具名及结果；不要保存无关设备数据或完整敏感输出。

## 更新与移除开发安装

修改唯一源码后，重新执行 `npm run dev:install`，确认安装版本并开启新对话。如果桌面端仍使用旧文件，重启后再次核对。客户端使用安装缓存；不要直接修改缓存中的文件。

不再需要开发安装时，使用官方命令：

```sh
codex plugin remove remote-device-hub@rdh-development
codex plugin marketplace remove rdh-development
```

这只移除指定开发安装和 marketplace。若还需要撤销其 Hub 授权，在账户的授权管理中选择对应客户端；移除文件不等于服务端撤销授权。

## 验证范围

本地安装测试与公开目录安装是不同入口。公开发布后，还需在目标 ChatGPT 和 Codex 客户端上验证目录安装、目标账户 OAuth 和实际调用。一个客户端通过不能代替另一个客户端通过。
