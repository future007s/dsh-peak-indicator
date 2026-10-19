# dsh-peak-indicator

DeepSeek API 高峰/闲时（峰谷）计价标记插件 for DeepSeek Harness (DSH) Web。

## 首要功能：自动压缩长会话，减少后续上下文费用

**安装后默认开启。** 以当前 DeepSeek 模型 1,000,000 token 窗口为参考，默认将 DSH 内置
`compaction-basic` 的触发比例设为 0.1，并保留最近约 15,000 tokens。实际触发仍由宿主根据模型窗口、
输出预留与余量策略计算；换用不同窗口的模型应调整 `referenceWindow`。这样后续每一步不必反复重读整段旧对话。

默认一次可从约 100k 上下文中移除约 85k tokens，因此在不计摘要自身长度的理想比较下，
**后续每一步需要重读的历史上下文最多可减少约 85%**。这节省的是后续请求的上下文输入费用，
不是整次请求的总费用：输出 tokens、保留的最近上下文和新生成的摘要仍会计费。

自动压缩**不限 DeepSeek 模型**：只要当前 DSH profile 提供 `compaction-basic`，DeepSeek、OpenAI、
Claude、Gemini 等长会话都可受益。默认仅对 DeepSeek 内置美元价或 `config.prices` 中显式提供的美元价
记录估算节省；未知价格的模型仍可压缩，但不估算金额。

建议从平衡档开始：

- 保守：150,000 tokens（更少摘要，节省较少）
- 平衡：100,000 tokens（默认、推荐）
- 节省：60,000 tokens（更早压缩，旧内容更依赖摘要）

在 DSH 设置中打开 **插件 → 成本与上下文**，即可实时调整开关、触发预算、保留 tokens 和参考窗口，
无需编辑 YAML 或重启。压缩会用摘要代替早期原文，涉及精确历史细节的任务应提高预算或保留更多 tokens。

在会话头部显示一个标记，标明当前处于 **高峰时段** 还是 **闲时**，并附带**当前会话已计价 token 费用估算**
（保留两位小数）。**鼠标悬停**可查看当前模型在当前时段的 token 单价明细（输入/输出/缓存命中）：

- ⚡ **高峰 · 已计价 token $0.12**（红色徽标）：周一至周五北京时间 09:00–12:00、14:00–18:00，中国法定节假日除外
- 🌙 **闲时 · 已计价 token $0.12**（绿色徽标）：其余时段，周末与中国法定节假日全天均按闲时价
- 徽标内常驻显示距离下一次峰谷切换的倒计时；悬停可查看当前官方美元单价（每百万 tokens）和当前北京时间

**每轮聊天末尾**还会显示本轮已知单价的 token 消耗金额估算（如 `本轮 $0.08`，常显在消息统计行）。

价格表（`MODEL_PRICES`，来自 DeepSeek 官方价格页，单位 USD/百万 tokens）：

| 模型 | 高峰 输入/输出/缓存命中 | 闲时 输入/输出/缓存命中 |
| --- | --- | --- |
| deepseek-flash（V4.1-Flash-1017） | 0.30 / 1.20 / 0.006 | 0.15 / 0.60 / 0.003 |
| deepseek-v4-pro（V4-Pro-0813） | 1.32 / 3.96 / 0.044 | 0.66 / 1.98 / 0.022 |

会话与本轮费用由宿主侧 `peakCost` 会话投影计算：重放会话日志中的真实 token 用量，按每个事件
自身时间戳所处的时段（高峰/闲时）计价，缓存命中 token 按缓存价计算。

