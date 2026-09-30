# Integrations 维护与发布

集成仓库当前维护版本为 `1.1.1`。它只包含插件、ChatGPT 适配元数据、品牌资源和公开
提交资料；Server、Protocol 和 Agent 不在本仓库构建。

## 本地构建

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.lock
.venv/bin/python scripts/release.py build plugin --profile standalone
.venv/bin/python scripts/release.py build plugin --profile connected
```

构建生成 `dist/` 和 `releases/` 下的 prepared artifact。standalone 是默认 canonical
profile，不绑定 App identity；connected 仅用于已有 App 的适配验证。两种 profile 都不会
上传、提交、部署或发布到公共渠道。

## 发布边界

公开 `.app` 提交和 public publication 当前暂停。不要把构建成功、历史 App 元数据或 ZIP
存在写成客户端已更新；实际上传、客户端选择和工具调用必须分别记录证据。MCP URL、OAuth
和服务运行状态由 `remote-device-server` 维护。
