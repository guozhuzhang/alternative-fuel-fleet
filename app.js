(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const numberFormat = new Intl.NumberFormat("zh-CN");
  const percentFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const state = { market: "both", metric: "count", fuel: "all", ship: "all", matrixMarket: "fleet", matrixMode: "absolute" };
  const colors = { fleet: "#0f8f83", order: "#f28c45", muted: "#dce6e7", ink: "#15313a" };
  let data;

  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const formatDate = (value) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const formatWan = (value) => Number((Number(value || 0) / 10000).toFixed(2)).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  const formatPercent = (value) => `${percentFormat.format(Number(value || 0) * 100)}%`;
  const rawMetric = () => state.metric === "gt" ? "gt" : "count";
  const metricLabel = () => state.metric === "gt" ? "万GT" : state.metric === "share" ? "艘数占比" : "艘";
  const metricValue = (record) => state.metric === "gt" ? Number(record?.gt || 0) : Number(record?.count || 0);
  const metricText = (value) => state.metric === "gt" ? `${formatWan(value)}万GT` : state.metric === "share" ? `${percentFormat.format(value)}%` : `${numberFormat.format(Math.round(value))}艘`;
  const marketName = (key) => key === "fleet" ? "投用" : "订单";
  const selectedMarkets = () => state.market === "both" ? ["fleet", "order"] : [state.market];
  const fuelLabel = (key) => data.markets.fleet.fuels.find((fuel) => fuel.key === key)?.label || key;
  const totalForMarket = (key) => data.markets[key];

  function filteredSummary(key) {
    const market = data.markets[key];
    if (state.ship !== "all") {
      const ship = market.ships.find((item) => item.label === state.ship);
      if (!ship) return { count: 0, gt: 0 };
      if (state.fuel === "all") return { count: ship.count, gt: ship.gt };
      return ship.fuels[state.fuel] || { count: 0, gt: 0 };
    }
    if (state.fuel !== "all") return market.fuels.find((item) => item.key === state.fuel) || { count: 0, gt: 0 };
    return { count: market.count, gt: market.gt };
  }

  function fuelRows() {
    let fuels = data.markets.fleet.fuels.filter((fuel) => fuel.count || data.markets.order.fuels.find((item) => item.key === fuel.key)?.count);
    if (state.fuel !== "all") fuels = fuels.filter((fuel) => fuel.key === state.fuel);
    return fuels.map((fuel) => {
      const values = {};
      for (const key of ["fleet", "order"]) {
        if (state.ship === "all") values[key] = data.markets[key].fuels.find((item) => item.key === fuel.key) || { count: 0, gt: 0 };
        else values[key] = data.markets[key].ships.find((ship) => ship.label === state.ship)?.fuels[fuel.key] || { count: 0, gt: 0 };
      }
      return { key: fuel.key, label: fuel.label, ...values };
    });
  }

  function shipRows() {
    const labels = [...new Set([...data.markets.fleet.ships, ...data.markets.order.ships].map((ship) => ship.label))];
    let rows = labels.map((label) => {
      const result = { label };
      for (const key of ["fleet", "order"]) {
        const ship = data.markets[key].ships.find((item) => item.label === label);
        result[key] = state.fuel === "all" ? (ship || { count: 0, gt: 0 }) : (ship?.fuels[state.fuel] || { count: 0, gt: 0 });
      }
      return result;
    });
    if (state.ship !== "all") rows = rows.filter((row) => row.label === state.ship);
    return rows;
  }

  function renderHero() {
    const fleet = data.markets.fleet;
    const order = data.markets.order;
    const countRatio = order.count / fleet.count;
    const gtRatio = order.gt / fleet.gt;
    $("#snapshotDate").textContent = `数据快照 · ${data.asOf}`;
    $("#asOfChip").textContent = `截至${formatDate(data.asOf)}`;
    $("#sourceEyebrow").textContent = `${data.source} · ${data.asOf}`;
    $("#heroVisual").innerHTML = `<div class="ratio-visual">
      <div class="ratio-title"><div><span>订单 / 投用规模比</span><b>${formatPercent(gtRatio)}</b></div><small>按GT</small></div>
      <div class="ratio-track"><i style="width:${Math.min(100, gtRatio * 100)}%"></i></div>
      <div class="ratio-scale"><span>0</span><span>投用规模 100%</span></div>
      <div class="ratio-grid"><div class="ratio-cell"><span>按艘数</span><b>${formatPercent(countRatio)}</b></div><div class="ratio-cell"><span>订单平均单船GT</span><b>${formatWan(order.averageGt)}万</b></div></div>
    </div>`;
    $("#sourceNote").textContent = `数据来源：${data.source}，${data.attribution}`;
    $("#dataBoundary").textContent = `统计日期：${data.asOf}。Fuel Ready当前仅提供汇总数据。`;
    $("#footerSource").textContent = `${data.source}，截至${data.asOf}，${data.attribution}`;
  }

  function renderKpis() {
    const fleet = filteredSummary("fleet");
    const order = filteredSummary("order");
    const key = rawMetric();
    let cards;
    if (state.market === "both") {
      const ratio = fleet[key] ? order[key] / fleet[key] : 0;
      const fleetAverage = fleet.count ? fleet.gt / fleet.count : 0;
      const orderAverage = order.count ? order.gt / order.count : 0;
      cards = [
        ["筛选范围内投用", `${numberFormat.format(fleet.count)}艘`, `${formatWan(fleet.gt)}万GT`, "fleet"],
        ["筛选范围内订单", `${numberFormat.format(order.count)}艘`, `${formatWan(order.gt)}万GT`, "order"],
        ["订单 / 投用规模比", formatPercent(ratio), state.metric === "gt" ? "按GT计算" : "按艘数计算", "ratio"],
        ["平均单船GT", `${formatWan(orderAverage)}万`, `订单；投用为${formatWan(fleetAverage)}万`, "average"],
      ];
    } else {
      const item = state.market === "fleet" ? fleet : order;
      const total = totalForMarket(state.market);
      const countShare = item.count / Math.max(1, total.count);
      const gtShare = item.gt / Math.max(1, total.gt);
      cards = [
        [`${marketName(state.market)}艘数`, `${numberFormat.format(item.count)}艘`, `占全部${marketName(state.market)} ${formatPercent(countShare)}`, state.market],
        [`${marketName(state.market)}总吨`, `${formatWan(item.gt)}万GT`, `占全部${marketName(state.market)} ${formatPercent(gtShare)}`, state.market],
        ["平均单船GT", `${formatWan(item.count ? item.gt / item.count : 0)}万`, "筛选范围内GT / 艘数", "average"],
        ["统计范围", state.fuel === "all" ? "全部燃料" : fuelLabel(state.fuel), state.ship === "all" ? "全部船型" : state.ship, "ratio"],
      ];
    }
    $("#kpiGrid").innerHTML = cards.map(([label, value, note, style]) => `<article class="kpi-card ${style}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  }

  function renderInsights() {
    const fleet = filteredSummary("fleet");
    const order = filteredSummary("order");
    const countRatio = fleet.count ? order.count / fleet.count : 0;
    const avgFleet = fleet.count ? fleet.gt / fleet.count : 0;
    const avgOrder = order.count ? order.gt / order.count : 0;
    const rows = fuelRows().map((row) => ({ ...row, total: row.fleet.count + row.order.count })).sort((a, b) => b.total - a.total);
    const leader = rows[0];
    const avgDelta = avgFleet ? avgOrder / avgFleet - 1 : 0;
    const insights = [
      ["01", "订单规模", fleet.count ? `订单艘数相当于投用规模的${formatPercent(countRatio)}。` : "当前筛选没有可比投用规模。"],
      ["02", "船舶尺度", avgFleet ? `订单平均单船GT比投用${avgDelta >= 0 ? "高" : "低"}${formatPercent(Math.abs(avgDelta))}。` : "当前筛选缺少平均GT比较基础。"],
      ["03", "最大燃料类别", leader ? `${leader.label}在当前筛选中的投用与订单合计最多。` : "当前筛选没有燃料记录。"],
    ];
    $("#insightStrip").innerHTML = insights.map(([no, title, text]) => `<article class="insight"><span>${no}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></div></article>`).join("");
  }

  function scaleTicks(max, count = 4) {
    return Array.from({ length: count + 1 }, (_, index) => max * index / count);
  }

  function displayValue(raw, marketKey, denominator) {
    if (state.metric === "share") return denominator ? raw.count / denominator.count * 100 : 0;
    return metricValue(raw);
  }

  function renderFuelComparison() {
    const series = selectedMarkets();
    const rows = fuelRows().map((row) => {
      const values = {};
      for (const key of ["fleet", "order"]) {
        const denominator = state.ship === "all" ? data.markets[key] : (data.markets[key].ships.find((ship) => ship.label === state.ship) || { count: 0, gt: 0 });
        values[key] = displayValue(row[key], key, denominator);
      }
      return { ...row, values, sortValue: series.reduce((sum, key) => sum + values[key], 0) };
    }).filter((row) => row.sortValue > 0).sort((a, b) => b.sortValue - a.sortValue);
    const node = $("#fuelComparison");
    if (!rows.length) { node.innerHTML = '<div class="empty-state">当前筛选没有燃料记录</div>'; return; }
    const width = 900, rowHeight = series.length === 2 ? 48 : 37, height = rows.length * rowHeight + 55, left = 116, right = 95, top = 27, plotWidth = width - left - right;
    const max = Math.max(1, ...rows.flatMap((row) => series.map((key) => row.values[key])));
    const ticks = scaleTicks(max);
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
    ticks.forEach((tick) => { const x = left + tick / max * plotWidth; svg += `<line class="grid-line" x1="${x}" y1="${top - 10}" x2="${x}" y2="${height - 24}"></line><text class="chart-tick" x="${x}" y="${height - 8}" text-anchor="middle">${state.metric === "gt" ? formatWan(tick) : state.metric === "share" ? `${percentFormat.format(tick)}%` : numberFormat.format(Math.round(tick))}</text>`; });
    rows.forEach((row, index) => {
      const y = top + index * rowHeight;
      svg += `<text class="chart-label" x="0" y="${y + (series.length === 2 ? 16 : 14)}">${escapeHtml(row.label)}</text>`;
      series.forEach((key, seriesIndex) => {
        const value = row.values[key], barY = y + seriesIndex * 15, barWidth = value / max * plotWidth;
        const valueText = state.metric === "gt" ? `${formatWan(value)}万` : state.metric === "share" ? `${percentFormat.format(value)}%` : numberFormat.format(Math.round(value));
        const tipText = `${row.label}｜${marketName(key)}：${state.metric === "gt" ? `${formatWan(row[key].gt)}万GT` : state.metric === "share" ? `${percentFormat.format(value)}%（${numberFormat.format(row[key].count)}艘）` : `${numberFormat.format(row[key].count)}艘`}`;
        svg += `<g class="chart-hit" data-fuel="${row.key}" data-tip="${escapeHtml(tipText)}"><rect x="${left}" y="${barY}" width="${plotWidth}" height="10" rx="5" fill="#edf2f2"></rect><rect class="${key}-fill" x="${left}" y="${barY}" width="${Math.max(value ? 2 : 0, barWidth)}" height="10" rx="5"></rect><text class="chart-value" x="${left + plotWidth + 8}" y="${barY + 8}">${valueText}</text></g>`;
      });
    });
    node.innerHTML = `${svg}</svg>`;
    bindChartInteractions(node, "fuel");
  }

  function renderFuelShift() {
    const node = $("#fuelShift");
    $("#shareUnit").textContent = state.metric === "gt" ? "GT占比" : "艘数占比";
    if (state.market !== "both") { node.innerHTML = '<div class="empty-state">切换到“投用＋订单”查看占比变化</div>'; return; }
    const key = rawMetric();
    const denominator = {
      fleet: state.ship === "all" ? data.markets.fleet[key] : (data.markets.fleet.ships.find((ship) => ship.label === state.ship)?.[key] || 0),
      order: state.ship === "all" ? data.markets.order[key] : (data.markets.order.ships.find((ship) => ship.label === state.ship)?.[key] || 0),
    };
    const rows = fuelRows().map((row) => ({
      ...row,
      fleetShare: denominator.fleet ? row.fleet[key] / denominator.fleet * 100 : 0,
      orderShare: denominator.order ? row.order[key] / denominator.order * 100 : 0,
    })).filter((row) => row.fleetShare || row.orderShare).sort((a, b) => Math.max(b.fleetShare, b.orderShare) - Math.max(a.fleetShare, a.orderShare));
    if (!rows.length) { node.innerHTML = '<div class="empty-state">当前筛选没有可比较记录</div>'; return; }
    const width = 610, rowHeight = 39, height = rows.length * rowHeight + 54, left = 96, right = 72, top = 25, plotWidth = width - left - right;
    const max = Math.max(5, ...rows.flatMap((row) => [row.fleetShare, row.orderShare])) * 1.05;
    const ticks = scaleTicks(max);
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
    ticks.forEach((tick) => { const x = left + tick / max * plotWidth; svg += `<line class="grid-line" x1="${x}" y1="${top - 10}" x2="${x}" y2="${height - 24}"></line><text class="chart-tick" x="${x}" y="${height - 8}" text-anchor="middle">${percentFormat.format(tick)}%</text>`; });
    rows.forEach((row, index) => {
      const y = top + index * rowHeight + 8, x1 = left + row.fleetShare / max * plotWidth, x2 = left + row.orderShare / max * plotWidth, delta = row.orderShare - row.fleetShare;
      const tipText = `${row.label}｜投用${percentFormat.format(row.fleetShare)}%，订单${percentFormat.format(row.orderShare)}%，变化${delta >= 0 ? "+" : ""}${percentFormat.format(delta)}个百分点`;
      svg += `<g class="chart-hit" data-fuel="${row.key}" data-tip="${escapeHtml(tipText)}"><text class="chart-label" x="0" y="${y + 3}">${escapeHtml(row.label)}</text><line x1="${Math.min(x1, x2)}" y1="${y}" x2="${Math.max(x1, x2)}" y2="${y}" stroke="#bfcaca" stroke-width="3" stroke-linecap="round"></line><circle cx="${x1}" cy="${y}" r="6" class="fleet-fill"></circle><circle cx="${x2}" cy="${y}" r="6" class="order-fill"></circle><text class="chart-value" x="${left + plotWidth + 8}" y="${y + 3}">${delta >= 0 ? "+" : ""}${percentFormat.format(delta)}pp</text></g>`;
    });
    node.innerHTML = `${svg}</svg>`;
    bindChartInteractions(node, "fuel");
  }

  function renderShipScatter() {
    const node = $("#shipScatter");
    if (state.market !== "both") { node.innerHTML = '<div class="empty-state">切换到“投用＋订单”查看船型发展位置</div>'; return; }
    const key = rawMetric();
    $("#scatterUnit").textContent = state.metric === "gt" ? "横纵轴：万GT" : "横纵轴：艘";
    const rows = shipRows().filter((row) => row.fleet[key] || row.order[key]);
    if (!rows.length) { node.innerHTML = '<div class="empty-state">当前筛选没有船型记录</div>'; return; }
    const width = 820, height = 430, left = 68, right = 24, top = 22, bottom = 48, plotWidth = width - left - right, plotHeight = height - top - bottom;
    const xMax = Math.max(1, ...rows.map((row) => row.fleet[key])) * 1.08;
    const yMax = Math.max(1, ...rows.map((row) => row.order[key])) * 1.08;
    const sizeKey = key === "count" ? "gt" : "count";
    const sizeMax = Math.max(1, ...rows.map((row) => row.fleet[sizeKey] + row.order[sizeKey]));
    const topLabels = new Set([...rows].sort((a, b) => b.fleet[key] + b.order[key] - a.fleet[key] - a.order[key]).slice(0, 8).map((row) => row.label));
    let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
    scaleTicks(xMax).forEach((tick) => { const x = left + tick / xMax * plotWidth; svg += `<line class="grid-line" x1="${x}" y1="${top}" x2="${x}" y2="${top + plotHeight}"></line><text class="chart-tick" x="${x}" y="${height - 22}" text-anchor="middle">${key === "gt" ? formatWan(tick) : numberFormat.format(Math.round(tick))}</text>`; });
    scaleTicks(yMax).forEach((tick) => { const y = top + plotHeight - tick / yMax * plotHeight; svg += `<line class="grid-line" x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}"></line><text class="chart-tick" x="${left - 8}" y="${y + 3}" text-anchor="end">${key === "gt" ? formatWan(tick) : numberFormat.format(Math.round(tick))}</text>`; });
    const commonMax = Math.min(xMax, yMax), refX2 = left + commonMax / xMax * plotWidth, refY2 = top + plotHeight - commonMax / yMax * plotHeight;
    svg += `<line class="reference-line" x1="${left}" y1="${top + plotHeight}" x2="${refX2}" y2="${refY2}"></line><text class="chart-tick" x="${refX2 - 5}" y="${refY2 - 7}" text-anchor="end">订单＝投用</text>`;
    rows.forEach((row) => {
      const x = left + row.fleet[key] / xMax * plotWidth, y = top + plotHeight - row.order[key] / yMax * plotHeight, radius = 5 + Math.sqrt((row.fleet[sizeKey] + row.order[sizeKey]) / sizeMax) * 16;
      const tipText = `${row.label}｜投用：${key === "gt" ? `${formatWan(row.fleet.gt)}万GT` : `${numberFormat.format(row.fleet.count)}艘`}；订单：${key === "gt" ? `${formatWan(row.order.gt)}万GT` : `${numberFormat.format(row.order.count)}艘`}`;
      svg += `<g class="chart-hit" data-ship="${escapeHtml(row.label)}" data-tip="${escapeHtml(tipText)}"><circle class="bubble" cx="${x}" cy="${y}" r="${radius}"></circle>${topLabels.has(row.label) ? `<text class="chart-label" x="${x + radius + 4}" y="${y + 3}">${escapeHtml(row.label)}</text>` : ""}</g>`;
    });
    svg += `<text class="chart-label" x="${left + plotWidth / 2}" y="${height - 3}" text-anchor="middle">投用 ${key === "gt" ? "（万GT）" : "（艘）"}</text><text class="chart-label" x="13" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 13 ${top + plotHeight / 2})">订单 ${key === "gt" ? "（万GT）" : "（艘）"}</text></svg>`;
    node.innerHTML = svg;
    bindChartInteractions(node, "ship");
  }

  function renderShipRanking() {
    const key = rawMetric();
    const series = selectedMarkets();
    const rows = shipRows().map((row) => ({ ...row, total: series.reduce((sum, market) => sum + row[market][key], 0) })).filter((row) => row.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
    const max = Math.max(1, ...rows.map((row) => row.total));
    $("#shipRanking").innerHTML = rows.length ? rows.map((row, index) => {
      const fleetWidth = series.includes("fleet") ? row.fleet[key] / max * 100 : 0;
      const orderWidth = series.includes("order") ? row.order[key] / max * 100 : 0;
      const label = key === "gt" ? `${formatWan(row.total)}万` : numberFormat.format(Math.round(row.total));
      return `<div class="rank-row" data-ship="${escapeHtml(row.label)}"><span>${index + 1}</span><label title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</label><div class="rank-track"><i class="f" style="width:${fleetWidth}%"></i><i class="o" style="width:${orderWidth}%"></i></div><b>${label}</b></div>`;
    }).join("") : '<div class="empty-state">当前筛选没有船型记录</div>';
    $$(".rank-row", $("#shipRanking")).forEach((row) => row.addEventListener("click", () => selectShip(row.dataset.ship)));
  }

  function matrixData() {
    const market = data.markets[state.matrixMarket], key = rawMetric();
    let fuels = market.fuels.filter((fuel) => fuel[key] > 0);
    if (state.fuel !== "all") fuels = fuels.filter((fuel) => fuel.key === state.fuel);
    let ships = market.ships;
    if (state.ship !== "all") ships = ships.filter((ship) => ship.label === state.ship);
    ships = ships.map((ship) => ({ ...ship, values: fuels.map((fuel) => ship.fuels[fuel.key] || { count: 0, gt: 0 }) })).sort((a, b) => b[key] - a[key]);
    return { market, fuels, ships, key };
  }

  function renderMatrix() {
    const { fuels, ships, key } = matrixData();
    const topShips = ships.slice(0, 14);
    const values = topShips.flatMap((ship) => ship.values.map((value) => state.matrixMode === "rowShare" ? (ship[key] ? value[key] / ship[key] * 100 : 0) : value[key]));
    const max = Math.max(1, ...values);
    const columns = `118px repeat(${Math.max(1, fuels.length)},minmax(58px,1fr))`;
    let html = `<div class="heatmap" style="grid-template-columns:${columns}"><div class="heat-corner"></div>${fuels.map((fuel) => `<div class="heat-col">${escapeHtml(fuel.label)}</div>`).join("")}`;
    topShips.forEach((ship) => {
      html += `<div class="heat-row">${escapeHtml(ship.label)}</div>`;
      ship.values.forEach((value, index) => {
        const shown = state.matrixMode === "rowShare" ? (ship[key] ? value[key] / ship[key] * 100 : 0) : value[key];
        const ratio = shown / max, alpha = shown ? .08 + ratio * .85 : .025, color = ratio > .52 ? "#fff" : colors.ink;
        const text = !shown ? "—" : state.matrixMode === "rowShare" ? `${percentFormat.format(shown)}%` : key === "gt" ? formatWan(shown) : numberFormat.format(Math.round(shown));
        const tipText = `${ship.label} × ${fuels[index].label}：${key === "gt" ? `${formatWan(value.gt)}万GT` : `${numberFormat.format(value.count)}艘`}${state.matrixMode === "rowShare" ? `；船型内占比${percentFormat.format(shown)}%` : ""}`;
        html += `<div class="heat-cell" data-tip="${escapeHtml(tipText)}" style="background:rgba(${state.matrixMarket === "fleet" ? "15,143,131" : "242,140,69"},${alpha});color:${color}">${text}</div>`;
      });
    });
    $("#heatmap").innerHTML = fuels.length && ships.length ? `${html}</div>` : '<div class="empty-state">当前筛选没有矩阵数据</div>';
    bindTooltips($("#heatmap"));
    const head = `<thead><tr><th>船型大类</th>${fuels.map((fuel) => `<th>${escapeHtml(fuel.label)}</th>`).join("")}<th>去重总计</th></tr></thead>`;
    const body = `<tbody>${ships.map((ship) => `<tr><td>${escapeHtml(ship.label)}</td>${ship.values.map((value) => `<td>${value[key] ? (key === "gt" ? formatWan(value.gt) : numberFormat.format(value.count)) : "—"}</td>`).join("")}<td class="total">${key === "gt" ? formatWan(ship.gt) : numberFormat.format(ship.count)}</td></tr>`).join("")}</tbody>`;
    $("#matrixTable").innerHTML = `${head}${body}`;
  }

  function renderCombo() {
    const groups = new Map();
    for (const key of ["fleet", "order"]) {
      data.markets[key].combinations.groups.forEach((group) => {
        const item = groups.get(group.key) || { label: group.label, fleet: 0, order: 0 };
        item[key] = group.count;
        groups.set(group.key, item);
      });
    }
    const rows = [...groups.values()].sort((a, b) => b.fleet + b.order - a.fleet - a.order);
    const max = Math.max(1, ...rows.map((row) => row.fleet + row.order));
    const fleet = data.markets.fleet.combinations, order = data.markets.order.combinations;
    $("#comboChart").innerHTML = `<div class="combo-summary"><div class="mini-kpi"><span>投用组合船</span><b>${numberFormat.format(fleet.count)}艘</b></div><div class="mini-kpi"><span>订单组合船</span><b>${numberFormat.format(order.count)}艘</b></div></div><div class="combo-list">${rows.map((row) => `<div class="combo-row"><label><span>${escapeHtml(row.label)}</span><span>${row.fleet} / ${row.order}</span></label><div class="combo-track"><i class="f" style="width:${row.fleet / max * 100}%"></i><i class="o" style="width:${row.order / max * 100}%"></i></div></div>`).join("")}</div><div class="battery-legend"><span><i class="fleet-dot"></i>投用</span><span><i class="order-dot"></i>订单</span><span>完整市场，不受筛选影响</span></div>`;
  }

  function renderBattery() {
    $("#batteryChart").innerHTML = `<div class="battery-block">${["fleet", "order"].map((key) => {
      const item = data.battery[key], pureShare = item.pure / item.count * 100, hybridShare = item.hybrid / item.count * 100;
      return `<div class="battery-row"><div><h4>${marketName(key)}</h4><div><strong>${numberFormat.format(item.count)}艘</strong><small>${formatWan(item.gt)}万GT</small></div></div><div class="stacked-bar"><i class="pure" style="width:${pureShare}%">${percentFormat.format(pureShare)}%</i><i class="hybrid" style="width:${hybridShare}%">${percentFormat.format(hybridShare)}%</i></div><div class="battery-legend"><span><i class="pure"></i>纯电 ${numberFormat.format(item.pure)}艘</span><span><i class="hybrid"></i>混合动力 ${numberFormat.format(item.hybrid)}艘</span></div></div>`;
    }).join("")}</div><div class="ready-note">${escapeHtml(data.battery.note)} 完整专项口径，不受页面筛选影响。</div>`;
  }

  function renderReady() {
    const fleet = data.ready.fleet, order = data.ready.order, maxCount = Math.max(fleet.count, order.count), maxGt = Math.max(fleet.gt, order.gt);
    $("#readyChart").innerHTML = `<div class="ready-metrics"><div class="ready-metric"><span>订单 / 投用艘数比</span><b>${formatPercent(order.count / fleet.count)}</b></div><div class="ready-metric"><span>订单 / 投用GT比</span><b>${formatPercent(order.gt / fleet.gt)}</b></div></div><div class="ready-pair"><div class="ready-bar"><label><span>投用</span><b>${numberFormat.format(fleet.count)}艘</b></label><div class="track"><i style="width:${fleet.count / maxCount * 100}%"></i></div></div><div class="ready-bar"><label><span>订单</span><b>${numberFormat.format(order.count)}艘</b></label><div class="track"><i style="width:${order.count / maxCount * 100}%"></i></div></div><div class="ready-bar"><label><span>投用GT</span><b>${formatWan(fleet.gt)}万</b></label><div class="track"><i style="width:${fleet.gt / maxGt * 100}%"></i></div></div><div class="ready-bar"><label><span>订单GT</span><b>${formatWan(order.gt)}万</b></label><div class="track"><i style="width:${order.gt / maxGt * 100}%"></i></div></div></div><div class="ready-note">${escapeHtml(data.ready.note)} Ready与替代燃料能力不直接相加。</div>`;
  }

  function renderFilterStatus() {
    const parts = [state.market === "both" ? "投用＋订单" : marketName(state.market), state.metric === "count" ? "艘数" : state.metric === "gt" ? "万GT" : "艘数占比", state.fuel === "all" ? "全部燃料" : fuelLabel(state.fuel), state.ship === "all" ? "全部船型" : state.ship];
    $("#filterStatus").textContent = `当前视图：${parts.join(" · ")}`;
  }

  function renderAll() {
    renderKpis(); renderInsights(); renderFuelComparison(); renderFuelShift(); renderShipScatter(); renderShipRanking(); renderMatrix(); renderFilterStatus(); syncControls(); updateUrl();
  }

  function syncControls() {
    $$("#marketControl button").forEach((button) => button.classList.toggle("active", button.dataset.value === state.market));
    $$("#metricControl button").forEach((button) => button.classList.toggle("active", button.dataset.value === state.metric));
    $$("#matrixMarket button").forEach((button) => button.classList.toggle("active", button.dataset.value === state.matrixMarket));
    $$("#matrixMode button").forEach((button) => button.classList.toggle("active", button.dataset.value === state.matrixMode));
    $("#fuelFilter").value = state.fuel;
    $("#shipFilter").value = state.ship;
  }

  function selectFuel(value) { state.fuel = state.fuel === value ? "all" : value; renderAll(); }
  function selectShip(value) { state.ship = state.ship === value ? "all" : value; renderAll(); }

  function bindChartInteractions(node, type) {
    bindTooltips(node);
    $$(`[data-${type}]`, node).forEach((element) => element.addEventListener("click", () => type === "fuel" ? selectFuel(element.dataset.fuel) : selectShip(element.dataset.ship)));
  }

  function bindTooltips(node) {
    $$('[data-tip]', node).forEach((element) => {
      element.addEventListener("pointerenter", (event) => showTooltip(element.dataset.tip, event));
      element.addEventListener("pointermove", (event) => positionTooltip(event));
      element.addEventListener("pointerleave", hideTooltip);
    });
  }

  function showTooltip(text, event) {
    const tooltip = $("#tooltip"), [title, ...rest] = text.split("｜");
    tooltip.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(rest.join("｜"))}</span>`;
    tooltip.classList.add("show"); positionTooltip(event);
  }
  function positionTooltip(event) {
    const tooltip = $("#tooltip"), gap = 14, width = tooltip.offsetWidth || 220, height = tooltip.offsetHeight || 60;
    const left = Math.min(window.innerWidth - width - 10, event.clientX + gap), top = Math.min(window.innerHeight - height - 10, event.clientY + gap);
    tooltip.style.left = `${Math.max(10, left)}px`; tooltip.style.top = `${Math.max(10, top)}px`;
  }
  function hideTooltip() { $("#tooltip").classList.remove("show"); }

  function populateFilters() {
    const fuels = data.markets.fleet.fuels.filter((fuel) => fuel.count || data.markets.order.fuels.find((item) => item.key === fuel.key)?.count);
    $("#fuelFilter").innerHTML = '<option value="all">全部燃料</option>' + fuels.map((fuel) => `<option value="${fuel.key}">${escapeHtml(fuel.label)}</option>`).join("");
    const ships = [...new Set([...data.markets.fleet.ships, ...data.markets.order.ships].map((ship) => ship.label))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    $("#shipFilter").innerHTML = '<option value="all">全部船型</option>' + ships.map((ship) => `<option value="${escapeHtml(ship)}">${escapeHtml(ship)}</option>`).join("");
  }

  function bindControls() {
    $$("#marketControl button").forEach((button) => button.addEventListener("click", () => { state.market = button.dataset.value; renderAll(); }));
    $$("#metricControl button").forEach((button) => button.addEventListener("click", () => { state.metric = button.dataset.value; renderAll(); }));
    $$("#matrixMarket button").forEach((button) => button.addEventListener("click", () => { state.matrixMarket = button.dataset.value; renderMatrix(); syncControls(); }));
    $$("#matrixMode button").forEach((button) => button.addEventListener("click", () => { state.matrixMode = button.dataset.value; renderMatrix(); syncControls(); }));
    $("#fuelFilter").addEventListener("change", (event) => { state.fuel = event.target.value; renderAll(); });
    $("#shipFilter").addEventListener("change", (event) => { state.ship = event.target.value; renderAll(); });
    $("#resetFilters").addEventListener("click", () => { Object.assign(state, { market: "both", metric: "count", fuel: "all", ship: "all", matrixMarket: "fleet", matrixMode: "absolute" }); renderAll(); toast("筛选已重置"); });
    $("#exportCsv").addEventListener("click", exportCsv);
  }

  function exportCsv() {
    const markets = selectedMarkets(), fuels = fuelRows(), rows = [];
    for (const market of markets) {
      const ships = shipRows();
      for (const ship of ships) {
        for (const fuel of fuels) {
          const sourceShip = data.markets[market].ships.find((item) => item.label === ship.label);
          const value = sourceShip?.fuels[fuel.key] || { count: 0, gt: 0 };
          if (!value.count && !value.gt) continue;
          rows.push([marketName(market), ship.label, fuel.label, value.count, value.gt, (value.gt / 10000).toFixed(4)]);
        }
      }
    }
    const csvRows = [["市场", "船型大类", "燃料", "艘数", "GT", "万GT"], ...rows];
    const csv = "\ufeff" + csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `替代燃料船舶_${data.asOf}_${state.market}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 500); toast("当前视图CSV已生成");
  }

  function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2200); }

  function updateUrl() {
    const url = new URL(location.href); ["market", "metric", "fuel", "ship"].forEach((key) => state[key] === ({ market: "both", metric: "count", fuel: "all", ship: "all" })[key] ? url.searchParams.delete(key) : url.searchParams.set(key, state[key]));
    history.replaceState(null, "", `${url.pathname}${url.search}${location.hash}`);
  }

  function restoreUrl() {
    const params = new URLSearchParams(location.search);
    if (["both", "fleet", "order"].includes(params.get("market"))) state.market = params.get("market");
    if (["count", "gt", "share"].includes(params.get("metric"))) state.metric = params.get("metric");
    if (params.get("fuel")) state.fuel = params.get("fuel");
    if (params.get("ship")) state.ship = params.get("ship");
  }

  function bindNavigation() {
    const links = $$(".main-nav a"), sections = links.map((link) => $(link.getAttribute("href"))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
    }, { rootMargin: "-35% 0px -55% 0px", threshold: [0, .25, .6] });
    sections.forEach((section) => observer.observe(section));
  }

  async function init() {
    try {
      const response = await fetch("data/latest.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      restoreUrl(); populateFilters(); bindControls(); bindNavigation(); renderHero(); renderCombo(); renderBattery(); renderReady(); renderAll();
    } catch (error) {
      document.querySelector("main").innerHTML = `<div class="loading-error shell"><b>数据加载失败</b><p>无法读取data/latest.json。请通过HTTP服务器或GitHub Pages访问页面。</p><code>${escapeHtml(error.message)}</code></div>`;
    }
  }

  init();
})();
