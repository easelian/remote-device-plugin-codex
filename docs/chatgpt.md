# ChatGPT 集成与私人网页测试

当前使用不带 Skill 的
[Remote Device Hub App](https://chatgpt.com/plugins/plugin_asdk_app_6ac9b1c6f14c8191a89b4858d1c265a3)。
这是设置页中唯一已安装的 Remote Device Hub 入口，复用现有 OAuth 账户；权限为
**Allow read-only tools**，读取免确认、修改前询问。点击 **Try in chat** 创建新会话。
公开发布保持暂停。

## 连接和版本

App ID 为 `asdk_app_6ac9b1c6f14c8191a89b4858d1c265a3`，连接公网
`https://mcp.xdistribute.site/mcp`。该开发 App 在详情页显示 `1.0.0`，
服务端仍是已部署的 Hub 0.8.0。两者分别版本化，App 页面版本不代表 Hub 代码版本。
Hub 使用 SDK 2.3.0 支持 MCP `2026-07-28`，保留无状态传输、OAuth 和设备访问检查。

按照用户“先去掉 Skill”的决定，额外私人包 `plugins_6ac993be7294819188f638f4e00f2b5d`
已卸载，并更新为 **1.2.3**：删除 `remote-device-operations/SKILL.md` 和三个参考文件，
保留原 `.app.json` 连接、身份、资源和私人可见性。没有改用上一轮候选的直接 MCP 连接方式。
这个未安装的包不再是网页日常入口。

**已安装入口唯一，不等于 Personal 目录的历史记录已全部删除。**
Personal / Created by you 仍显示未安装的 1.2.3 私人包，以及旧的
`Plugin_c037faee8bac8191af422bb13e5ae020`（1.1.1）。实测管理菜单只有编辑、下载和上传版本，
没有删除云端包记录的选项。不得将“卸载成功”写成“云端记录已删除”。

当前入口与状态见 [`channels.json`](../integrations/chatgpt/channels.json)。
本轮移除及网页验证记录见
[无 Skill 网页验收](../releases/evidence/plugin-without-skill-20261010.json)。
上一轮 [完整 Skill 单入口尝试](../releases/evidence/plugin-single-entry-20261010.json)
保留为历史记录；其直接 MCP 候选包与恢复包未上传，等待批准的方案已被本轮决定取代。

## 权限与操作确认的边界

去掉 Skill 后，不再加载原来的设备选择、文件修改和进程管理流程说明。
设备归属、根目录、`allow_write`、`allow_shell`、参数范围和哈希冲突检查仍由 Hub 与 Agent 执行。
文件读写、命令和进程工具继续由 App 提供；实际能执行哪些操作取决于设备配置和 OAuth 权限。
Shell 使用 Agent 的系统账户权限，文件根目录不能作为 Shell 沙箱。

ChatGPT App 的 **Allow read-only tools** 设置独立于 Skill：读取免确认，修改前询问。
本轮从 App 入口实际观察到 Write File 的 **Allow once / Deny** 批准卡，之后服务端记录一次成功
写入，回读内容与哈希一致。工具批准不能代替服务端权限校验；若将权限改成 **Allow all tools**，
原生提示行为会改变。不要依靠已移除 Skill 的对话流程作为强制批准机制。

## 可选集成包的源码与构建

`plugins/remote-device-hub/` 保留 1.2.2 的可选 Skill 源码，供后续恢复或其他客户端使用；
它不是当前网页 App 的运行时依赖。`public/remote-device-hub/` 仍是未公开提交的独立草稿。
不要把这两个带 Skill 的源目录重新上传为当前网页入口，除非用户要求恢复 Skill。

```bash
python3 -m pytest tests -q
python3 scripts/release.py build plugin --profile standalone
```

构建器只收集白名单文件并记录 ZIP 哈希。构建不会安装插件、改动网页 App、部署 Hub 或公开发布。
`standalone` 使用远程 MCP 和 OAuth DCR 配置，不包含私人 App ID；`connected` 使用
[`connected-app.json`](../integrations/chatgpt/connected-app.json) 引用现有 App。
两种可选包的构建成功均不能代替目标客户端验收。历史版本的输入和产物不可变。
公开提交说明见 [公开提交资料](publication/submission-1.2.0.md)。

## 验收记录

每次验收应区分：包保存及回读、网页加载 Skill、实际 MCP 调用、Agent 副作用检查。
健康检查、OAuth 成功和本地测试不能替代网页验收；网络错误也不能证明操作未执行。

### 去掉 Skill 后的私人 App

- [云端回读](../releases/evidence/plugin-without-skill-1.2.3-readback.json)：1.2.3 私人包中没有 Skill 文件，原 App 绑定完全保留，包处于未安装状态。
- [网页与独立审计](../releases/evidence/plugin-without-skill-20261010.json)：只通过 App 入口读取、观察原生写入批准卡、检查单次写入和回读，并在卸载 Skill 后的新会话再次读取。

新会话的首次正常读取返回内部错误；同一时间窗口的代理日志有一次 HTTP 408、上游为 `-`。
后续一次明确的新读取成功，内容与哈希一致。时间相关性不等于请求级归因，也不能据此宣称连接
已完全稳定。越界读取返回 `agent_error`，没有泄露标记文件内容；错误未暴露具体拒绝原因。

原生批准卡出现后，在自动化打开详情前已经消失，随后审计显示恰好一次成功写入。
自动化没有执行批准点击，未观察到批准者身份；不能将之后采集的文件状态当作批准等待期间的证明。
最终专用设备的成功操作为 3 次 `device_info`、3 次 `read_file` 和 1 次 `write_file`，
另有一次失败读取。临时设备已撤销，Agent、合成文件和凭据已清理，审计保留。

### 1.2.2 与 Hub 0.8.0

- [私有包云端回读](../releases/evidence/plugin-private-1.2.2-readback.json)：包 ID 保持不变，恢复已删除的 App 绑定并确认安装成功。
- [新版网页验收](../releases/evidence/plugin-private-1.2.2-hub-0.8.0-web-tests.json)：包含对话、原生批准参数、批准前后的文件检查、审计及清理结果。
- [此前 0.7.1 网页记录](../releases/evidence/plugin-private-1.2.2-web-tests.json)：业务操作通过，但当时仍有协议版本导致的 HTTP 400。
- [1.2.2 发布记录](../releases/plugin-connected-1.2.2.json)：保存私人上传、回读和验收证据。

新版使用专用设备 `rdh-web-080-20261010` 和合成文件。未向网页提供 `length` 数值，
读取直接成功；禁写和禁 Shell 时拒绝绕过，仅授权预览时没有修改文件。
对话确认后，写入仍等待原生批准。核对目标、内容及 SHA-256 后选择 **Allow once**，
服务端审计确认恰好一次写入，回读内容和哈希一致。

之后连续三次只读调用均成功，未额外重试。整个验收窗口约 330 秒，代理记录 57 次 HTTP 200、
1 次未单独归因的 HTTP 401，未出现 HTTP 400 或 5xx。临时设备已撤销，Agent、合成文件和凭据
已清理；专用网页测试标签保留。该有限窗口不能代表长期网络可用性。

服务端本地全套测试为 539 项通过、1 项因平台限制跳过；覆盖新旧 MCP 协议、跨用户拒绝、
令牌撤销、根目录和读取长度边界。网页验收使用一个账户，不能替代全部公开发布用例。

### 1.2.0 历史记录

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

上述 1.2.0 验收时未观察到原生批准卡片；当时验证的是对话中的预览和明确确认。
另一次根目录越界读取测试超时且没有对应审计，结果仍未验证。本轮未测试跨用户隔离，
也未执行全部公开提交用例，不能据此认定已满足公开发布要求。

测试仅使用专用设备和合成文件；结束时撤销临时设备并停止 Agent。连接失败、超时及未覆盖场景
必须保留在证据中，不将一次通过描述为稳定性或所有客户端兼容性证明。

1.1.1 的旧更新和图标验证边界保留在 `releases/plugin-connected-1.1.1.json` 与
`releases/evidence/plugin-*-1.1.1-20261001.json`；这些记录描述当时状态，不代表当前入口。
