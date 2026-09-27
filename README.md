# 替代燃料船舶数据库

面向航运研究与公开行业观察的静态交互式数据库，按投用、订单、燃料和船型展示全球替代燃料船舶规模及结构。

## 当前数据版本

统计日期：2026年8月31日。

数据来源：Clarksons Research WFR数据库，上海国际航运研究中心整理。

- 替代燃料投用：3,178艘、18,613.71万GT
- 替代燃料订单：2,181艘、17,276.74万GT
- 多种替代燃料组合：投用16艘、订单24艘
- Fuel Ready：投用1,566艘、11,511万GT；订单1,350艘、8,551.15万GT
- 电池动力：投用953艘；订单567艘

## 页面内容

- 2024年1月至2026年8月替代燃料、LNG和甲醇总吨占比趋势
- LNG、甲醇、电池动力和其他燃料专题
- 投用与订单的燃料、船型双重筛选
- 船型规模排名和船型×燃料交叉矩阵
- 组合燃料路径、Fuel Ready汇总与电池纯电/混合动力拆分
- 当前查询结果CSV导出和URL状态保留

页面不展示“订单/投用比例”。投用与订单是两个不同市场状态，数据库分别给出其规模、趋势和结构。

## 文件结构

- `index.html`：页面语义结构
- `styles.css`：布局、响应式和视觉系统
- `app.js`：专题、图表、筛选、矩阵和导出
- `data/latest.json`：当前月份数据及页面所需月度趋势
- `data/history.json`：连续月度趋势指标
- `data/archive/`：月度快照归档
- `METHODOLOGY.md`：统计口径和公开边界
- `DESIGN_SPEC.md`：页面设计与交互基线
- `scripts/validate-data.mjs`：数据结构、总量和最新趋势校验

## 月度更新

1. 按相同口径处理新的WFR工作簿和月报连续序列。
2. 生成新月JSON并保存到`data/archive/YYYY-MM-DD.json`。
3. 用同一快照覆盖`data/latest.json`。
4. 将经复核的月度指标追加到`data/history.json`。
5. 运行`node scripts/validate-data.mjs data/latest.json data/history.json`。
6. 在本地HTTP预览中检查专题、筛选、趋势、矩阵和导出。
7. 提交到`main`，由GitHub Pages自动发布。

历史月份保持只读。发生口径调整时，应提升`schemaVersion`并在`METHODOLOGY.md`中记录。

## 本地预览

项目无构建步骤和第三方前端依赖。页面通过同源请求读取JSON，需使用HTTP服务预览：

```bash
python3 -m http.server 4173
```

访问`http://127.0.0.1:4173/`。
