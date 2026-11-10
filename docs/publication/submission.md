# 公开投稿准备

公开 ZIP 从唯一源码 `plugins/remote-device-hub/` 生成。发布者为 Easelian，产品为 Remote Device Hub，类别为 Developer Tools。公司官网为 `https://easelian.com/`。插件包包含操作技能、MCP 与 OAuth 声明、产品图标和 Apache-2.0 许可。

本地开发安装、上传投稿草稿、提交审核和公开发布分别完成。上传草稿不会自动公开，构建 ZIP 也不会上传草稿。

## 检查材料

- 在目标组织中选择 Easelian 的已验证企业身份。
- 核对产品网站、支持、隐私和服务条款。四个地址维护在源码的 `extensions.com.openai.interface` 中，均使用公司官网。
- 核对英文与中文说明、首次使用提示、支持地区和账户权益说明。
- 本项目统一使用品牌库导出的透明灰蓝色 256 × 256 PNG；PNG 是本项目的选择，不是平台唯一支持的图像格式。
- 检查审核用例，完成对应版本的真实演示录像，并填写审核员可访问的 URL。
- 通过平台安全字段提交审核凭据，凭据不进入源码、ZIP 或聊天。

在仓库根目录执行：

```sh
npm run package:draft
npm run package
```

草稿命令生成 `dist/remote-device-hub-public-<版本>-draft.zip`、校验和及报告，并列出缺失材料。严格命令要求必填包内材料完整，生成不带 `-draft` 的 ZIP；已有同版本候选包内容不同会被拒绝。两者都会重新读取并校验 ZIP，且不会从本地开发副本取文件。

报告中的 `package_metadata_complete` 只表示包内字段齐全。平台扫描、域名验证、独立审核账户、法律声明和最终批准仍需分别完成，因此构建报告不会宣称 `submission_ready: true`。

## 审核账户与设备

使用只包含样例数据的独立账户。审核员必须能够独立登录，不能依赖开发者的邮箱验证码、手机或私人网络。Hub 服务所有者的恢复凭据不用于普通审核账户。

准备三个样例设备：在线可写且允许 shell 的 `Write-Read PC`、禁止写入的 `Read-only PC`、已登记但离线的 `Offline PC`。前两者配置命名根目录 `workspace`，其中 `README.txt` 的内容为 `review-ready` 加换行。写入用例开始前确保 `hello.txt` 不存在；每轮只清理用例创建的文件与作业。

## 用例与录像

唯一源码的 `plugin.json` 保存五个正向和三个负向审核用例。[审核用例说明](review-test-cases.md)解释测试准备和预期结果；这些预期不代表测试已经执行。

使用[本地安装流程](../chatgpt.md)验证同一版本后，录制实际操作：展示安装版本和连接状态，查询样例设备、读取文件、创建并按哈希修改测试文件、执行无害命令，并展示权限或离线限制。

录制时避开密码、令牌和无关私人内容。完成后播放检查画面清晰度、结果和访问权限，再填写 `extensions.com.openai.review.demo_recording_url`。截图、操作脚本和不可访问的本地文件不能替代审核录像链接。

## 上传、审核和发布

材料齐全后，在目标组织的投稿后台上传严格 ZIP，选择 Easelian 企业身份。核对保存的元数据和审核用例，再连接包中声明的远程 HTTPS MCP，完成域名验证、OAuth 和工具扫描。公开包不包含 `.app.json` 或个人 App 标识；保留平台在保存版本中生成的绑定信息，不要手工删除。

修复必需的检查问题，补充安全字段中的审核账户资料，由有权代表公司的用户确认法律声明并提交审核。审核通过后选择公开发布，再分别验证 ChatGPT 和 Codex 的目录安装与实际调用。

## OAuth 权限范围不匹配

如果平台提示 `OAuth completion failed: Internal service error`，先核对 Auth 审计中的实际错误。`invalid_scope` 可能由网站 OIDC 发现向 MCP 请求加入 `openid email` 引起。MCP 客户端仅使用 `devices:control`；`mcp.json` 应设置 `oidcEnabled: false` 和空的 `defaultScopes`，由 `baseScopes` 指定设备权限。

更新投稿草稿后，核对平台保存的认证设置和实际授权请求，再重新连接。若旧绑定仍携带原权限，检查平台保存的连接状态；以实际授权、工具发现和扫描结果确认恢复。
