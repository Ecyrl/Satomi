# Satomi Ads CRM

信息流广告第一方行为监测 + 线索 CRM V2。

## 当前能力

- URL 广告归因参数采集：click_id、account_id、campaign_id、adgroup_id、ad_id、creative_id、dynamic_creative_id、site_set_name 等
- visitor_id 会话识别
- 页面访问、滚动深度、停留时长、微信按钮、电话按钮、咨询、下载、表单开始/提交等事件
- 用户主动提交的姓名、手机号、微信号、预算、需求
- 自动意向评分与高/中/低意向分级
- Node.js + Express API
- SQLite 持久化数据库
- CRM 客户列表、客户行为时间轴、事件查询、来源概览
- `/api/conversions/callback` 通用转化回调入口
- `/health` 健康检查接口

## 本地运行

需要 Node.js 20+。

```bash
npm install
npm start
```

打开 `http://localhost:3000`。

测试归因参数：

`http://localhost:3000/?click_id=demo123&campaign_id=camp01&adgroup_id=group01&ad_id=ad01`

## 生产部署

GitHub Pages 只能部署静态页面，不能运行 `server.js` 和 SQLite。正式版请部署到支持 Node.js 和持久化磁盘/数据库的服务环境。

## 数据边界

本项目只采集浏览器主动产生的行为、广告 URL 参数和用户主动提交的表单信息。它不会读取微信 App 私有数据、通讯录、聊天内容，也不会凭空获取真实通话内容。电话按钮只能证明用户点击了拨号动作；如需接通状态/通话时长，需要正规的呼叫中心/电话 API。

## 腾讯广告回传

腾讯广告具体生产回传字段、签名/鉴权和回调 URL 必须以你实际账户当前的 DataNexus/广告转化接口文档为准。当前项目提供通用 `/api/conversions/callback` 数据入口，不在没有确认字段契约的情况下伪造腾讯 API。

## 下一阶段

1. PostgreSQL/Supabase 正式数据库
2. 管理员登录与 RBAC
3. 按实际腾讯账户文档接入生产转化回传
4. 企业微信/客服系统正规 API 接入
5. 电话系统接通状态与通话时长接入
6. 广告计划 → 广告组 → 素材 → 线索 → 成交 → ROI 全链路报表
7. 手机号脱敏、加密、保留周期和删除机制
