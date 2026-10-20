# dsh-peak-indicator

DeepSeek Harness (DSH) Web / Desktop 的峰谷计价与账户余额插件。

- 会话头部显示高峰 / 闲时、距离下一次切换的倒计时，以及会话 Token 费用估算。
- 每轮消息末尾显示本轮 Token 费用，按日志中的实际用量和事件发生时间重算。
- 默认人民币计价，缓存命中输入使用独立缓存价；可显式选择美元或配置自定义模型价格。
- DSH 登录账户显示可用人民币余额（充值 + 赠金），每分钟刷新，也可点击刷新。
- 悬停说明精简为模型名、当前单价、估算范围三行。

## 0.1.30：专注费用与余额

移除旧版对官方压缩策略的修改：不再改触发比例、保留 Token 数或自动压缩开关，不再注册压缩设置面板。
删除基于上下文 Token 下降推断压缩事件、按未命中输入价推算“每步省钱”的统计与日志。
插件介绍聚焦峰谷计价与余额，不再把调节官方压缩阈值列作本插件的压缩能力。

DSH `0.2.1-rc.2` 的基础 bundle 自带 `compaction-basic` 自动压缩、`/compact` 手动压缩与工具结果剪裁。
官方自动压缩默认开启，默认 `thresholdRatio: 0.8`、`retainRatio: 0.16`；实际触发还受路由模型窗口、输出预留、
headroom 与用户策略影响。本插件完全交由 DSH 管理这些设置，也不再猜测触发点。

旧 patch 中的 `autoCompact` 字段可继续加载，但从 0.1.30 起不再生效。升级后重启对应 DSH profile，
旧版运行时覆写会随旧插件退出撤销；用户直接配置在官方压缩插件上的策略继续由 DSH 管理。

减少上下文 Token 不等于同比例减少费用。缓存命中、摘要输入 / 输出费用和后续请求都会影响净成本，
所以本插件不再估算“压缩回本步数”或“未来每步节省金额”。

官方实现参考：[基础 bundle](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/packages/bundle/base/cordis.patch.yml)、
[压缩策略解析](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/packages/compaction/compaction-basic/src/config.ts)。

## 峰谷时段与价格

北京时间周一至周五 09:00–12:00、14:00–18:00 为高峰，其余时段为闲时。
周末和中国法定节假日全天闲时；周末补班仍按闲时。内置 2026 年公告放假日期，后续年份需更新日历。
徽标倒计时每 30 秒更新。

当前人民币价格（元 / 百万 tokens，核对日期 **2026-10-20**）：

| 模型 | 高峰 输入 / 输出 / 缓存命中 | 闲时 输入 / 输出 / 缓存命中 |
| --- | --- | --- |
| deepseek-flash（DeepSeek-V4.1-Flash-1017） | 2 / 8 / 0.04 | 1 / 4 / 0.02 |
| deepseek-v4-pro（DeepSeek-V4-Pro-0813） | 9 / 27 / 0.30 | 4.5 / 13.5 / 0.15 |

旧 Flash API ID 按官方别名处理。其它模型显示中性标记，需要显式提供自定义单价才计入费用。

悬停示例（闲时）：

```text
DeepSeek-V4.1-Flash-1017
输入 ¥1 · 输出 ¥4 · 缓存 ¥0.02 / 百万 tokens
按已知 Token 估算，不含搜索/抓取费
```

## 费用估算的范围

宿主 `peakCost` 投影重放真实日志，分别累计未命中缓存输入、缓存命中输入与输出，并按每个事件的历史价格和峰谷时段计价。
流式用量与同一步最终消息不重复计数；每轮费用汇总该轮全部步骤。

这是已知 Token 用量的费用估算，最终扣款以 DeepSeek 账单为准。它不预测未来节省，也不从余额变化反推单轮费用。
Search / Fetch 等独立按次费用未计入：自北京时间 2026-11-01 00:00 起，官方 DSH 服务端调用每次成功且有结果的请求
收取 ¥0.005（美元价 $0.00075）；插件不猜测请求成功次数。

人民币不是将旧美元金额换符号或按汇率转换。两种币种使用独立价格与投影缓存校验。
历史人民币估算从 2026-08-17 的官方 V4 价格起算；Flash 从 2026-09-10 12:00 起使用新价。
更早的促销记录不完整，不猜算该时期的人民币费用，可用 `pricesCny` 显式补充。

价格按插件版本固定，宿主与浏览器由同一 `lib/pricing.js` 构建。

来源：[中文价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)、
[V4 历史人民币价格图](https://api-docs.deepseek.com/zh-cn/img/v4_260813_price_cn.png)、
[英文价格页](https://api-docs.deepseek.com/quick_start/pricing/)、
[官方更新日志](https://api-docs.deepseek.com/zh-cn/updates/)。

## 账户余额

选择 `deepseek-account`（DSH 登录账户）模型时，会话头部显示 **余额 ¥xx.xx**。
金额为充值钱包与赠送钱包之和，悬停用一行分别列出两项。每分钟自动刷新，点击可立即刷新。
通过 DSH 自带 Host 账户接口读取，不复制密钥到前端。

未登录、读取失败、没有人民币钱包分别显示对应状态，真实零余额才显示 `¥0.00`。
自填 API Key 和第三方模型不显示其它登录账户的余额；美元钱包不折算成人民币。

## 安装与升级

专门适配 DSH **`0.2.1-rc.2`**，支持使用 Web 前端的 `web` / `desktop` profile。
Node.js 要求 `^22.19.0 || >=24.0.0`。未验证的新宿主版本不自动声明兼容。

```sh
dsh plugin --profile web add dsh-peak-indicator@0.1.30
```

桌面版将 `web` 换为实际 profile 名（通常是 `desktop`），也可使用插件管理器升级。
安装后重启对应 DSH profile 并刷新页面。不要复制文件到应用程序安装目录，不需要忽略兼容检查。

## 可选价格配置

默认无需配置。`pricesCny` 的单位为 **人民币 / 百万 tokens**；原有 `prices` 始终表示美元。
如需美元计价，显式设置 `currency: USD`，默认 `CNY`。

```yaml
- insert:
    - id: peak-indicator
      name: dsh-peak-indicator
      config:
        currency: CNY
        pricesCny:
          my-model:
            input: 1
            output: 3
            cacheHitInput: 0.1
```

自定义未知模型不套用 DeepSeek 峰谷折扣。宿主的 `peakWindows`、`holidayDates` 等可选配置只影响费用投影；
浏览器徽标仍使用内置官方时段与价格。

## 开发验证

```sh
npm run build
npm test
npm pack
```

`build` 同步浏览器中的价格与余额模块，测试拒绝未同步副本。
40 项测试覆盖官方兼容门禁、真实会话投影、历史 / 当前人民币价格、币种隔离、余额精度与账户切换，
以及真实官方压缩引擎在安装、旧配置、重载和卸载过程中保持策略不变。
前端测试确认只注册费用展示槽位，不再注册压缩设置。

隔离验收可指定新的 `DSH_HOME`，通过官方 CLI 安装打包文件并启动 Web profile；不需要发起收费模型请求。
