# Remote Device Integrations

本仓库维护 Remote Device Hub 的可选集成层：canonical standalone MCP plugin、可选的
connected ChatGPT adapter、品牌资源和公开提交资料。Hub 服务端和设备 Agent 位于独立仓库。

ChatGPT 网页当前只安装既有的 OAuth App，暂不加载 Skill。额外私人包已卸载，并在云端
1.2.3 中移除 Skill；Personal 目录的历史未安装记录仍保留，详情见
[网页集成说明](docs/chatgpt.md)。公开发布保持暂停。

可选集成源码保留在 `1.2.2`，包含原 Skill，供后续恢复或其他客户端使用；它不是当前网页
入口。默认构建为 standalone，不需要 App ID；connected profile 才读取
[`integrations/chatgpt/connected-app.json`](integrations/chatgpt/connected-app.json)。
这些配置不是服务端或 Agent 的运行时依赖，构建成功也不能代替网页验收。

- `plugins/remote-device-hub/`：插件清单、MCP endpoint、权限与操作确认 Skill 和主题资源。
- `integrations/chatgpt/`：App 与 channel 元数据。
- `assets/branding/`：品牌源文件和验证资料。
- `docs/chatgpt.md`：客户端连接和验证边界。
- `docs/publication/`：listing、数据处理和审核测试资料。

开发工具需要 Node.js 22 或更新版本。TypeScript 编译到 `.build/tooling/`，插件 ZIP 仍只包含清单、Skill 和资源文件。

```bash
npm ci
npm run build
npm run release -- build plugin --profile standalone
```

本地构建只产生可审计 ZIP 和 prepared 记录，不上传插件、不改变 daily entry、不部署 MCP
服务，也不发布 registry。公开发布当前暂停。服务器 URL 和 OAuth 契约由
`remote-device-server` 维护；必须以真实客户端工具调用证据说明集成已验证。

## 代码风格

`npm run format` 格式化开发脚本和测试；`npm run style:check` 检查格式及 Lint，
`npm run lint` 只运行 Lint。Biome 以固定版本作为开发依赖。统一使用两空格、
单引号、分号、尾逗号，一行一条语句；显式标记类型导入，禁止显式 `any` 和
`@ts-ignore`。插件清单、资源、历史发布记录与固定样本不参与格式化。

清单和发布记录在读取时解析为业务类型，保留原有字段及序列化顺序。ZIP 构建沿用
既有格式，并通过旧 Python 工具生成的固定样本核对文件哈希和归档字节。
