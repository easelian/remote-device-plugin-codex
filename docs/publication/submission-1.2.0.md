# Remote Device Hub 1.2.0 公开提交准备

本目录用于准备上传到 OpenAI Platform 的公开插件 ZIP。当前交付是草稿：发布者名称、真实演示录像和网页版验收尚未完成，不能据此提交审核。构建不会创建私人插件、上传草稿或部署 Hub。

## 本次范围

用户已确认保留 Linux/macOS 设备状态、文件读写、命令执行和进程管理，完善权限检查与操作确认；面向所有平台允许发布的国家和地区；业务采用免费额度和付费订阅。

源仓库从 macOS 的 `remote-device-integrations` 复制到当前目录，基线提交为 `1e4fed768d5aeced9aa66cdebb047b89b90e9acf`。公开源文件位于 `public/remote-device-hub/`，沿用 `remote-device-hub` 包名与现有明暗图标，版本为 `1.2.0`。随后用户要求先做私人网页验收：`plugins/remote-device-hub/` 已同步到 `1.2.0`，connected profile 复用 2026-10-10 已授权的 App。公开目录仍是独立草稿，不包含私人 App 绑定。

## 已补充内容与实际边界

- `plugin.json`：英文上架介绍、中文翻译、四个产品链接、全地区配置、发布说明、五项正向和三项负向审核用例。
- `mcp.json`：现有公网 Streamable HTTP MCP 地址、OAuth DCR 和真实的 `devices:control` scope。
- `skills/remote-device-operations/`：设备选择、能力与权限检查、修改前核对目标、文件当前哈希、命令生命周期和未知结果恢复。
- 独立构建脚本：拒绝私人 App 绑定、凭据字段、固定认证请求头、意外文件和符号链接；回读 ZIP 并记录 SHA-256。材料不全时只生成带 `-draft` 的文件。

Hub 和 Agent 已有账户归属检查、设备撤销、文件根目录、`allow_write` / `allow_shell` 开关及文件 SHA-256 冲突保护。本次 Skill 完善的是助手操作流程；危险工具通过 MCP annotations 向宿主声明副作用。它不是新增的、由服务器强制校验的逐操作批准凭证机制。是否弹出确认还取决于宿主权限设置和用户已给出的授权。Shell 仍以 Agent 操作系统用户权限运行，文件根目录不限制 Shell 的访问范围。

同级 `remote-device-server/` 的本地补丁调整了 MCP instructions、`get_billing_status` 和额度错误：只返回当前权益与余额，去除交易链接和升级引导。独立网站的计费入口和计费规则保留。这些修改尚未部署，ZIP 也不包含服务端 Python 代码。

## 公开页面与收费信息

2026-10-10 从当前开发机通过 curl 获取并检查了以下页面，均返回 HTTP 200，页面内容属于 Remote Device Hub：

| 用途 | 已核实地址 |
| --- | --- |
| 官网 | https://mcp.xdistribute.site/ |
| 支持表单 | https://mcp.xdistribute.site/contact |
| 隐私政策 | https://mcp.xdistribute.site/privacy |
| 服务条款 | https://mcp.xdistribute.site/terms |

网页的运营者名称仍是“Remote Device Hub 个人开发者”，需要与最终验证的个人或企业名称一致。此次只核实页面访问和内容，没有重新提交支持工单，也没有验证法律主体身份。

网站当前明确标注免费测试、收费尚未开放；提交介绍保留这一事实。用户确认的免费额度和付费订阅是业务模式，不表示已经开通购买。`review.commerce=false` 描述插件本身不执行交易；`commerce_description` 同时披露外部服务的订阅模式。不要把它解释为整个服务永久免费。

按当前公开规则，插件可使用用户已有订阅权益，但不能推销升级、展示购买流程或给出直接结账链接。因此额度不足时只解释当前权益，不通过更换工具或账户绕过限制。

macOS 上 curl 获取 OAuth 元数据返回 200，发现地址、DCR、PKCE S256 和 scope 与配置一致。相同地址对 Python urllib 默认客户端返回 Cloudflare 1010；macOS 部分网页请求也曾超时。当前开发机网页请求成功不能证明所有审核客户端都能访问，正式审核前仍需验证 Portal 的实际连接和扫描。

## 构建和本地验证

在本仓库根目录执行：

```bash
npm ci
npm test
npm run submission -- --allow-incomplete
```

