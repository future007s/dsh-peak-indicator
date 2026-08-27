# dsh-peak-indicator

DeepSeek API 高峰/闲时（峰谷）计价标记插件 for DeepSeek Harness (DSH) Web。

## 首要功能：自动压缩长会话，减少后续上下文费用

**安装后默认开启。** 当会话上下文达到 100,000 tokens 时，插件会配置 DSH 内置
`compaction-basic`，将较早的对话折叠为摘要、保留最近约 15,000 tokens；不需要额外启动参数、
patch 或命令。这样后续每一步不必反复重读整段旧对话。

默认一次可从约 100k 上下文中移除约 85k tokens，因此在不计摘要自身长度的理想比较下，
**后续每一步需要重读的历史上下文最多可减少约 85%**。这节省的是后续请求的上下文输入费用，
不是整次请求的总费用：输出 tokens、保留的最近上下文和新生成的摘要仍会计费。

自动压缩**不限 DeepSeek 模型**：只要当前 DSH profile 提供 `compaction-basic`，DeepSeek、OpenAI、
Claude、Gemini 等长会话都可受益。插件会对内置价格表已知的模型或 `config.prices` 中自定义的模型
记录每一步的估算节省；未知模型仍会被压缩，但金额估算不可靠。

建议从平衡档开始：

- 保守：150,000 tokens（更少摘要，节省较少）
- 平衡：100,000 tokens（默认、推荐）
- 节省：60,000 tokens（更早压缩，旧内容更依赖摘要）

在 DSH 设置中打开 **插件 → 成本与上下文**，即可实时调整开关、触发预算、保留 tokens 和参考窗口，
无需编辑 YAML 或重启。压缩会用摘要代替早期原文，涉及精确历史细节的任务应提高预算或保留更多 tokens。

在会话头部显示一个标记，标明当前处于 **高峰时段** 还是 **闲时**，并附带**当前会话实际消耗费用**
（保留两位小数）。**鼠标悬停**可查看当前模型在当前时段的 token 单价明细（输入/输出/缓存命中）：

- ⚡ **高峰 · 本会话$0.12**（红色徽标）：仅周一至周五北京时间 09:00–12:00、14:00–18:00
- 🌙 **闲时 · 本会话$0.12**（绿色徽标）：其余时段，周六、周日全天均按闲时价
- 徽标内常驻显示距离下一次峰谷切换的倒计时；悬停可查看当前官方美元单价（每百万 tokens）和当前北京时间

**每轮聊天末尾**还会显示本轮实际 token 消耗金额（如 `本轮 $0.08`，常显在消息统计行）。

价格表（`MODEL_PRICES`，来自 DeepSeek 官方价格页，单位 USD/百万 tokens）：

| 模型 | 高峰 输入/输出/缓存命中 | 闲时 输入/输出/缓存命中 |
| --- | --- | --- |
| deepseek-v4-flash | 0.44 / 1.32 / 0.014 | 0.22 / 0.66 / 0.007 |
| deepseek-v4-pro | 1.32 / 3.96 / 0.044 | 0.66 / 1.98 / 0.022 |

会话与本轮费用由宿主侧 `peakCost` 会话投影计算：重放会话日志中的真实 token 用量，按每个事件
自身时间戳所处的时段（高峰/闲时）计价，缓存命中 token 按缓存价计算。

徽标**仅在当前会话使用 DeepSeek flash/pro 模型时显示**（provider 为 DeepSeek 且模型名含
flash 或 pro，如 `deepseek-v4-flash`、`deepseek-v4-pro`）；使用其他模型时自动隐藏。
徽标会常驻显示距离下次切换的倒计时，并每 30 秒自动刷新；悬停可看到当前北京时间和完整价格明细（含缓存命中价）。
DeepSeek 调价后请更新 `lib/client.js` 中的 `MODEL_PRICES`。

时段规则依据 DeepSeek 官方峰谷定价公告（北京时间 2026-08-17 00:00 生效）：空闲时段价格为高峰时段的一半。

## 安装

插件包放入 `~/.dsh/profiles/web/node_modules/dsh-peak-indicator/`（以及 dsh 安装目录的
`node_modules/`），并在 `~/.dsh/profiles/web/cordis.patch.yml` 增加：

```yaml
- insert:
    - id: peak-indicator
      name: 'dsh-peak-indicator'
```

刷新浏览器（Ctrl+Shift+R）后，会话头部即可看到徽标。

## 兼容性与一次性 Profile 验证

- Node.js：`>=22.13.0`
- DSH：`>=0.1.0-rc.7`；已验证兼容 `rc.7`、`rc.8`、`0.1.1-rc.1` 和 `0.1.1-rc.2`。
- Profile：`web`

在隔离的临时 Profile 中，依次执行安装、启动和卸载即可复核插件生命周期。启动时可使用 `--port 0`
让 DSH 自动选择空闲端口，避免占用日常 Web Profile 的端口；不要在验证期间停止或修改正在使用的 Profile。

```sh
dsh plugin --profile <temporary-profile> add dsh-peak-indicator@<version>
dsh --profile <temporary-profile> --dump-config
dsh --profile <temporary-profile> --port 0
dsh plugin --profile <temporary-profile> remove dsh-peak-indicator
```

已在 macOS、Node.js `v24.10.0`、DSH `0.1.1-rc.2` 的 Web Profile 完成配置加载，并以随机端口和默认端口启动验证。实际操作记录应保留 DSH 版本、Node.js 版本、系统、Profile 名称和每一步结果；
未执行的运行验收不应标注为“通过”。

## 配置（host 侧，可选）

默认无需任何配置。如需调整时段（政策变更时），可在 patch 条目中传：

```yaml
    - id: peak-indicator
      name: 'dsh-peak-indicator'
      config:
        peakWindows: [[9, 12], [14, 18]]
        beijingOffsetMinutes: 480
        offPeakDiscount: 0.5
        policyEffectiveDate: '2026-08-17T00:00:00+08:00'
        weekendOffPeakEffectiveDate: '2026-08-23T00:00:00+08:00'
```

注意：浏览器端的徽标计算使用与官方价格页一致的内置时段（工作日北京 09:00–12:00、14:00–18:00；周末全天闲时），
host 配置主要用于程序化调用 `ctx.peakIndicator.current()`。

## 自动压缩的 YAML 配置（可选）

默认无需配置；如需在 profile 中固定参数，可在 patch 条目中传入：

```yaml
- insert:
    - id: peak-indicator
      name: 'dsh-peak-indicator'
      config:
        autoCompact:
          enabled: true          # 默认开启；填 false 可关闭
          contextBudget: 100000  # 上下文超过该 token 数即压缩
          retainTokens: 15000    # 压缩后保留最近 tokens
          referenceWindow: 256000
```
