# dsh-peak-indicator

DeepSeek API 高峰/闲时（峰谷）计价标记插件 for DeepSeek Harness (DSH) Web。

在会话头部显示一个标记，标明当前处于 **高峰时段** 还是 **闲时（半价）**：

- ⚡ **高峰**（红色徽标）：北京时间 09:00–12:00、14:00–18:00，API 按原价计费
- 🌙 **闲时 · 半价**（绿色徽标）：高峰以外时段，API 价格为高峰的一半

悬停徽标可看到当前北京时间、计费时段说明以及距离下次切换的倒计时；徽标每 30 秒自动刷新。

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
