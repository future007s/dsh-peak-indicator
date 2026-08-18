# dsh-peak-indicator

DeepSeek API 高峰/闲时（峰谷）计价标记插件 for DeepSeek Harness (DSH) Web。

在会话头部显示一个标记，标明当前处于 **高峰时段** 还是 **闲时**，并附带**当前会话实际消耗费用**
（保留两位小数）。**鼠标悬停**可查看当前模型在当前时段的 token 单价明细（输入/输出/缓存命中）：

- ⚡ **高峰 · 本会话¥0.12**（红色徽标）：北京时间 09:00–12:00、14:00–18:00，按高峰价计费
- 🌙 **闲时 · 本会话¥0.12**（绿色徽标）：高峰以外时段，价格为高峰的一半
- 悬停显示：`输入 ¥3 · 输出 ¥9 · 缓存命中 ¥0.1（每百万 tokens）` + 当前北京时间 + 切换倒计时

**每轮聊天末尾**还会显示本轮实际 token 消耗金额（如 `本轮 ¥0.08`，常显在消息统计行）。

价格表（`MODEL_PRICES`，来自 DeepSeek 官方 2026-08-17 生效的价格表，单位 CNY/百万 tokens）：

| 模型 | 高峰 输入/输出/缓存命中 | 闲时 输入/输出/缓存命中 |
| --- | --- | --- |
| deepseek-v4-flash | 3.0 / 9.0 / 0.1 | 1.5 / 4.5 / 0.05 |
| deepseek-v4-pro | 9.0 / 27.0 / 0.3 | 4.5 / 13.5 / 0.15 |

会话与本轮费用由宿主侧 `peakCost` 会话投影计算：重放会话日志中的真实 token 用量，按每个事件
自身时间戳所处的时段（高峰/闲时）计价，缓存命中 token 按缓存价计算。

徽标**仅在当前会话使用 DeepSeek flash/pro 模型时显示**（provider 为 DeepSeek 且模型名含
flash 或 pro，如 `deepseek-v4-flash`、`deepseek-v4-pro`）；使用其他模型时自动隐藏。
悬停徽标可看到当前北京时间、完整价格明细（含缓存命中价）以及距离下次切换的倒计时；
徽标每 30 秒自动刷新。DeepSeek 调价后请更新 `lib/client.js` 中的 `MODEL_PRICES`。

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
```

注意：浏览器端的徽标计算使用与官方公告一致的内置时段（北京 09:00–12:00、14:00–18:00），
host 配置主要用于程序化调用 `ctx.peakIndicator.current()`。

## 自动压缩成本守护（可选，v0.1.12+）

长会话每步都会把整个上下文重读（缓存读取费用随上下文线性增长，且隔夜后缓存失效
会按全价重读）。开启后会把 DSH 内置 `compaction-basic` 的压缩触发点从默认的"模型窗口 80%"调到预算值，
让旧轮次提前折叠成摘要，大幅降低后续每步成本，并在日志中记录每次压缩移除的
tokens 与估算节省金额。

```yaml
- insert:
    - id: peak-indicator
      name: 'dsh-peak-indicator'
      config:
        autoCompact:
          enabled: true          # 默认 false
          contextBudget: 100000  # 上下文超过该 token 数即压缩
          retainTokens: 15000    # 压缩后保留最近 tokens
          referenceWindow: 256000
```

当前 DSH 版本的 `compaction` 位于 agent preset 的隔离 realm，插件会通过 DSH loader
定位并配置内置 `compaction-basic`，因此不需要额外的启动参数或 patch 文件。
插件继续通过 `tokenMeter` 观察压缩前后的 token 差并记录估算节省；压缩引擎和摘要生成由
DSH 内置 `compaction-basic` 负责。

### 设置界面

插件会注册 `peak-indicator` 持久化设置 namespace。安装插件后，在 DSH 的通用设置页中
打开 **Peak indicator / 成本与上下文**，即可修改自动压缩开关、触发预算、保留 tokens
和参考窗口；修改实时写入用户设置并应用到当前压缩引擎，无需编辑 YAML 或重启命令。

建议初始使用：

- 保守：150,000 tokens
- 平衡：100,000 tokens（推荐）
- 节省：60,000 tokens

设置页应同时说明：上下文越早压缩，后续每步重读成本越低，但旧对话会更多依赖摘要。

注意：压缩会把旧轮次折叠成摘要，历史细节只保留摘要内容；默认关闭，按需开启。
