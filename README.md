# Remote Device Integrations

本仓库维护 Remote Device Hub 的可选集成层：canonical standalone MCP plugin、可选的
connected ChatGPT adapter、品牌资源和公开提交资料。Hub 服务端和设备 Agent 位于独立仓库。

当前集成版本线为 `1.2.0`。默认构建是 standalone，不需要 App ID；connected profile 才读取
[`integrations/chatgpt/connected-app.json`](integrations/chatgpt/connected-app.json) 中的既有
身份。ChatGPT 网页自测使用 connected profile，复用已授权 App；standalone 的原始 MCP 包不能据此声称已通过网页验收。该配置不是服务端或 Agent 的运行时依赖。

- `plugins/remote-device-hub/`：插件清单、MCP endpoint、权限与操作确认 Skill 和主题资源。
- `integrations/chatgpt/`：App 与 channel 元数据。
- `assets/branding/`：品牌源文件和验证资料。
- `docs/chatgpt.md`：客户端连接和验证边界。
- `docs/publication/`：listing、数据处理和审核测试资料。

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.lock
.venv/bin/python scripts/release.py build plugin --profile standalone
```

本地构建只产生可审计 ZIP 和 prepared 记录，不上传插件、不改变 daily entry、不部署 MCP
服务，也不发布 registry。公开发布当前暂停。服务器 URL 和 OAuth 契约由
`remote-device-server` 维护；必须以真实客户端工具调用证据说明集成已验证。
