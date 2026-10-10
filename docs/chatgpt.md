# ChatGPT 集成与私人网页测试

当前私人插件版本为 **1.2.0**。在 ChatGPT 网页使用
[Remote Device Hub](https://chatgpt.com/plugins/plugins_6ac993be7294819188f638f4e00f2b5d)，
插件详情应显示 `Version 1.2.0`、一个 Connected App 和 `remote-device-operations` Skill。
点击 **Try in chat** 创建新 Work 会话，确保加载当前 Skill。公开发布保持暂停。

## 连接和版本

私人包使用 `connected` profile，复用已完成 OAuth 授权的
`asdk_app_6ac9a56160088191b8aca17b9705392a`，由
[`connected-app.json`](../integrations/chatgpt/connected-app.json) 生成 `.app.json`。
账户中的插件 ID 保持 `plugins_6ac993be7294819188f638f4e00f2b5d`，可见性为 `USER / PRIVATE`。
此次升级删除该包原有的 `mcp.json` 和 `.mcp.json`，改为引用现有 App，并明确不要求本地执行器。
自动生成的 App 包不能通过当前 Plugin Creator 编辑 Skill，因此操作说明由这个已有的私人包承载。

Hub 服务与插件分别版本化。本轮插件升级未部署 Hub，线上仍为 0.7.0；本地服务器代码中的
MCP 权限说明和计费输出调整尚未上线。插件版本以详情页和云端 release 为准，
`device_info` 返回的是设备环境，不能用它推断插件版本。旧会话也可能仍加载旧 Skill。

当前入口与版本记录在 [`channels.json`](../integrations/chatgpt/channels.json)。目录中两个旧条目
不代表它们已删除：旧独立包 `Plugin_c037faee8bac8191af422bb13e5ae020` 已停用，
自动 App 条目负责当前连接；日常测试应选择上面的 **1.2.0 私人包**。

## 构建

在仓库根目录准备 `requirements-dev.lock` 对应的 Python 环境，然后运行：

```bash
python3 -m pytest tests -q
python3 scripts/release.py build plugin --profile connected
python3 scripts/release.py check releases/plugin-connected-1.2.0.json
```

构建器只收集清单、引用的图标、已列入白名单的 Skill 文件和对应连接配置，回读 ZIP 后记录 SHA-256。
构建不会上传插件、部署服务或公开发布。已记录版本的输入和产物不可变。

`standalone` profile 使用公网 `https://mcp.xdistribute.site/mcp` 及 OAuth DCR 配置，
不包含私人 App ID。它可用于支持原始 MCP 配置的客户端；不能把这个包的校验成功当成网页可用证据。
公开提交使用独立的 `public/remote-device-hub/` 源目录，准备要求见
[公开提交说明](publication/submission-1.2.0.md)。公共包不携带私人 `.app.json`。

## 权限与操作确认的边界

Skill 要求先选择设备、查询能力和允许的根目录；禁止通过 Shell 绕过禁写或文件访问限制。
写入已有文件应先读取当前内容及 SHA-256，再在授权范围内修改并回读。
不明确的目标、覆盖范围或不可逆影响需要先确认；已明确授权的同一操作不重复索取确认。

这套 Skill 约束助手的操作流程。实际的设备归属、根目录、`allow_write`、`allow_shell` 和
哈希冲突由 Hub 与 Agent 执行。它不是服务器强制校验的逐操作批准凭证。
ChatGPT 是否显示原生批准卡片还取决于该账户的 App 工具权限设置，不能保证每次调用都弹窗。
Shell 使用 Agent 的系统账户权限，文件根目录不能作为 Shell 沙箱。

## 验收记录

每次验收应区分：包保存及回读、网页加载 Skill、实际 MCP 调用、Agent 副作用检查。
健康检查、OAuth 成功和本地测试不能替代网页验收；网络错误也不能证明操作未执行。

- [1.2.0 云端包回读](../releases/evidence/plugin-private-1.2.0-readback.json)：确认版本、私人可见性、App 绑定及 Skill 内容。
- [1.2.0 网页权限与确认测试](../releases/evidence/plugin-private-1.2.0-web-tests.json)：包含实际对话、独立文件检查、审计记录和临时设备清理结果。
- [本地回归测试](../releases/evidence/plugin-private-1.2.0-tests.json)：插件集成 20 项通过，服务器 534 项通过、1 项因平台不符跳过。
- [此前网页连接测试](../releases/evidence/plugin-web-connection-20261010.json)：使用自动 App 包，第一次内部错误，第二次只读查询成功。
- [1.2.0 发布记录](../releases/plugin-connected-1.2.0.json)：收录当前验收证据与检查状态。

2026-10-10 的私人网页验收使用专用设备 `rdh-web-ro-20261010`：

| 场景 | 实际结果 |
| --- | --- |
| 禁用文件写入和 Shell | 网页读取 Skill 并检查设备能力后，拒绝修改文件、启动命令和 Shell 绕过；另从 Codex 直接调用写入及进程工具，Agent 均返回 `agent_error`。 |
| 开启写入，仅授权预览 | 网页读取合成文件，展示真实差异并等待确认；独立检查确认文件哈希未变，成功修改次数为 0。 |
| 明确确认替换 | 网页使用读取到的 SHA-256 写入 `confirmed-web-test` 和一个 LF，并回读；独立文件检查及审计确认恰好一次成功写入，没有成功启动进程。 |
| 清理 | 临时设备已撤销，Agent 已停止，合成文件和凭据已删除；审计记录和专用网页测试标签保留。 |

本次预览先遇到 MCP 连接失败，随后一次读取因助手传入 `length=1048576` 被参数校验拒绝。
明确指定 `offset=0, length=128` 后才完成读取，因此本次通过包含人工参数纠正。
`read_file` 的文件大小上限为 1 MiB，但单次 `length` 上限是 65536 字节，默认 32768；
读取小文件可省略 `length`，读取较长文件应分段。1.2.0 包未因本轮测试再作修改。

当前账户下未观察到原生批准卡片；本次验证的是对话中的预览和明确确认。
另一次根目录越界读取测试超时且没有对应审计，结果仍未验证。本轮未测试跨用户隔离，
也未执行全部公开提交用例，不能据此认定已满足公开发布要求。

测试仅使用专用设备和合成文件；结束时撤销临时设备并停止 Agent。连接失败、超时及未覆盖场景
必须保留在证据中，不将一次通过描述为稳定性或所有客户端兼容性证明。

1.1.1 的旧更新和图标验证边界保留在 `releases/plugin-connected-1.1.1.json` 与
`releases/evidence/plugin-*-1.1.1-20261001.json`；这些记录描述当时状态，不代表当前入口。
