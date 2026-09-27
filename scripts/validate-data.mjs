#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [snapshotArg = "data/latest.json", historyArg = "data/history.json"] = process.argv.slice(2);
const snapshotPath = path.resolve(snapshotArg);
const historyPath = path.resolve(historyArg);

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const snapshot = readJson(snapshotPath);
const history = readJson(historyPath);
const failures = [];

const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const near = (left, right, tolerance = 1e-9) => Math.abs(left - right) <= tolerance;
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);

check(snapshot.schemaVersion >= 4, "schemaVersion 必须不低于 4");
check(/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOf), "asOf 必须使用 YYYY-MM-DD");

const augustBaseline = snapshot.asOf === "2026-08-31";
const expected = {
  fleet: { count: 3178, gt: 186137078 },
  order: { count: 2181, gt: 172767377 },
};

for (const key of ["fleet", "order"]) {
  const market = snapshot.markets?.[key];
  check(Boolean(market), `${key} 市场数据缺失`);
  if (!market) continue;

  if (augustBaseline) {
    check(market.count === expected[key].count, `${key}.count 与 2026-08-31 基准不一致`);
    check(market.gt === expected[key].gt, `${key}.gt 与 2026-08-31 基准不一致`);
  }
  check(sum(market.ships, "count") === market.count, `${key} 船型船数不能回算至市场总量`);
  check(sum(market.ships, "gt") === market.gt, `${key} 船型总吨不能回算至市场总量`);

  for (const fuel of market.fuels) {
    check(fuel.singleCount + fuel.comboCount === fuel.count, `${key}/${fuel.label} 船数拆分不闭合`);
    check(fuel.singleGt + fuel.comboGt === fuel.gt, `${key}/${fuel.label} 总吨拆分不闭合`);
  }

  const combinations = market.combinations;
  check(sum(combinations.groups, "count") === combinations.count, `${key} 组合燃料船数不闭合`);
  check(sum(combinations.groups, "gt") === combinations.gt, `${key} 组合燃料总吨不闭合`);
}

for (const key of ["fleet", "order"]) {
  const battery = snapshot.battery[key];
  check(battery.pure + battery.hybrid === battery.count, `${key} 电池动力拆分不闭合`);
}

check(typeof snapshot.ready.detailAvailable === "boolean", "Ready detailAvailable 必须为布尔值");

if (augustBaseline) {
  check(snapshot.markets.fleet.combinations.count === 16, "Fleet 组合燃料应为 16 艘");
  check(snapshot.markets.fleet.combinations.gt === 1365478, "Fleet 组合燃料 GT 应为 1,365,478");
  check(snapshot.markets.order.combinations.count === 24, "Orderbook 组合燃料应为 24 艘");
  check(snapshot.markets.order.combinations.gt === 2891179, "Orderbook 组合燃料 GT 应为 2,891,179");
  check(snapshot.battery.fleet.count === 953, "Fleet 电池动力应为 953 艘");
  check(snapshot.battery.order.count === 567, "Orderbook 电池动力应为 567 艘");
  check(snapshot.ready.fleet.count === 1566 && snapshot.ready.fleet.gt === 115110000, "Fleet Ready 汇总不一致");
  check(snapshot.ready.order.count === 1350 && snapshot.ready.order.gt === 85511500, "Orderbook Ready 汇总不一致");
  check(snapshot.ready.detailAvailable === false, "2026-08-31 Ready 明细不可标记为可用");
  check(near(snapshot.globalShares.fleetGt, 0.104), "Fleet 全球 GT 份额不一致");
  check(near(snapshot.globalShares.orderGt, 0.412), "Orderbook 全球 GT 份额不一致");
}

const historyRows = Array.isArray(history) ? history : (history.series || history.snapshots);
check(Array.isArray(historyRows) && historyRows.length >= 1, "history.json 至少需要一个快照");
if (Array.isArray(historyRows)) {
  const latest = historyRows.find((row) => row.asOf === snapshot.asOf);
  check(Boolean(latest), "history.json 缺少 latest.json 对应日期");
  if (latest) {
    check((latest.fleetCount ?? latest.markets?.fleet?.count) === snapshot.markets.fleet.count, "历史快照 Fleet 船数不一致");
    check((latest.orderCount ?? latest.markets?.order?.count) === snapshot.markets.order.count, "历史快照 Orderbook 船数不一致");
  }
}

const forbiddenKeys = new Set(["vesselName", "shipName", "hullNo", "imo", "imoNumber"]);
const walk = (value, trail = "$") => {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) failures.push(`公开数据包含逐船识别字段：${trail}.${key}`);
    walk(child, `${trail}.${key}`);
  }
};
walk(snapshot);

if (failures.length) {
  console.error(`数据校验失败（${failures.length} 项）：`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`数据校验通过：${snapshot.asOf}`);
console.log(`Fleet ${snapshot.markets.fleet.count.toLocaleString("en-US")} 艘 / ${snapshot.markets.fleet.gt.toLocaleString("en-US")} GT`);
console.log(`Orderbook ${snapshot.markets.order.count.toLocaleString("en-US")} 艘 / ${snapshot.markets.order.gt.toLocaleString("en-US")} GT`);
