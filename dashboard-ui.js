/***************************************
 * DASHBOARD UI + DRILLDOWN HANDLERS
 ****************************************/
let lastSkuSummaryData = [];
let dashboardState = JSON.parse(localStorage.getItem('jainyticDashboard')) || {};
let monthlyChart, monthlyPOChart, orderCompletionPie, skuMonthlyChart;

/*****************************************
 * UTILITY FUNCTIONS
 *****************************************/
function monthLabelFromKey(monthKey) {
    return new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/*****************************************
 * Single DOMContentLoaded handler - ✅ FIXED FOR F5 REFRESH
 *****************************************/
document.addEventListener("DOMContentLoaded", function () {
    startDigitalClock();
    
    // ✅ FIX: Reset state on hard refresh (F5/Ctrl+R)
    if (performance.navigation.type === 1 || performance.getEntriesByType('navigation')[0]?.type === 'reload') {
        localStorage.removeItem('jainyticDashboard');
        sessionStorage.clear();
        dashboardState = {};
    }
    
    renderTopSkusByDispatch(orderBookData, 15);
    
    /* ----------------------------------
     * KPI CALCULATIONS
     * ---------------------------------- */
    const financial = calculateFinancialOverview(salesBookData);
    const pendingDispatchInLakh = calculatePendingDispatch(orderBookData);
    const kpi = calculateKPIs(orderBookData, salesBookData);

    /* ----------------------------------
     * SET VALUES ON KPI CARDS
     * ---------------------------------- */
    document.getElementById("outstanding-amount").textContent = `${financial.outstandingAmountInLakh.toFixed(2)} L`;
    document.getElementById("pending-dispatch").textContent = `${pendingDispatchInLakh.toFixed(2)} L`;
    document.getElementById("ytd-sale").textContent = kpi.ytdSales.toFixed(2);
    document.getElementById("current-month-sale").textContent = `${kpi.currentMonthSales.toFixed(2)} L`;
    document.getElementById("completion-rate").textContent = kpi.completionRate.toFixed(1);
    document.getElementById("total-sku-count").textContent = kpi.totalSKU;
    document.getElementById("item-master-count").textContent = uniqueItemCodes.size;

    /* ----------------------------------
     * ✅ FIXED: Always start with All SKUs on page load
     * ---------------------------------- */
    renderAllSkusMonthlyTrend(); // ALWAYS show this first

    // Only restore SKU view if NOT a fresh reload AND state exists
    if (performance.navigation.type !== 1 && 
        dashboardState.currentView === 'sku' && 
        dashboardState.selectedSku) {
        setTimeout(() => renderSkuMonthlyChart(dashboardState.selectedSku), 300);
    }

    /*****************************************
     * SLIDE-UP DRILLDOWN POPUP HANDLER
     *****************************************/
    window.openDrilldown = function(title, columns, rows) {
        document.getElementById("drilldown-title").textContent = title;
        document.getElementById("drilldown-head").innerHTML = "<tr>" + columns.map(c => `<th>${c}</th>`).join("") + "</tr>";
        document.getElementById("drilldown-body").innerHTML = rows.map(r =>
            "<tr>" + columns.map(c => `<td align='center'>${r[c] ?? ""}</td>`).join("") + "</tr>"
        ).join("");

        const modal = document.getElementById("drilldown-modal");
        const overlay = document.getElementById("drilldown-overlay");
        overlay.style.display = "block";
        setTimeout(() => overlay.style.opacity = 1, 10);
        setTimeout(() => modal.style.bottom = "0", 20);
    };

    window.closeDrilldown = function() {
        const modal = document.getElementById("drilldown-modal");
        const overlay = document.getElementById("drilldown-overlay");
        modal.style.bottom = "-100%";
        overlay.style.opacity = 0;
        setTimeout(() => overlay.style.display = "none", 380);
    };

    /*****************************************
     * KPI CLICK EVENTS
     *****************************************/
    document.getElementById("outstanding-amount").onclick = () => {
        const today = new Date("2025-12-20");
        const rows = salesBookData
            .filter(s => new Date(s.dueDate) <= today)
            .map(s => ({
                invoiceNo: s.invoiceNo,
                date: s.date,
                dueDate: s.dueDate,
                value: s.value,
                link: s.link ? `<a href="${s.link}" target="_blank" style="color:#d32f2f;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : "",
                ponumberPdf: s.ponumberPdf ? `<a href="${s.ponumberPdf}" target="_blank" style="color:#d32f2f;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
            }));
        openDrilldown("Outstanding Invoices", ["invoiceNo","date","dueDate","value","link"], rows);
    };

    document.getElementById("pending-dispatch").onclick = () => {
        const rows = orderBookData
            .filter(o => (o.status || "").toLowerCase() === "incomplete")
            .map(o => ({
                date: o.date,
                poNumber: o.poNumber,
                jobName: o.jobName,
                orderQty: o.orderQty,
                dispQty: o.dispQty,
                status: o.status,
                value: o.value,
                poPdf: o.poPdf ? `<a href="${o.poPdf}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : "",
                link: o.link ? `<a href="${o.link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
            }));
        openDrilldown("Pending Dispatch Orders", ["date","poNumber","jobName","orderQty","dispQty","status","value","link"], rows);
    };

    document.getElementById("ytd-sale").onclick = () => {
        const rows = salesBookData.map(s => ({
            invoiceNo: s.invoiceNo,
            date: s.date,
            value: s.value,
            ponumberPdf: s.ponumberPdf ? `<a href="${s.ponumberPdf}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : "",
            link: s.link ? `<a href="${s.link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
        }));
        openDrilldown("YTD Sales", ["invoiceNo","date","value","link"], rows);
    };

    document.getElementById("current-month-sale").onclick = () => {
        const month = new Date().toISOString().slice(0,7);
        const rows = salesBookData
            .filter(s => s.date && s.date.startsWith(month))
            .map(s => ({
                invoiceNo: s.invoiceNo,
                date: s.date,
                value: s.value,
                ponumberPdf: s.ponumberPdf ? `<a href="${s.ponumberPdf}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : "",
                link: s.link ? `<a href="${s.link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
            }));
        openDrilldown(`Current Month Sales (${month})`, ["invoiceNo","date","value","link"], rows);
    };

    document.getElementById("completion-rate").onclick = () => {
        const totalOrders = orderBookData.length;
        const completedOrders = orderBookData.filter(o => (o.status || "").toLowerCase() === "complete").length;
        const rows = orderBookData.map(o => ({
            date: o.date,
            poNumber: o.poNumber,
            jobName: o.jobName,
            status: o.status,
            value: o.value,
            poPdf: o.poPdf ? `<a href="${o.poPdf}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : "",
            link: o.link ? `<a href="${o.link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
        }));
        openDrilldown(`Completion Rate (${completedOrders}/${totalOrders})`, ["date","poNumber","jobName","status","value","link"], rows);
    };

    document.getElementById("total-sku-count").onclick = () => {
        openSkuSummary();
    };

    document.getElementById("item-master-count").onclick = () => {
        const rows = itemMasterData.map(i => ({
            itemCode: i.itemCode || "",
            jobsName: i.jobsName || "",
            labelSize: i.labelSize || "",
            materialType: i.materialType || "",
            inventory: i.inventory || "",
            artworkId: i.artworkId || "",
            artworkFile: i.artworkFile ? `<a href="${i.artworkFile}" target="_blank">VIEW</a>` : ""
        }));
        openDrilldown("Item Master List", ["itemCode","jobsName","labelSize","materialType","inventory","artworkId","artworkFile"], rows);
        applyTableSlider();
    };

    const clearBtn = document.getElementById("clearSkuFilterBtn");
    clearBtn.onclick = () => clearSkuSelection();

    /*****************************************
     * CHARTS INITIALIZATION
     *****************************************/
    renderMonthlyChart();
    renderMonthlyPOTrend();
    renderOrderCompletionPie();

    const skuMonthFilter = document.getElementById("skuMonthFilter");
    skuMonthFilter.value = new Date().toISOString().slice(0, 7);
    renderSkuListByMonth(skuMonthFilter.value);
    skuMonthFilter.addEventListener("change", () => renderSkuListByMonth(skuMonthFilter.value));
});

/*****************************************
 * DIGITAL CLOCK
 *****************************************/
function startDigitalClock() {
    const clock = document.getElementById("digitalClock");
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        clock.textContent = `${hours}:${minutes}:${seconds}`;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

/*****************************************
 * ALL SKUs MONTHLY TREND (Initial Display)
 *****************************************/
function renderAllSkusMonthlyTrend() {
    dashboardState.currentView = 'all-skus';
    localStorage.setItem('jainyticDashboard', JSON.stringify(dashboardState));

    const card = document.getElementById("skuMonthlyChartCard");
    const title = document.getElementById("skuMonthlyChartTitle");

    card.style.display = "block";
    title.textContent = "All SKUs - Monthly Dispatch Trend (Click Total SKUs KPI for SKU breakdown)";

    const series = prepareAllSkusMonthlyDispatch(orderBookData);
    const ctx = document.getElementById("skuMonthlyDispatchChart").getContext("2d");

    if (skuMonthlyChart) skuMonthlyChart.destroy();

    skuMonthlyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: series.labels,
            datasets: [
                { 
                    label: "Total Dispatch Qty (All SKUs)", 
                    data: series.values, 
                    backgroundColor: "#3dd2f7" 
                },
                {
                    type: "line",
                    label: "PO Count",
                    data: series.poCounts,
                    borderColor: "#FF9800",
                    backgroundColor: "#f78008ff",
                    yAxisID: "y1",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { autoSkip: true, maxRotation: 30, minRotation: 30 } },
                y: { beginAtZero: true, position: "left", title: { display: false, text: "Dispatch Qty" } },
                y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "PO Count" } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) return `Dispatch Qty: ${context.raw.toLocaleString()}`;
                            return `PO Count: ${context.raw}`;
                        }
                    }
                },
                legend: { position: "bottom" }
            },
            onClick: (evt, elements) => {
                if (!elements.length) return;
                const index = elements[0].index;
                const monthKey = series.months[index];
                openSkuSummaryByMonth(monthKey);
            }
        }
    });

    renderAllSkusMonthlyRankList(series);
    // Removed auto-scroll to prevent jumping
}

