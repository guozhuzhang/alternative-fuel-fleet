# 替代燃料船舶数据中心

面向航运研究与公开行业观察的静态交互式数据仪表盘，展示全球替代燃料船舶Fleet、Orderbook、Fuel Ready及电池动力统计。

## 当前数据版本

统计日期：2026年8月31日。

数据来源：Clarksons Research WFR数据库，上海国际航运研究中心整理。

- 替代燃料投用：3,178艘、18,613.71万GT
- 替代燃料订单：2,181艘、17,276.74万GT
- 多种替代燃料组合：投用16艘、订单24艘
- Fuel Ready：投用1,566艘、11,511万GT；订单1,350艘、8,551.15万GT
- 电池动力：投用953艘；订单567艘

## 页面能力

- 投用与订单燃料规模比较
- 燃料占比变化哑铃图
- 船型投用与订单气泡散点图
- 船型×燃料热力矩阵及完整数据表
- 组合燃料路径、电池动力和Fuel Ready专题
- 艘数、万GT和占比切换
- 燃料、船型筛选和交叉联动
- 当前视图CSV导出
- URL保留市场、指标和筛选条件

## 文件结构

- `index.html`：页面语义结构
- `styles.css`：布局、响应式和视觉系统
- `app.js`：图表、筛选、联动和导出
- `data/latest.json`：当前月份数据
- `data/history.json`：月度历史指标
- `data/archive/`：月度快照归档
- `METHODOLOGY.md`：统计口径和数据边界
- `DESIGN_SPEC.md`：页面设计基线
- `scripts/validate-data.mjs`：数据结构和关键总量校验

## 月度更新

1. 按相同口径处理新的WFR工作簿。
2. 生成新的月度JSON，并保存在`data/archive/YYYY-MM-DD.json`。
3. 用新快照覆盖`data/latest.json`。
4. 将月度核心指标追加到`data/history.json`。
5. 运行`node scripts/validate-data.mjs data/latest.json`。
6. 在本地HTTP预览中检查筛选、图表、矩阵和导出。
7. 提交到`main`，由GitHub Pages自动发布。

历史月份保持只读。发生口径调整时，应提升`schemaVersion`并在`METHODOLOGY.md`中记录。

## 发布

本项目为静态GitHub Pages网站，无需构建命令或第三方前端依赖。不能直接使用`file://`打开，因为页面通过同源请求读取`data/latest.json`。

本地预览示例：

```bash
python3 -m http.server 4173
```

然后访问`http://127.0.0.1:4173/`。
