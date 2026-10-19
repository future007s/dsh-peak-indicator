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
| deepseek-flash（V4.1-Flash） | 0.30 / 1.20 / 0.006 | 0.15 / 0.60 / 0.003 |
| deepseek-v4-pro | 1.32 / 3.96 / 0.044 | 0.66 / 1.98 / 0.022 |

会话与本轮费用由宿主侧 `peakCost` 会话投影计算：重放会话日志中的真实 token 用量，按每个事件
自身时间戳所处的时段（高峰/闲时）计价，缓存命中 token 按缓存价计算。

徽标**仅在当前会话使用 DeepSeek flash/pro 模型时显示**（provider 为 DeepSeek 且模型名含
flash 或 pro，如 `deepseek-flash`、`deepseek-v4-flash`、`deepseek-v4-pro`）；使用其他模型时自动隐藏。
徽标会常驻显示距离下次切换的倒计时，并每 30 秒自动刷新；悬停可看到当前北京时间和完整价格明细（含缓存命中价）。
价格表按插件版本固定，插件不会在每次请求时联网抓取价格：这样历史会话可以按当时版本和事件时间稳定重放，
官方调价后发布新插件版本更新即可；自定义模型仍可通过 `config.prices` 覆盖。当前数据来自
[DeepSeek 官方模型与价格页](https://api-docs.deepseek.com/quick_start/pricing/)，宿主端和浏览器端价格表需同步更新。

时段规则依据 DeepSeek 官方峰谷定价公告：峰值时段为工作日北京时间 09:00–12:00、14:00–18:00，
周末全天闲时；闲时价格为高峰时段的一半。V4.1-Flash 新价格自北京时间 2026-09-10 12:00 起生效，
旧模型名 `deepseek-v4-flash` 和 `deepseek-v4-flash-vision-exp` 均按 V4.1-Flash 价格计费。

## 安装（0.1.28）

此版本专门适配 **DSH `0.2.1-rc.2`**，使用新版配置表单、volatile 实时配置和预设内压缩服务。
旧版 DSH 请继续使用相应的旧插件版本；新宿主版本需要重新验证，不自动声明兼容。

从 npm 安装（仅在 0.1.28 已发布后可用）：

```sh
dsh plugin --profile web add dsh-peak-indicator@0.1.28
```

桌面版使用其实际 profile 名（通常为 `desktop`）。也可以在插件管理界面添加本地打包文件，
或用 CLI 安装 `file:/absolute/path/dsh-peak-indicator-0.1.28.tgz`。安装后重启对应 profile 并刷新页面。
不要复制插件到应用程序安装目录，也不需要忽略兼容检查。

配置入口：**插件 → dsh-peak-indicator → 成本与上下文**，常规设置页也提供同一组控件。
保存由宿主检查配置版本，加载中或只读时禁用控件，保存失败会显示提示。
关闭“自动压缩长会话”时，恢复受本插件调整的压缩后端原有配置；DSH 自身原有的自动压缩策略仍由 DSH 管理。
预算按 `contextBudget / referenceWindow` 映射到原生触发比例；实际触发取决于当前模型窗口和宿主余量策略。

## 兼容性与验证

- Node.js：`^22.19.0 || >=24.0.0`
- DSH：仅 `0.2.1-rc.2`，`engines.dsh` 和官方包 peers 均明确锁定。
- 使用 Web 前端的 `web` / `desktop` profile。
- `npm test`：24 项，包括官方兼容门禁、真实会话投影服务、Zod 4 非空记录与持久化校验、峰谷规则和压缩策略恢复。
- macOS / Node.js `v24.10.0` / 官方 npm DSH `0.2.1-rc.2`：隔离 Web profile 安装、启动和真实浏览器设置面板检查。
- 不以单元测试代替长会话实际调用验收；此轮没有发起收费的模型请求。

隔离验收请设置一个新的 `DSH_HOME`，避免更改日常 profile：

```sh
export DSH_HOME=/absolute/path/to/isolated-dsh-home
dsh --profile web --dump-config
dsh plugin --profile web add file:/absolute/path/dsh-peak-indicator-0.1.28.tgz
dsh --profile web --port 0 --no-open
dsh plugin --profile web remove dsh-peak-indicator
```

## 0.1.28 变更

- 替换已移除的 `settingsNamespace` / `settings.register` / `settingsScope` 接口。
- 使用 `plugins.bundle.config`、共享 `configForms` 和 `.volatile()` 配置。
- 移除旧的 `dsh-client-runtime` 和重复的 `dshClient` 元数据，声明实际使用的模块依赖。
- 修复 Zod 4 的 `record(keySchema, valueSchema)` 写法；投影初始状态使用 JSON 可持久化的 `null`，缓存版本升至 5。
- 保留各个预设的压缩服务隔离，保留其他参数；不启用宿主层禁用的压缩后端，关闭或卸载时恢复原配置。

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
        v41FlashEffectiveDate: '2026-09-10T12:00:00+08:00'
```

注意：浏览器端的徽标计算使用与官方价格页一致的内置时段（工作日北京 09:00–12:00、14:00–18:00；周末全天闲时），
host 配置用于会话费用投影和导出的计价辅助函数。

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