/*****************************************
 * PREPARE DATA FOR ALL SKUs TREND
 *****************************************/
function prepareAllSkusMonthlyDispatch(orderBookData) {
    const monthMap = {};
    orderBookData.forEach(o => {
        if (!o.date || !o.dispQty) return;
        const month = o.date.slice(0, 7);
        const dispQty = Number(o.dispQty) || 0;
        const poCount = Number(o.poCount) || 1;
        if (!monthMap[month]) monthMap[month] = { dispatchQty: 0, poCount: 0 };
        monthMap[month].dispatchQty += dispQty;
        monthMap[month].poCount += poCount;
    });

    const sortedMonths = Object.keys(monthMap).sort();
    return {
        labels: sortedMonths.map(m => monthLabelFromKey(m)),
        values: sortedMonths.map(m => monthMap[m].dispatchQty),
        poCounts: sortedMonths.map(m => monthMap[m].poCount),
        months: sortedMonths
    };
}

/*****************************************
 * Drill to SKUs for specific month
 *****************************************/
function openSkuSummaryByMonth(month) {
    const data = prepareMonthlySkuSummary(orderBookData, month);
    openDrilldown(`Top SKUs - ${monthLabelFromKey(month)}`, ["sku", "dispatchQty", "poCount"], data);
}