输出在 `dist/`：插件 ZIP、`.zip.sha256` 校验文件和 `.report.json`。报告中的 `missing_materials` 列出尚未填入 ZIP 的材料。补齐材料后，去掉 `--allow-incomplete` 再构建；缺项时命令会失败。`submission_ready` 保持为 `false`，因为本地脚本无法替代身份验证、演示回放、网页版实测、Portal 扫描和最终声明。

服务端验收记录位于同级项目：

- `remote-device-server/releases/evidence/plugin-public-1.2.0-server-tests.txt`
- `remote-device-server/releases/evidence/plugin-public-1.2.0-contract-tests.txt`

这些测试运行在本地隔离的 OAuth → HTTP MCP → Hub → Agent 链路；它们不等于 ChatGPT 网页验收，也不是审核录像。

## 演示环境与录像

为审核建立专用账号和隔离的低权限 Linux Agent，不使用真实用户数据。采用已有 Agent 安装和配对流程，给账号提供以下设备：

- `review-linux`：在线，命名根目录为 `workspace`，启用文件写入和 Shell。`README.txt` 内容为 `review-ready` 加换行；`review-example.txt` 不存在。
- `review-readonly`：在线，`allow_write=false`，仅有合成文件。用来验证助手不会改用 Shell 绕过文件写入限制。
- `review-offline`：已绑定但离线，用来验证不能伪造执行结果或改用其他设备。

不要让审核者自行注册、安装或配置设备。账号凭据只放在 Portal 的审核访问字段，不写进 ZIP、文档或公开介绍。记录登录地址、必要步骤和实际可用的权限，确保从公网可以登录并完成用例。

在可运行的 ChatGPT 网页开发连接中按 `plugin.json` 的五项正向用例演示：列设备、读示例文件、创建并修改示例文件、执行固定输出命令、检查并终止自己创建的测试进程。随后演示三个负向用例；应看到实际权限或可用性限制，且没有产生未授权副作用。重录前只重置这套隔离测试数据。

录制前先演练，排除登录失败或工具不可用。可以使用 Computer 插件协助操作可见页面；屏幕操作能力不等于视频录制能力，先确认录屏工具。也可以由维护者启动系统录屏，再按上述提示完成演示。画面需要能读清请求、真实工具结果和版本信息，避免录入凭据及无关页面。

保存后完整回放，检查各流程、音画与敏感信息；托管到审核者可直接观看的地址，再将真实链接填入 `extensions.com.openai.review.demo_recording_url`。脚本、截图和本地测试日志不能代替录像。当前八个审核用例均为 **Not run in ChatGPT**。

## 仍需完成

1. 用户提供实际采用的个人或企业名称，并在 Platform 完成身份验证；将名称写入 `author.name` 和 `interface.developerName`，同步政策页面运营者信息。
2. 部署经过验证的服务端补丁；恢复可运行的开发连接，用隔离账号完成上述网页版用例。
3. 录制并验证演示视频，补入真实地址，重新构建 ZIP。
4. 准备专用审核登录方案，并核实免费额度与已有订阅权益两种状态。
5. 在明确上传时，选择正确组织和项目，上传 ZIP，完成域名验证、OAuth、工具扫描及材料检查；由发布者完成实际声明。

公开提交的 ZIP 不携带旧 `apps` / `.app.json` 绑定。Portal 在 MCP 转换后生成的正式绑定应保留。上传草稿、提交审核、审核通过和发布是不同状态，只有实际完成的状态才能记录为完成。

此项目的远程 Shell 和用户设备文件访问可能涉及产品专项审核，需要向 OpenAI 说明授权范围及隔离方式。现有 OAuth 仅声明 `devices:control`，未提供用于企业域名限制的 OIDC UserInfo 能力；不要把普通 OAuth 成功描述为已支持该企业策略。

## 官方依据

- [提交与发布流程](https://developers.openai.com/plugins/deploy/submission)
- [包结构与 MCP 认证声明](https://developers.openai.com/plugins/build/plugins)
- [收费与订阅规则](https://developers.openai.com/plugins/plugin-guidelines#commerce-and-monetization)
- [OAuth 与企业域名限制](https://developers.openai.com/plugins/build/auth#support-workspace-domain-restrictions)
- [本地执行与文件访问的专项审核说明](https://developers.openai.com/plugins/guides/submit-claude-plugin#complete-the-submission-requirements)
