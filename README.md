# dsh-peak-indicator

DeepSeek API 高峰/闲时（峰谷）计价标记插件 for DeepSeek Harness (DSH) Web。

在会话头部显示一个标记，标明当前处于 **高峰时段** 还是 **闲时**，并直接显示当前模型在当前时段的
token 单价（每百万 tokens，输入/输出）：

- ⚡ **高峰 ¥3/¥9**（红色徽标）：北京时间 09:00–12:00、14:00–18:00，按高峰价计费
- 🌙 **闲时 ¥1.5/¥4.5**（绿色徽标）：高峰以外时段，价格为高峰的一半

价格表（`MODEL_PRICES`，来自 DeepSeek 官方 2026-08-17 生效的价格表，单位 CNY/百万 tokens）：

| 模型 | 高峰 输入/输出 | 闲时 输入/输出 |
| --- | --- | --- |
| deepseek-v4-flash | 3.0 / 9.0 | 1.5 / 4.5 |
| deepseek-v4-pro | 9.0 / 27.0 | 4.5 / 13.5 |

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