function prepareMonthlySkuSummary(orderBookData, month) {
    const filteredData = orderBookData.filter(o => o.date && o.date.startsWith(month));
    return prepareSkuSummary(filteredData);
}

/*****************************************
 * MONTHLY SALES CHART
 *****************************************/
function renderMonthlyChart() {
    const series = prepareMonthlySalesSeries(salesBookData);
    const ctx = document.getElementById("monthlySalesChart").getContext("2d");

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
        data: {
            labels: series.labels,
            datasets: [
                { type:"bar", label:"Sales (Lakh)", data:series.sales, backgroundColor:series.barColors },
                { type:"line", label:"% Growth", data:series.growth, borderColor:"#FF9800", yAxisID:"y1", tension:.35 },
                { type:"line", label:"Cumulative", data:series.cumulative, borderColor:"#3f51b5", tension:.35 }
            ]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            scales:{ y:{beginAtZero:true}, y1:{position:"right"} },
            onClick:(e,elements)=>{
                if(!elements.length) return;
                const idx = elements[0].index;
                const month = series.months[idx];
                const rows = orderBookData
                    .filter(o => o.date && o.date.startsWith(month))
                    .map(o => ({
                        date: o.date,
                        poNumber: o.poNumber,
                        jobName: o.jobName,
                        status: o.status,
                        value: o.value,
                        link: o.link ? `<a href="${o.link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : "",
                        poPdf: o.poPdf ? `<a href="${o.poPdf}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
                    }));
                openDrilldown(`Orders - ${series.labels[idx]}`, ["date","poNumber","jobName","status","value","link"], rows);
            }
        }
    });
}

