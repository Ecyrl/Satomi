# Satomi Ads CRM

信息流广告投放 CRM + 第一方行为监测 MVP。

## 当前能力

- 自动生成匿名 `visitor_id`
- 读取腾讯广告监测链接中的常见 query 参数并保存归因信息
- 页面访问、离开、滚动深度、停留时间
- 微信按钮点击、电话按钮点击、在线咨询、下载等主动事件
- 表单开始、提交，以及用户主动填写手机号/微信号/预算/需求后的行为评分
- CRM 客户列表、筛选、客户行为时间轴
- 高意向 / 潜在 / 低意向分层
- 按 click_id / adgroup_id 等参数做基础来源归因
- JSON 导出
- 独立检测测试页

## 本版本的重要边界

浏览器网页不能合法/可靠地直接读取用户其他 App 的私人数据。因此：

- 可以记录用户在网页上主动点击“添加微信”“拨打电话”的行为。
- 可以记录用户主动提交到网页表单中的手机号、微信号、需求等内容。
- 不能从网页偷偷读取用户真实微信号、通讯录、微信聊天内容。
- “拨打电话”在纯网页 MVP 中表示用户点击了拨号入口；真实接通/通话时长需要电话平台或呼叫中心接口。
- 当前数据使用 LocalStorage，仅适合演示和单浏览器测试，不适合生产环境存储真实客户资料。

## 推荐监测链接

```text
https://你的域名/?click_id=__CLICK_ID__&click_time=__CLICK_TIME__&impression_id=__IMPRESSION_ID__&account_id=__ACCOUNT_ID__&campaign_id=__CAMPAIGN_ID__&adgroup_id=__ADGROUP_ID__&ad_id=__AD_ID__&dynamic_creative_id=__DYNAMIC_CREATIVE_ID__&site_set_name=__SITE_SET_NAME__&page_url=__PAGE_URL__
```

腾讯广告实际可用宏请以你的 DataNexus/广告后台当前文档为准，不要把不存在的宏直接投入正式广告。

## 本地测试

直接用静态服务器打开 `index.html`。也可以把仓库开启 GitHub Pages，然后访问：

- `/`：CRM
- `/index.html?click_id=demo123&adgroup_id=10001&ad_id=20002`：带广告参数的检测页

在“检测测试页”点击微信、电话、咨询、下载，并提交一条表单，然后回到“数据总览 / 客户线索 / 行为事件”查看结果。

## 下一阶段：生产版

建议继续增加：

1. Node.js/Cloudflare Worker API
2. PostgreSQL / Supabase 数据库
3. 服务端事件接收
4. 腾讯广告转化回传 callback
5. 登录与 RBAC 权限
6. 手机号脱敏与加密存储
7. 客户跟进状态、销售负责人、备注、成交金额
8. 企业微信/电话系统的官方接口接入
9. 广告计划/广告组/素材维度的 ROI 看板
10. 高意向规则可视化配置
