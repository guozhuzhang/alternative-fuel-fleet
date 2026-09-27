(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const numberFormat = new Intl.NumberFormat("zh-CN");
  const percentFormat = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const state = { market: "both", metric: "count", fuel: "all", ship: "all", matrixMarket: "fleet", matrixMode: "absolute", topic: "lng" };
  const colors = { fleet: "#0f8f83", order: "#ed8742", total: "#0b3944", lng: "#245995", methanol: "#25a18e" };
  let data;

  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const formatDate = (value) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const formatWan = (value) => Number(Number(value || 0) / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  const formatPct = (value) => `${percentFormat.format(Number(value || 0) * 100)}%`;
  const formatMetric = (value) => state.metric === "gt" ? formatWan(value) : numberFormat.format(Math.round(value));
  const marketName = (key) => key === "fleet" ? "投用" : "订单";
  const selectedMarkets = () => state.market === "both" ? ["fleet", "order"] : [state.market];
  const metricKey = () => state.metric === "gt" ? "gt" : "count";
  const fuelObject = (market, fuelKey) => data.markets[market].fuels.find((fuel) => fuel.key === fuelKey) || { count: 0, gt: 0, singleCount: 0, comboCount: 0 };
  const fuelLabel = (fuelKey) => fuelObject("fleet", fuelKey).label || fuelKey;

  function renderHeader() {
    $("#snapshotDate").textContent = `数据快照 · ${data.asOf}`;
    $("#asOfChip").textContent = `截至${formatDate(data.asOf)}`;
    $("#sourceLine").textContent = `${data.source} · ${data.asOf}`;
    $("#sourceNote").textContent = `数据来源：${data.source}，${data.attribution}`;
    $("#dataBoundary").textContent = `统计日期：${data.asOf}。Fuel Ready当前仅提供汇总数据。`;
    $("#footerSource").textContent = `${data.source}，截至${data.asOf}，${data.attribution}`;
  }

  function marketCard(key) {
    const market = data.markets[key];
    const countShare = data.globalShares[`${key}Count`];
    const gtShare = data.globalShares[`${key}Gt`];
    return `<div class="market-head"><div><span>${key === "fleet" ? "IN SERVICE" : "ORDERBOOK"}</span><b>${key === "fleet" ? "已投用替代燃料船舶" : "替代燃料船舶订单"}</b></div><i class="market-tag">${key === "fleet" ? "Fleet" : "Order"}</i></div>
      <div class="market-numbers">
        <div class="market-number"><small>船舶数量</small><strong>${numberFormat.format(market.count)}艘</strong><span>占全球${key === "fleet" ? "船队" : "订单"}艘数 ${formatPct(countShare)}</span></div>
        <div class="market-number"><small>总吨（GT）</small><strong>${formatWan(market.gt)}万</strong><span>占全球${key === "fleet" ? "船队" : "订单"}总吨（GT） ${formatPct(gtShare)}</span></div>
      </div>
      <div class="market-shares"><span>平均单船 <b>${formatWan(market.averageGt)}万GT</b></span><span>数据口径 <b>${data.asOf}</b></span></div>`;
  }

  function renderOverview() {
    $("#fleetCard").innerHTML = marketCard("fleet");
    $("#orderCard").innerHTML = marketCard("order");
    $("#readySnapshot").innerHTML = `<span>FUEL READY · 单列统计</span><h3>未来燃料转换准备能力</h3><div class="ready-list">
      <div class="ready-item"><div><span>投用Ready</span><b>${numberFormat.format(data.ready.fleet.count)}艘</b></div><small>${formatWan(data.ready.fleet.gt)}万GT</small></div>
      <div class="ready-item"><div><span>订单Ready</span><b>${numberFormat.format(data.ready.order.count)}艘</b></div><small>${formatWan(data.ready.order.gt)}万GT</small></div>
    </div><p class="ready-warning">Ready不代表船舶已经使用替代燃料，也不与替代燃料船舶总量相加。</p>`;
    renderTrendChart("#fleetTrend", "fleet");
    renderTrendChart("#orderTrend", "order");
  }

  function trendPath(rows, key, x, y) {
    return rows.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");
  }

  function renderTrendChart(selector, marketKey, onlyFuel = null) {
    const node = $(selector);
    const rows = data.trends?.series || [];
    if (rows.length < 2) { node.innerHTML = '<div class="empty-state">连续月度数据不足</div>'; return; }
    const series = onlyFuel ? [{ key: `${onlyFuel}GtShare`, label: fuelLabel(onlyFuel), className: onlyFuel }] : [
      { key: "totalGtShare", label: "替代燃料", className: "total" },
      { key: "lngGtShare", label: "LNG", className: "lng" },
      { key: "methanolGtShare", label: "甲醇", className: "methanol" },
    ];
    const values = rows.flatMap((row) => series.map((item) => Number(row[marketKey][item.key] || 0)));
    const width = 760, height = 285, left = 44, right = 20, top = 17, bottom = 36;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const rawMax = Math.max(...values, 0.01);
    const step = rawMax > .25 ? .1 : rawMax > .1 ? .025 : rawMax > .03 ? .01 : .002;
    const max = Math.ceil(rawMax / step) * step;
    const x = (index) => left + index / (rows.length - 1) * plotWidth;
    const y = (value) => top + plotHeight - Number(value || 0) / max * plotHeight;
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
    for (let index = 0; index <= 4; index += 1) {
      const value = max * index / 4;
      const yy = y(value);
      svg += `<line class="grid-line" x1="${left}" x2="${width - right}" y1="${yy}" y2="${yy}"></line><text class="chart-tick" x="${left - 7}" y="${yy + 3}" text-anchor="end">${percentFormat.format(value * 100)}%</text>`;
    }
    rows.forEach((row, index) => {
      if (index % 6 === 0 || index === rows.length - 1) svg += `<text class="chart-tick" x="${x(index)}" y="${height - 10}" text-anchor="middle">${escapeHtml(row.period)}</text>`;
    });
    series.forEach((item) => {
      svg += `<path class="line-${item.className}" d="${trendPath(rows.map((row) => row[marketKey]), item.key, x, y)}"></path>`;
      rows.forEach((row, index) => {
        const value = row[marketKey][item.key];
        const radius = index === rows.length - 1 ? 4.2 : 2.2;
        svg += `<circle class="data-point ${item.className}" cx="${x(index)}" cy="${y(value)}" r="${radius}" data-tip="${escapeHtml(`${row.period}｜${marketName(marketKey)}${item.label}｜${formatPct(value)}`)}"></circle>`;
      });
    });
    svg += `</svg>`;
    node.innerHTML = svg;
  }

  function renderFuelComparisonTrend(selector, fuelKey) {
    const node = $(selector);
    const rows = data.trends?.series || [];
    if (rows.length < 2) { node.innerHTML = '<div class="empty-state">连续月度数据不足</div>'; return; }
    const field = `${fuelKey}GtShare`;
    const width = 760, height = 285, left = 44, right = 20, top = 17, bottom = 36;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const values = rows.flatMap((row) => [Number(row.fleet[field] || 0), Number(row.order[field] || 0)]);
    const rawMax = Math.max(...values, .01);
    const step = rawMax > .25 ? .1 : rawMax > .1 ? .025 : rawMax > .03 ? .01 : .002;
    const max = Math.ceil(rawMax / step) * step;
    const x = (index) => left + index / (rows.length - 1) * plotWidth;
    const y = (value) => top + plotHeight - Number(value || 0) / max * plotHeight;
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
    for (let index = 0; index <= 4; index += 1) {
      const value = max * index / 4;
      const yy = y(value);
      svg += `<line class="grid-line" x1="${left}" x2="${width - right}" y1="${yy}" y2="${yy}"></line><text class="chart-tick" x="${left - 7}" y="${yy + 3}" text-anchor="end">${percentFormat.format(value * 100)}%</text>`;
    }
    rows.forEach((row, index) => {
      if (index % 6 === 0 || index === rows.length - 1) svg += `<text class="chart-tick" x="${x(index)}" y="${height - 10}" text-anchor="middle">${escapeHtml(row.period)}</text>`;
    });
    for (const marketKey of ["fleet", "order"]) {
      const marketRows = rows.map((row) => row[marketKey]);
      svg += `<path class="line-${marketKey}" d="${trendPath(marketRows, field, x, y)}"></path>`;
      rows.forEach((row, index) => {
        const value = row[marketKey][field];
        svg += `<circle class="data-point ${marketKey}" cx="${x(index)}" cy="${y(value)}" r="${index === rows.length - 1 ? 4.2 : 2.2}" data-tip="${escapeHtml(`${row.period}｜${marketName(marketKey)}${fuelLabel(fuelKey)}｜${formatPct(value)}`)}"></circle>`;
      });
    }
    node.innerHTML = `${svg}</svg>`;
  }

  function renderTopic() {
    $$("#topicTabs button").forEach((button) => {
      const active = button.dataset.topic === state.topic;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (state.topic === "battery") return renderBatteryTopic();
    if (state.topic === "other") return renderOtherTopic();
    renderFuelTopic(state.topic);
  }

  function topicMetric(label, value, note) {
    return `<div class="topic-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
  }

  function renderFuelTopic(fuelKey) {
    const fleet = fuelObject("fleet", fuelKey);
    const order = fuelObject("order", fuelKey);
    const names = fuelKey === "lng" ? { code: "LNG", title: "LNG动力船舶", description: "投用规模、订单规模、总吨（GT）占比趋势与主要船型。" } : { code: "MeOH", title: "甲醇动力船舶", description: "投用规模、订单规模、总吨（GT）占比趋势与主要船型。" };
    $("#topicCode").textContent = names.code;
    $("#topicTitle").textContent = names.title;
    $("#topicDescription").textContent = names.description;
    $("#topicNote").textContent = "燃料总计包含单一燃料及组合参与，组合船可同时进入相关燃料类别。";
    $("#topicMetrics").innerHTML = [
      topicMetric("投用", `${numberFormat.format(fleet.count)}艘`, `${formatWan(fleet.gt)}万GT`),
      topicMetric("订单", `${numberFormat.format(order.count)}艘`, `${formatWan(order.gt)}万GT`),
      topicMetric("投用结构", `${numberFormat.format(fleet.singleCount)}＋${numberFormat.format(fleet.comboCount)}`, "单一燃料＋组合参与"),
      topicMetric("订单结构", `${numberFormat.format(order.singleCount)}＋${numberFormat.format(order.comboCount)}`, "单一燃料＋组合参与"),
    ].join("");
    $("#topicTrendTitle").textContent = `${fuelLabel(fuelKey)}投用 / 订单总吨占比趋势`;
    $("#topicTrendUnit").textContent = "绿色：投用 · 橙色：订单";
    $("#topicShipsTitle").textContent = `${fuelLabel(fuelKey)}主要船型`;
    renderFuelComparisonTrend("#topicTrend", fuelKey);
    renderTopicShips(fuelKey);
  }

  function fuelShipRows(fuelKey) {
    const labels = [...new Set([...data.markets.fleet.ships, ...data.markets.order.ships].map((ship) => ship.label))];
    return labels.map((label) => {
      const fleet = data.markets.fleet.ships.find((ship) => ship.label === label)?.fuels[fuelKey] || { count: 0, gt: 0 };
      const order = data.markets.order.ships.find((ship) => ship.label === label)?.fuels[fuelKey] || { count: 0, gt: 0 };
      return { label, fleet, order, total: fleet.count + order.count };
    }).filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
  }

  function renderTopicShips(fuelKey) {
    const rows = fuelShipRows(fuelKey).slice(0, 9);
    if (!rows.length) { $("#topicShips").innerHTML = '<div class="empty-state">暂无船型分布</div>'; return; }
    const max = Math.max(...rows.flatMap((row) => [row.fleet.count, row.order.count]), 1);
    $("#topicShips").innerHTML = `<div class="fuel-list">${rows.map((row) => `<div class="fuel-list-row"><label title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</label><div class="track"><i class="f" style="width:${row.fleet.count / max * 50}%"></i><i class="o" style="width:${row.order.count / max * 50}%"></i></div><b>${numberFormat.format(row.fleet.count)} / ${numberFormat.format(row.order.count)}</b></div>`).join("")}</div>`;
  }

  function renderBatteryTopic() {
    const fleet = data.battery.fleet, order = data.battery.order;
    $("#topicCode").textContent = "EV";
    $("#topicTitle").textContent = "电池动力船舶";
    $("#topicDescription").textContent = "纯电动单列，其余电池相关动力统一归入混合动力。";
    $("#topicNote").textContent = "电池动力采用专项口径，不与各替代燃料类别简单相加。";
    $("#topicMetrics").innerHTML = [
      topicMetric("投用电池动力", `${numberFormat.format(fleet.count)}艘`, `${formatWan(fleet.gt)}万GT`),
      topicMetric("投用构成", `${fleet.pure} / ${fleet.hybrid}`, "纯电 / 混合动力"),
      topicMetric("电池动力订单", `${numberFormat.format(order.count)}艘`, `${formatWan(order.gt)}万GT`),
      topicMetric("订单构成", `${order.pure} / ${order.hybrid}`, "纯电 / 混合动力"),
    ].join("");
    $("#topicTrendTitle").textContent = "投用电池动力结构";
    $("#topicTrendUnit").textContent = "纯电 / 混合动力";
    $("#topicShipsTitle").textContent = "订单电池动力结构";
    $("#topicTrend").innerHTML = batteryBlock("投用", fleet);
    $("#topicShips").innerHTML = batteryBlock("订单", order);
  }

  function batteryBlock(label, record) {
    const pureShare = record.count ? record.pure / record.count : 0;
    const hybridShare = 1 - pureShare;
    return `<div class="battery-topic"><div><div class="battery-row-head"><span>${label}电池动力</span><strong>${numberFormat.format(record.count)}艘</strong></div><div class="battery-stack"><i class="pure" style="width:${pureShare * 100}%">${formatPct(pureShare)}</i><i class="hybrid" style="width:${hybridShare * 100}%">${formatPct(hybridShare)}</i></div><div class="battery-detail"><span>纯电 ${numberFormat.format(record.pure)}艘</span><span>混合动力 ${numberFormat.format(record.hybrid)}艘</span></div></div></div>`;
  }

  function renderOtherTopic() {
    const excluded = new Set(["lng", "methanol", "other"]);
    const rows = data.markets.fleet.fuels.filter((fuel) => !excluded.has(fuel.key) && (fuel.count || fuelObject("order", fuel.key).count)).map((fuel) => ({ label: fuel.label, fleet: fuel, order: fuelObject("order", fuel.key) })).sort((a, b) => b.fleet.count + b.order.count - a.fleet.count - a.order.count);
    $("#topicCode").textContent = "ALT";
    $("#topicTitle").textContent = "其他替代燃料";
    $("#topicDescription").textContent = "LPG、生物燃料、氨、氢、乙烷、乙醇与核能的分类汇总。";
    $("#topicNote").textContent = "不同燃料可能包含组合参与，不能将各燃料艘数相加后解释为唯一船舶总量。";
    const topFleet = [...rows].sort((a, b) => b.fleet.count - a.fleet.count)[0];
    const topOrder = [...rows].sort((a, b) => b.order.count - a.order.count)[0];
    $("#topicMetrics").innerHTML = [
      topicMetric("投用最多", topFleet.label, `${numberFormat.format(topFleet.fleet.count)}艘`),
      topicMetric("订单最多", topOrder.label, `${numberFormat.format(topOrder.order.count)}艘`),
      topicMetric("分类数量", `${rows.length}类`, "公开燃料类别"),
      topicMetric("组合燃料", `${data.markets.fleet.combinations.count} / ${data.markets.order.combinations.count}`, "投用 / 订单"),
    ].join("");
    $("#topicTrendTitle").textContent = "投用燃料结构";
    $("#topicTrendUnit").textContent = "按艘数";
    $("#topicShipsTitle").textContent = "订单燃料结构";
    $("#topicTrend").innerHTML = renderFuelList(rows, "fleet");
    $("#topicShips").innerHTML = renderFuelList(rows, "order");
  }

  function renderFuelList(rows, marketKey) {
    const max = Math.max(...rows.map((row) => row[marketKey].count), 1);
    return `<div class="fuel-list">${rows.map((row) => `<div class="fuel-list-row"><label>${escapeHtml(row.label)}</label><div class="track"><i class="${marketKey === "fleet" ? "f" : "o"}" style="width:${row[marketKey].count / max * 100}%"></i></div><b>${numberFormat.format(row[marketKey].count)}艘</b></div>`).join("")}</div>`;
  }

  function filteredSummary(marketKey) {
    const market = data.markets[marketKey];
    if (state.ship !== "all") {
      const ship = market.ships.find((item) => item.label === state.ship);
      if (!ship) return { count: 0, gt: 0 };
      return state.fuel === "all" ? { count: ship.count, gt: ship.gt } : (ship.fuels[state.fuel] || { count: 0, gt: 0 });
    }
    return state.fuel === "all" ? { count: market.count, gt: market.gt } : fuelObject(marketKey, state.fuel);
  }

  function databaseShipRows() {
    const labels = [...new Set([...data.markets.fleet.ships, ...data.markets.order.ships].map((ship) => ship.label))];
    return labels.map((label) => {
      const result = { label };
      for (const key of ["fleet", "order"]) {
        const ship = data.markets[key].ships.find((item) => item.label === label);
        result[key] = state.fuel === "all" ? (ship || { count: 0, gt: 0 }) : (ship?.fuels[state.fuel] || { count: 0, gt: 0 });
      }
      return result;
    }).filter((row) => state.ship === "all" || row.label === state.ship);
  }

  function renderDatabase() {
    const fuelText = state.fuel === "all" ? "全部燃料" : fuelLabel(state.fuel);
    const shipText = state.ship === "all" ? "全部船型" : state.ship;
    $("#filterStatus").textContent = `当前查询：${state.market === "both" ? "投用＋订单" : marketName(state.market)} · ${state.metric === "gt" ? "总吨（GT）" : "艘数"} · ${fuelText} · ${shipText}`;
    renderShipBars();
    renderQuerySummary();
    renderMatrix();
    updateUrl();
  }

  function renderShipBars() {
    const key = metricKey();
    const markets = selectedMarkets();
    const rows = databaseShipRows().map((row) => ({ ...row, total: markets.reduce((sum, market) => sum + row[market][key], 0) })).filter((row) => row.total > 0).sort((a, b) => b.total - a.total).slice(0, 12);
    if (!rows.length) { $("#shipBars").innerHTML = '<div class="empty-state">当前查询没有船型记录</div>'; return; }
    const max = Math.max(...rows.flatMap((row) => markets.map((market) => row[market][key])), 1);
    $("#shipBars").innerHTML = rows.map((row) => `<div class="ship-row"><label title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</label><div class="dual-track"><div>${markets.includes("fleet") ? `<i class="fleet" style="width:${row.fleet[key] / max * 100}%"></i>` : ""}</div><div>${markets.includes("order") ? `<i class="order" style="width:${row.order[key] / max * 100}%"></i>` : ""}</div></div><b>${formatMetric(row.total)}${state.metric === "gt" ? "万GT" : "艘"}</b></div>`).join("");
  }

  function renderQuerySummary() {
    const fleet = filteredSummary("fleet"), order = filteredSummary("order");
    const label = [state.fuel === "all" ? null : fuelLabel(state.fuel), state.ship === "all" ? null : state.ship].filter(Boolean).join(" · ") || "全部替代燃料船舶";
    const fleetCountShare = fleet.count / Math.max(1, data.markets.fleet.count);
    const orderCountShare = order.count / Math.max(1, data.markets.order.count);
    $("#querySummary").innerHTML = `<h3>${escapeHtml(label)}</h3><p>当前筛选结果</p><div class="result-totals">
      <div class="result-item"><span>投用</span><strong>${numberFormat.format(fleet.count)}艘</strong><small>${formatWan(fleet.gt)}万GT · 占投用总量${formatPct(fleetCountShare)}</small></div>
      <div class="result-item"><span>订单</span><strong>${numberFormat.format(order.count)}艘</strong><small>${formatWan(order.gt)}万GT · 占订单总量${formatPct(orderCountShare)}</small></div>
    </div><div class="result-note">燃料筛选包含相关组合参与。船型总计按船舶去重，燃料类别之间可能重合。</div>`;
  }

  function renderMatrix() {
    const market = data.markets[state.matrixMarket];
    const key = metricKey();
    const fuels = market.fuels.filter((fuel) => fuel.count > 0 && fuel.key !== "other");
    const ships = [...market.ships].sort((a, b) => b[key] - a[key]);
    const matrixValues = ships.flatMap((ship) => fuels.map((fuel) => Number(ship.fuels[fuel.key]?.[key] || 0)));
    const max = Math.max(...matrixValues, 1);
    const columns = `132px repeat(${fuels.length},minmax(58px,1fr)) 78px`;
    let html = `<div class="heat-corner">船型大类</div>${fuels.map((fuel) => `<div class="heat-col">${escapeHtml(fuel.label)}</div>`).join("")}<div class="heat-col">去重总计</div>`;
    ships.forEach((ship) => {
      html += `<div class="heat-row">${escapeHtml(ship.label)}</div>`;
      fuels.forEach((fuel) => {
        const raw = Number(ship.fuels[fuel.key]?.[key] || 0);
        const displayed = state.matrixMode === "rowShare" ? raw / Math.max(1, ship[key]) : raw;
        const alpha = raw ? .1 + .8 * raw / max : .025;
        const text = state.matrixMode === "rowShare" ? `${percentFormat.format(displayed * 100)}%` : state.metric === "gt" ? formatWan(raw) : (raw ? numberFormat.format(raw) : "—");
        html += `<div class="heat-cell" style="background:rgba(15,143,131,${alpha})" data-tip="${escapeHtml(`${ship.label} × ${fuel.label}｜${marketName(state.matrixMarket)} ${state.metric === "gt" ? `${formatWan(raw)}万GT` : `${numberFormat.format(raw)}艘`}`)}">${text}</div>`;
      });
      html += `<div class="heat-cell" style="background:#e7efef" data-tip="${escapeHtml(`${ship.label}｜去重总计 ${state.metric === "gt" ? `${formatWan(ship.gt)}万GT` : `${numberFormat.format(ship.count)}艘`}`)}">${state.matrixMode === "rowShare" ? "100.0%" : state.metric === "gt" ? formatWan(ship.gt) : numberFormat.format(ship.count)}</div>`;
    });
    $("#heatmap").style.gridTemplateColumns = columns;
    $("#heatmap").innerHTML = html;
    renderMatrixTable(ships, fuels, key);
  }

  function renderMatrixTable(ships, fuels, key) {
    const head = `<thead><tr><th>船型大类</th>${fuels.map((fuel) => `<th>${escapeHtml(fuel.label)}</th>`).join("")}<th>去重总计</th></tr></thead>`;
    const body = ships.map((ship) => `<tr><td>${escapeHtml(ship.label)}</td>${fuels.map((fuel) => { const value = Number(ship.fuels[fuel.key]?.[key] || 0); return `<td>${value ? (state.metric === "gt" ? formatWan(value) : numberFormat.format(value)) : "—"}</td>`; }).join("")}<td class="total">${state.metric === "gt" ? formatWan(ship.gt) : numberFormat.format(ship.count)}</td></tr>`).join("");
    $("#matrixTable").innerHTML = `${head}<tbody>${body}</tbody>`;
  }

  function renderCombo() {
    const fleet = data.markets.fleet.combinations, order = data.markets.order.combinations;
    const labels = [...new Set([...fleet.groups, ...order.groups].map((row) => row.label))];
    const rows = labels.map((label) => ({ label, fleet: fleet.groups.find((row) => row.label === label)?.count || 0, order: order.groups.find((row) => row.label === label)?.count || 0 })).sort((a, b) => b.fleet + b.order - a.fleet - a.order);
    const max = Math.max(...rows.map((row) => row.fleet + row.order), 1);
    $("#comboChart").innerHTML = `<div class="combo-summary"><div class="mini-kpi"><span>投用组合船</span><b>${fleet.count}艘</b></div><div class="mini-kpi"><span>订单组合船</span><b>${order.count}艘</b></div></div><div class="combo-list">${rows.map((row) => `<div class="combo-row"><label><span>${escapeHtml(row.label)}</span><span>${row.fleet} / ${row.order}</span></label><div class="combo-track"><i class="f" style="width:${row.fleet / max * 100}%"></i><i class="o" style="width:${row.order / max * 100}%"></i></div></div>`).join("")}</div>`;
  }

  function renderReady() {
    const fleet = data.ready.fleet, order = data.ready.order;
    const maxCount = Math.max(fleet.count, order.count), maxGt = Math.max(fleet.gt, order.gt);
    $("#readyChart").innerHTML = `<div class="ready-metrics"><div class="ready-metric"><span>投用Ready</span><b>${numberFormat.format(fleet.count)}艘</b></div><div class="ready-metric"><span>订单Ready</span><b>${numberFormat.format(order.count)}艘</b></div></div><div class="ready-pair">
      <div class="ready-bar"><label><span>投用艘数</span><b>${numberFormat.format(fleet.count)}</b></label><div class="track"><i style="width:${fleet.count / maxCount * 100}%"></i></div></div>
      <div class="ready-bar"><label><span>订单艘数</span><b>${numberFormat.format(order.count)}</b></label><div class="track"><i style="width:${order.count / maxCount * 100}%"></i></div></div>
      <div class="ready-bar"><label><span>投用总吨（GT）</span><b>${formatWan(fleet.gt)}万</b></label><div class="track"><i style="width:${fleet.gt / maxGt * 100}%"></i></div></div>
      <div class="ready-bar"><label><span>订单总吨（GT）</span><b>${formatWan(order.gt)}万</b></label><div class="track"><i style="width:${order.gt / maxGt * 100}%"></i></div></div>
    </div><div class="ready-note">${escapeHtml(data.ready.note)} Ready与替代燃料能力不直接相加。</div>`;
  }

  function populateFilters() {
    $("#fuelFilter").innerHTML = `<option value="all">全部燃料</option>${data.markets.fleet.fuels.filter((fuel) => fuel.count || fuelObject("order", fuel.key).count).map((fuel) => `<option value="${fuel.key}">${escapeHtml(fuel.label)}</option>`).join("")}`;
    const ships = [...new Set([...data.markets.fleet.ships, ...data.markets.order.ships].map((ship) => ship.label))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    $("#shipFilter").innerHTML = `<option value="all">全部船型</option>${ships.map((ship) => `<option value="${escapeHtml(ship)}">${escapeHtml(ship)}</option>`).join("")}`;
    $("#fuelFilter").value = state.fuel;
    $("#shipFilter").value = state.ship;
  }

  function setSegment(container, value) {
    $$(`#${container} button`).forEach((button) => button.classList.toggle("active", button.dataset.value === value));
  }

  function updateUrl() {
    const url = new URL(location.href);
    const defaults = { market: "both", metric: "count", fuel: "all", ship: "all", topic: "lng" };
    for (const key of Object.keys(defaults)) {
      const value = state[key];
      if (value === defaults[key]) url.searchParams.delete(key); else url.searchParams.set(key, value);
    }
    history.replaceState(null, "", `${url.pathname}${url.search}${location.hash}`);
  }

  function parseUrl() {
    const params = new URLSearchParams(location.search);
    if (["both", "fleet", "order"].includes(params.get("market"))) state.market = params.get("market");
    if (["count", "gt"].includes(params.get("metric"))) state.metric = params.get("metric");
    if (params.get("fuel")) state.fuel = params.get("fuel");
    if (params.get("ship")) state.ship = params.get("ship");
    if (["lng", "methanol", "battery", "other"].includes(params.get("topic"))) state.topic = params.get("topic");
  }

  function exportCsv() {
    const rows = [["市场", "船型", "燃料筛选", "艘数", "总吨（GT）"]];
    for (const market of selectedMarkets()) {
      for (const row of databaseShipRows()) rows.push([marketName(market), row.label, state.fuel === "all" ? "全部燃料" : fuelLabel(state.fuel), row[market].count, row[market].gt]);
    }
    const csv = `\ufeff${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `alternative-fuel-fleet-${data.asOf}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("当前查询结果已导出");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function bindTooltips() {
    const tooltip = $("#tooltip");
    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest("[data-tip]");
      if (!target) return;
      const [title, ...rest] = target.dataset.tip.split("｜");
      tooltip.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(rest.join(" · "))}</span>`;
      tooltip.classList.add("show");
    });
    document.addEventListener("pointermove", (event) => {
      if (!tooltip.classList.contains("show")) return;
      const x = Math.min(window.innerWidth - tooltip.offsetWidth - 12, event.clientX + 14);
      const y = Math.min(window.innerHeight - tooltip.offsetHeight - 12, event.clientY + 14);
      tooltip.style.left = `${Math.max(8, x)}px`;
      tooltip.style.top = `${Math.max(8, y)}px`;
    });
    document.addEventListener("pointerout", (event) => { if (event.target.closest("[data-tip]")) tooltip.classList.remove("show"); });
  }

  function bindControls() {
    $("#marketControl").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]"); if (!button) return;
      state.market = button.dataset.value; setSegment("marketControl", state.market); renderDatabase();
    });
    $("#metricControl").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]"); if (!button) return;
      state.metric = button.dataset.value; setSegment("metricControl", state.metric); renderDatabase();
    });
    $("#matrixMarket").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]"); if (!button) return;
      state.matrixMarket = button.dataset.value; setSegment("matrixMarket", state.matrixMarket); renderMatrix();
    });
    $("#matrixMode").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]"); if (!button) return;
      state.matrixMode = button.dataset.value; setSegment("matrixMode", state.matrixMode); renderMatrix();
    });
    $("#topicTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-topic]"); if (!button) return;
      state.topic = button.dataset.topic; renderTopic(); updateUrl();
    });
    $("#fuelFilter").addEventListener("change", (event) => { state.fuel = event.target.value; renderDatabase(); });
    $("#shipFilter").addEventListener("change", (event) => { state.ship = event.target.value; renderDatabase(); });
    $("#resetFilters").addEventListener("click", () => {
      Object.assign(state, { market: "both", metric: "count", fuel: "all", ship: "all", matrixMarket: "fleet", matrixMode: "absolute" });
      setSegment("marketControl", state.market); setSegment("metricControl", state.metric); setSegment("matrixMarket", state.matrixMarket); setSegment("matrixMode", state.matrixMode);
      $("#fuelFilter").value = "all"; $("#shipFilter").value = "all"; renderDatabase(); showToast("数据库筛选已重置");
    });
    $("#exportCsv").addEventListener("click", exportCsv);
  }

  function bindNavigation() {
    const links = $$(".main-nav a");
    const sections = links.map((link) => $(link.getAttribute("href"))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
    }, { rootMargin: "-20% 0px -65%", threshold: [0, .2, .6] });
    sections.forEach((section) => observer.observe(section));
  }

  async function init() {
    try {
      const response = await fetch("data/latest.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      parseUrl();
      renderHeader();
      renderOverview();
      populateFilters();
      setSegment("marketControl", state.market); setSegment("metricControl", state.metric);
      renderTopic();
      renderDatabase();
      renderCombo();
      renderReady();
      bindControls();
      bindTooltips();
      bindNavigation();
    } catch (error) {
      console.error(error);
      $("#main").innerHTML = `<div class="loading-error shell"><b>数据加载失败</b><p>请通过HTTP服务访问页面，并确认data/latest.json可用。</p></div>`;
    }
  }

  init();
})();