/*****************************************
 * MONTHLY PO CHART
 *****************************************/
function renderMonthlyPOTrend() {
    const po = prepareMonthlyPOSeries(orderBookData);
    const ctx = document.getElementById("monthlyPOChart").getContext("2d");

    if (monthlyPOChart) monthlyPOChart.destroy();

    monthlyPOChart = new Chart(ctx, {
        data:{
            labels: po.labels,
            datasets:[
                { type:"bar", label:"PO Count", data:po.poCount, backgroundColor:"#283593" },
                { type:"line", label:"PO Value (Lakh)", data:po.poValue, borderColor:"#5c6bc0", tension:.35, yAxisID:"y1" }
            ]
        },
        options:{
            responsive:true,
            maintainAspectRatio:true,
            scales:{ y:{beginAtZero:true}, y1:{position:"right"} },
            onClick:(_e,items)=>{
                if(!items.length) return;
                const idx = items[0].index;
                const month = po.months[idx];
                const rows = orderBookData
                    .filter(o => o.date && o.date.startsWith(month))
                    .map(o => ({
                        date: o.date,
                        poNumber: o.poNumber,
                        brand: o.brand,
                        orderQty: o.orderQty,
                        dispQty: o.dispQty,
                        status: o.status,
                        value: o.value,
                        link: o.link ? `<a href="${o.link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
                    }));
                const titleMonth = monthLabelFromKey(month);
                openDrilldown(`PO Details - ${titleMonth}`, ["date","poNumber","brand","orderQty","dispQty","status","value","link"], rows);
            }
        }
    });
}

/*****************************************
 * ORDER COMPLETION PIE CHART
 *****************************************/
function renderOrderCompletionPie() {
    const data = prepareOrderCompletionStatus(orderBookData);
    const ctx = document.getElementById("orderCompletionPie").getContext("2d");

    if (orderCompletionPie) orderCompletionPie.destroy();

    orderCompletionPie = new Chart(ctx, {
        type: "pie",
        data: {
            labels: data.labels.map((l, i) => `${l} (₹ ${data.valueLakh[i].toFixed(2)} L | ${data.poCount[i]} PO)`),
            datasets: [{
                data: data.valueLakh,
                backgroundColor: ["#2e7d32", "#c62828"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 4,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `₹ ${ctx.raw.toFixed(2)} L | ${data.poCount[ctx.dataIndex]} POs`
                    }
                }
            },
            onClick: (e, items) => {
                if (!items.length) return;
                const idx = items[0].index;
                const rows = (idx === 0 ? data.completed : data.incomplete)
                    .map(o => ({
                        date: o.date,
                        poNumber: o.poNumber,
                        brand: o.brand,
                        orderQty: o.orderQty,
                        dispQty: o.dispQty,
                        status: o.status,
                        value: o.value,
                        link: o.link ? `<a href="${o.link}" target="_blank">VIEW</a>` : ""
                    }));
                openDrilldown(`Order Status - ${data.labels[idx]}`, ["date", "poNumber", "brand", "orderQty", "dispQty", "status", "value", "link"], rows);
            }
        }
    });
}

/*****************************************
 * SKU SUMMARY DRILLDOWN
 *****************************************/
function openSkuSummary() {
    const data = prepareSkuSummary(orderBookData);
    openDrilldown("SKU Summary (Click SKU for Monthly Trend)", ["sku", "dispatchQty", "poCount"], data);

    const clearBtn = document.getElementById("clearSkuFilterBtn");
    clearBtn.style.display = "block";

    setTimeout(() => {
        const tbody = document.getElementById("drilldown-body");
        [...tbody.rows].forEach((row, idx) => {
            row.style.cursor = "pointer";
            row.onclick = () => {
                autoCloseDrilldown();
                renderSkuMonthlyChart(data[idx].sku);
            };
        });
    }, 50);
}

/*****************************************
 * CLEAR SELECTION - BACK TO ALL SKUs
 *****************************************/
function clearSkuSelection() {
    dashboardState.currentView = 'all-skus';
    localStorage.setItem('jainyticDashboard', JSON.stringify(dashboardState));

    const clearBtn = document.getElementById("clearSkuFilterBtn");
    clearBtn.style.display = "none";

    renderAllSkusMonthlyTrend();
}

/*****************************************
 * SPECIFIC SKU MONTHLY CHART
 *****************************************/
function renderSkuMonthlyChart(sku) {
    dashboardState.currentView = 'sku';
    dashboardState.selectedSku = sku;
    localStorage.setItem('jainyticDashboard', JSON.stringify(dashboardState));

    const card = document.getElementById("skuMonthlyChartCard");
    const title = document.getElementById("skuMonthlyChartTitle");

    card.style.display = "block";
    title.textContent = `Monthly Dispatch Trend - ${sku}`;

    const series = prepareSkuMonthlyDispatch(orderBookData, sku);
    const ctx = document.getElementById("skuMonthlyDispatchChart").getContext("2d");

    if (skuMonthlyChart) skuMonthlyChart.destroy();

    skuMonthlyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: series.labels,
            datasets: [{
                label: "Dispatch Quantity",
                data: series.values,
                backgroundColor: "#0e5813ff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: c => `Qty: ${c.raw.toLocaleString()}`
                    }
                }
            }
        }
    });

    renderSkuMonthlyRankList(series);
    card.scrollIntoView({ behavior: "smooth" });
}

/*****************************************
 * SKU LIST BY MONTH
 *****************************************/
function renderSkuListByMonth(month) {
    const skuMap = {};
    orderBookData
        .filter(o => o.date && (!month || o.date.startsWith(month)))
        .forEach(o => {
            const sku = o.jobName || "Unknown SKU";
            const orderQty = Number(o.orderQty) || 0;
            const dispQty = Number(o.dispQty) || 0;
            const value = Number(o.value) || 0;

            if (!skuMap[sku]) {
                skuMap[sku] = {
                    sku,
                    poCount: 0,
                    orderQty: 0,
                    dispatchQty: 0,
                    pendingQty: 0,
                    value: 0,
                    rows: []
                };
            }

            skuMap[sku].poCount += 1;
            skuMap[sku].orderQty += orderQty;
            skuMap[sku].dispatchQty += dispQty;
            skuMap[sku].pendingQty += (o.status || "").toLowerCase() === "incomplete" ? (orderQty - dispQty) : 0;
            skuMap[sku].value += value;
            skuMap[sku].rows.push(o);
        });

    const sorted = Object.values(skuMap).sort((a, b) => b.dispatchQty - a.dispatchQty);
    const tbody = document.getElementById("skuListBody");
    tbody.innerHTML = "";

    sorted.forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${s.sku}</td>
            <td align='center'>${s.poCount.toLocaleString()}</td>
            <td align='center'>${s.orderQty.toLocaleString()}</td>
            <td align='center'>${s.dispatchQty.toLocaleString()}</td>
            <td align='center'>${s.pendingQty.toLocaleString()}</td>
        `;
        tr.onclick = () => {
            const rows = s.rows.map(o => ({
                date: o.date,
                poNumber: o.poNumber,
                brand: o.brand,
                orderQty: o.orderQty,
                dispQty: o.dispQty,
                status: o.status,
                value: o.value,
                link: o.link ? `<a href="${o.link}" target="_blank">VIEW</a>` : ""
            }));
            openDrilldown(`SKU Details - ${s.sku}`, ["date", "poNumber", "brand", "orderQty", "dispQty", "status", "value", "link"], rows);
        };
        tbody.appendChild(tr);
    });
}

/*****************************************
 * TOP SKUs BY DISPATCH
 *****************************************/
function renderTopSkusByDispatch(orderBookData, limit = 20) {
    const skuMap = {};
    orderBookData.forEach(row => {
        const sku = (row.jobName || row.SKU || row.product || "").trim();
        const qty = Number(row.dispQty || 0);
        if (!sku || qty <= 0) return;
        skuMap[sku] = (skuMap[sku] || 0) + qty;
    });

    const sortedSkus = Object.entries(skuMap)
        .map(([sku, qty]) => ({ sku, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit);

    const container = document.getElementById("topSkuList");
    container.innerHTML = "";

    if (!sortedSkus.length) {
        container.innerHTML = "<p>No dispatch data available</p>";
        return;
    }

    sortedSkus.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "sku-item";
        div.innerHTML = `
            <div class="sku-rank">${index + 1}</div>
            <div class="sku-name">${item.sku}</div>
            <div class="sku-qty">${item.qty.toLocaleString()}</div>
        `;
        container.appendChild(div);
    });
}

/*****************************************
 * UTILITY FUNCTIONS
 *****************************************/
function autoCloseDrilldown() {
    const modal = document.getElementById("drilldown-modal");
    const overlay = document.getElementById("drilldown-overlay");
    if (!modal || !overlay) return;

    modal.style.bottom = "-100%";
    overlay.style.opacity = 0;
    setTimeout(() => overlay.style.display = "none", 350);
}

function applyTableSlider() {
    const slider = document.getElementById("table-width-slider");
    const tableWrapper = document.querySelector(".drilldown-table-wrapper");
    if (!slider || !tableWrapper) return;

    slider.oninput = () => {
        const scale = slider.value;
        tableWrapper.style.width = `${scale}%`;
        tableWrapper.style.overflowX = "auto";
    };
}

function renderAllSkusMonthlyRankList(series) {
    let container = document.getElementById("skuMonthlyRankList");
    if (!container) {
        container = document.createElement("div");
        container.id = "skuMonthlyRankList";
        container.style.marginTop = "15px";
        container.style.maxHeight = "260px";
        container.style.overflowY = "auto";
        container.style.borderTop = "1px solid #eee";
        document.getElementById("skuMonthlyChartCard").appendChild(container);
    }

    const rows = series.labels.map((m, i) => ({
        month: m,
        dispatchQty: series.values[i],
        poCount: series.poCounts[i]
    }));

    rows.sort((a, b) => b.dispatchQty - a.dispatchQty);

    container.innerHTML = rows.map((r, i) => `
        <div class="sku-item" style="cursor:pointer; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;"
             onclick="highlightMonthOnChart('${r.month}')">
          <span><strong>${i + 1}.</strong> ${r.month}</span>
          <span style="color: #34618fff; font-weight: 500;">${r.dispatchQty.toLocaleString()} Qty</span>
          <span style="color: #ff7300ff; margin-left: 10px;">${r.poCount} PO</span>
        </div>
    `).join("");
}

function renderSkuMonthlyRankList(series) {
    let container = document.getElementById("skuMonthlyRankList");
    if (!container) {
        container = document.createElement("div");
        container.id = "skuMonthlyRankList";
        container.style.marginTop = "15px";
        container.style.maxHeight = "260px";
        container.style.overflowY = "auto";
        container.style.borderTop = "1px solid #eee";
        document.getElementById("skuMonthlyChartCard").appendChild(container);
    }

    const rows = series.labels.map((m, i) => ({
        month: m,
        qty: series.values[i]
    }));

    rows.sort((a, b) => b.qty - a.qty);

    container.innerHTML = rows.map((r, i) => `
        <div class="sku-item" style="cursor:pointer; padding:8px 12px; border-bottom:1px solid #f0f0f0;"
             onclick="highlightMonthOnChart('${r.month}')">
          <span><strong>${i + 1}.</strong> ${r.month}</span>
          <span class="sku-qty">${r.qty.toLocaleString()}</span>
        </div>
    `).join("");
}

function highlightMonthOnChart(monthLabel) {
    if (!skuMonthlyChart) return;
    const idx = skuMonthlyChart.data.labels.indexOf(monthLabel);
    if (idx === -1) return;
    skuMonthlyChart.setActiveElements([{ datasetIndex: 0, index: idx }]);
    skuMonthlyChart.update();
}