DeepSeek 的当前 API ID、完整版本名与兼容 Flash 别名会显示峰谷徽标；其它模型显示中性标记，
未知单价不会计入美元估算。
徽标会常驻显示距离下次切换的倒计时，并每 30 秒自动刷新；悬停可看到当前北京时间和完整价格明细（含缓存命中价）。
价格表按插件版本固定，插件不会在每次请求时联网抓取价格：这样历史会话可以按当时版本和事件时间稳定重放，
官方调价后发布新插件版本更新即可；自定义模型仍可通过 `config.prices`（美元/百万 tokens）设置。当前数据来自
[DeepSeek 官方模型与价格页](https://api-docs.deepseek.com/quick_start/pricing/)，宿主端和浏览器端由同一计价源构建。

时段规则依据 DeepSeek 官方价格页：高峰为北京时间周一至周五 09:00–12:00、14:00–18:00，
中国法定节假日除外；周末与节假日全天闲时。内置 2026 年国务院公布的放假日期（含公告调休休息日），周末补班仍按闲时；后续年份应更新日历或配置 `holidayDates`。V4.1-Flash 新价格自北京时间 2026-09-10 12:00 起生效，
旧模型名 `deepseek-v4-flash` 和 `deepseek-v4-flash-vision-exp` 均由 V4.1-Flash-1017 提供服务，按 Flash 价格计费。

## 官网同步（2026-10-19 核对）

- API ID `deepseek-flash` 对应 **DeepSeek-V4.1-Flash-1017**；`deepseek-v4-pro` 对应 **DeepSeek-V4-Pro-0813**。10 月 17 日 Flash 更新不改变单价，旧 Flash API ID 仍按官方别名处理。支持在历史记录中识别完整版本名。
- 上表为美元/百万 tokens；人民币参考价如下，直接取自中文官网，不按汇率换算。会话总额和 `config.prices` 均以 **USD** 计价，人民币只作单价参考。

| 模型 | 高峰 输入/输出/缓存命中（元/百万 tokens） | 闲时 输入/输出/缓存命中 |
| --- | --- | --- |
| DeepSeek-V4.1-Flash-1017 | 2 / 8 / 0.04 | 1 / 4 / 0.02 |
| DeepSeek-V4-Pro-0813 | 9 / 27 / 0.30 | 4.5 / 13.5 / 0.15 |

- Search/Fetch 每次成功且有结果的请求分别为 **$0.00075 / ¥0.005**。DSH 服务端调用在北京时间 **2026-11-01 00:00** 起收费；插件的 token 估算不包含这些按次费用，也不猜测 HTTP 成功或返回结果。
- 已移除原来将非 DeepSeek 模型的粗略人民币价混入美元总额的默认表。其它模型只有显式配置 `prices`（美元）才计入；未知用量不会伪装成已知账单。界面注明“已计价 token”，不等同于服务商账单。
- `lib/pricing.js` 是宿主和浏览器的共同计价来源；修改后运行 `npm run build`。测试会拒绝未同步的浏览器副本。历史会话仍按事件时间选择旧价格，缓存版本升至 6 以重新计算节假日与模型别名。

来源：[英文价格页](https://api-docs.deepseek.com/quick_start/pricing/)、[中文价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)、[官方更新日志](https://api-docs.deepseek.com/zh-cn/updates/)、[Search/Fetch 计费说明](https://api-docs.deepseek.com/zh-cn/guides/search/)、[2026 年放假通知](https://www.gov.cn/zhengce/content/202511/content_7047090.htm)。

## 安装（0.1.28）

此版本专门适配 **DSH `0.2.1-rc.2`**，使用新版配置表单、volatile 实时配置和预设内压缩服务。
旧版 DSH 请继续使用相应的旧插件版本；新宿主版本需要重新验证，不自动声明兼容。

从 npm 安装：

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
- `npm test`：30 项，包括官方兼容门禁、真实会话投影服务、Zod 4 非空记录与持久化校验、峰谷规则和压缩策略恢复。
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
- 修复 Zod 4 的 `record(keySchema, valueSchema)` 写法；投影初始状态使用 JSON 可持久化的 `null`，缓存版本升至 6。
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
          referenceWindow: 1000000
```
