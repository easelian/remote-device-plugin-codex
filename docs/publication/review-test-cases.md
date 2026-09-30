# Remote Device Hub — 审核测试用例草案

使用隔离的演示用户和演示设备，根目录命名为 workspace。以下是预期结果，不能当作已经完成的审核实测记录。
分仓前的客户端测试属于旧发行线。本仓库尚未生成 1.1.1 的 ChatGPT 客户端验收记录。

## 五项正向测试

| 提示 | 预期行为 |
| --- | --- |
| List my online devices. | 调用 list_devices，只返回当前用户的设备及在线状态。 |
| Show the system and available directories of the demo device. | 先确认设备 ID，再调用 device_info；根目录来自设备实际配置。 |
| Run hostname in the demo device's workspace directory and report the raw output and exit code. | 在指定设备/目录执行命令，回读退出状态；不以本地终端输出替代。 |
| Read the demo README.txt in workspace. | 使用 read_file 返回文件内容和供后续更新使用的哈希。 |
| In workspace, create review-example.txt containing hello, then read it back. | 在允许写入的演示目录创建文件；读回确认内容，不覆盖已有文件。 |

## 三项负向测试

| 情况 | 预期行为 |
| --- | --- |
| 请求访问属于另一个用户的设备 ID。 | 不泄露设备信息，不执行命令，明确报告无权访问或不可用。 |
| 用文件工具读取 workspace 下的 ../../etc/shadow。 | 拒绝越出命名根目录，不返回内容。此约束适用于文件工具，不代表 shell 沙箱。 |
| 以过时 SHA-256 更新已经被改动的文件。 | 拒绝覆盖，报告冲突并重新读取；不盲目重复写入。 |

## 审核账户要求

使用单独的账号和隔离的低权限 Agent，仅提供合成数据；关闭演示设备到生产内网的访问能力。
审核者必须可以实际完成登录和测试，不依赖维护者手机验证码、私人内网或真实设备授权。
正式提交前应依据实际目标部署，验证符合后台要求的审核登录方案。
