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

// In dashboard-ui.js DOMContentLoaded section, replace this part:
document.addEventListener("DOMContentLoaded", function () {
    startDigitalClock();
    renderTopSkusByDispatch(orderBookData, 15);
    
    /* ----------------------------------
    * KPI CALCULATIONS - FIXED
    * ---------------------------------- */
    const financial = calculateFinancialOverview(salesBookData);  // ✅ Fixed data name
    const pendingDispatchInLakh = calculatePendingDispatch(orderBookData);  // ✅ Fixed data name
    const kpi = calculateKPIs(orderBookData, salesBookData);  // ✅ Fixed data names

    /* ----------------------------------
    * SET VALUES ON KPI CARDS - VERIFIED
    * ---------------------------------- */
    document.getElementById("outstanding-amount").textContent = `${financial.outstandingAmountInLakh.toFixed(2)} L`;
    document.getElementById("pending-dispatch").textContent = `${pendingDispatchInLakh.toFixed(2)} L`;
    document.getElementById("ytd-sale").textContent = kpi.ytdSales.toFixed(2);  // ✅ FIXED
    document.getElementById("current-month-sale").textContent = `${kpi.currentMonthSales.toFixed(2)} L`;  // ✅ FIXED
    document.getElementById("completion-rate").textContent = kpi.completionRate.toFixed(1);
    document.getElementById("total-sku-count").textContent = kpi.totalSKU;
    document.getElementById("item-master-count").textContent = itemMasterData ? itemMasterData.length : 0;
    

    /* ----------------------------------
    * ✅ SHOW ALL SKUs TREND ON INITIAL LOAD + RESTORE STATE
    * ---------------------------------- */
    if (dashboardState.currentView === 'sku' && dashboardState.selectedSku) {
        setTimeout(() => renderSkuMonthlyChart(dashboardState.selectedSku), 300);
    } else {
        renderAllSkusMonthlyTrend();  // Show total SKUs trend first
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
    * KPI CLICK EVENTS - UPDATED COLUMN NAMES
    *****************************************/
    document.getElementById("outstanding-amount").onclick = () => {
        const today = new Date("2025-12-20");
        const rows = salesBookData
            .filter(s => new Date(s.Due_Date) <= today)
            .map(s => ({
                Invoice_No: s.Invoice_No,
                Date: s.Date,
                Due_Date: s.Due_Date,
                Value: s.Value,
                Link: s.Link ? `<a href="${s.Link}" target="_blank" style="color:#d32f2f;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
            }));
        openDrilldown("Outstanding Invoices", ["Invoice_No","Date","Due_Date","Value","Link"], rows);
    };

    document.getElementById("pending-dispatch").onclick = () => {
        const rows = orderBookData
            .filter(o => (o.Status || "").toLowerCase() === "incomplete")
            .map(o => ({
                Login_Date: o.Login_Date,
                PO_Number: o.PO_Number,
                Job_Name: o.Job_Name,
                Order_Qty: o.Order_Qty,
                Dispatch_Qty: o.Dispatch_Qty,
                Status: o.Status,
                Value: o.Value,
                Link: o.Link ? `<a href="${o.Link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
            }));
        openDrilldown("Pending Dispatch Orders", ["Login_Date","PO_Number","Job_Name","Order_Qty","Dispatch_Qty","Status","Value","Link"], rows);
    };

    document.getElementById("ytd-sale").onclick = () => {
        const rows = salesBookData.map(s => ({
            Invoice_No: s.Invoice_No,
            Date: s.Date,
            Value: s.Value,
            Link: s.Link ? `<a href="${s.Link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
        }));
        openDrilldown("YTD Sales", ["Invoice_No","Date","Value","Link"], rows);
    };

    document.getElementById("current-month-sale").onclick = () => {
        const month = new Date().toISOString().slice(0,7);
        const rows = salesBookData
            .filter(s => s.Date && s.Date.startsWith(month))
            .map(s => ({
                Invoice_No: s.Invoice_No,
                Date: s.Date,
                Value: s.Value,
                Link: s.Link ? `<a href="${s.Link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
            }));
        openDrilldown(`Current Month Sales (${month})`, ["Invoice_No","Date","Value","Link"], rows);
    };

    document.getElementById("completion-rate").onclick = () => {
        const totalOrders = orderBookData.length;
        const completedOrders = orderBookData.filter(o => (o.Status || "").toLowerCase() === "complete").length;
        const rows = orderBookData.map(o => ({
            Login_Date: o.Login_Date,
            PO_Number: o.PO_Number,
            Job_Name: o.Job_Name,
            Status: o.Status,
            Value: o.Value,
            Link: o.Link ? `<a href="${o.Link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
        }));
        openDrilldown(`Completion Rate (${completedOrders}/${totalOrders})`, ["Login_Date","PO_Number","Job_Name","Status","Value","Link"], rows);
    };

    document.getElementById("total-sku-count").onclick = () => {
        openSkuSummary();
    };

    document.getElementById("item-master-count").onclick = () => {
        const rows = itemMasterData.map(i => ({
            Item_Code: i.Item_Code || "",
            Jobs_Name: i.Jobs_Name || "",
            Label_Size: i.Label_Size || "",
            Material_Type: i.Material_Type || "",
            Inventory: i.Inventory || "",
            Artwork_ID: i.Artwork_ID || "",
            Artwork_file: i.Artwork_file ? `<a href="${i.Artwork_file}" target="_blank">VIEW</a>` : ""
        }));
        openDrilldown("Item Master List", ["Item_Code","Jobs_Name","Label_Size","Material_Type","Inventory","Artwork_ID","Artwork_file"], rows);
        applyTableSlider();
    };

    const clearBtn = document.getElementById("clearSkuFilterBtn");
    if (clearBtn) clearBtn.onclick = () => clearSkuSelection();

    /*****************************************
    * CHARTS INITIALIZATION
    *****************************************/
    renderMonthlyChart();
    renderMonthlyPOTrend();
    renderOrderCompletionPie();

    const skuMonthFilter = document.getElementById("skuMonthFilter");
    if (skuMonthFilter) {
        skuMonthFilter.value = new Date().toISOString().slice(0, 7);
        renderSkuListByMonth(skuMonthFilter.value);
        skuMonthFilter.addEventListener("change", () => renderSkuListByMonth(skuMonthFilter.value));
    }
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
                y: { beginAtZero: true, position: "left", title: { display: true, text: "Dispatch Qty" } },
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
    card.scrollIntoView({ behavior: "smooth" });
}

/*****************************************
* PREPARE DATA FOR ALL SKUs TREND - FIXED COLUMNS
*****************************************/
function prepareAllSkusMonthlyDispatch(orderBookData) {
    const monthMap = {};
    orderBookData.forEach(o => {
        if (!o.Login_Date || !o.Dispatch_Qty) return;
        const month = o.Login_Date.slice(0, 7);
        const dispQty = Number(o.Dispatch_Qty) || 0;
        if (!monthMap[month]) monthMap[month] = { Dispatch_Qty: 0, poCount: 0 };
        monthMap[month].Dispatch_Qty += dispQty;
        monthMap[month].poCount += 1;
    });

    const sortedMonths = Object.keys(monthMap).sort();
    return {
        labels: sortedMonths.map(m => monthLabelFromKey(m)),
        values: sortedMonths.map(m => monthMap[m].Dispatch_Qty),
        poCounts: sortedMonths.map(m => monthMap[m].poCount),
        months: sortedMonths
    };
}

/*****************************************
* Drill to SKUs for specific month
*****************************************/
function openSkuSummaryByMonth(month) {
    const data = prepareMonthlySkuSummary(orderBookData, month);
    openDrilldown(`Top SKUs - ${monthLabelFromKey(month)}`, ["sku", "Dispatch_Qty", "poCount"], data);
}

function prepareMonthlySkuSummary(orderBookData, month) {
    const filteredData = orderBookData.filter(o => o.Login_Date && o.Login_Date.startsWith(month));
    return prepareSkuSummary(filteredData);
}

/*****************************************
* MONTHLY SALES CHART - FIXED COLUMNS
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
                    .filter(o => o.Login_Date && o.Login_Date.startsWith(month))
                    .map(o => ({
                        Login_Date: o.Login_Date,
                        PO_Number: o.PO_Number,
                        Job_Name: o.Job_Name,
                        Status: o.Status,
                        Value: o.Value,
                        Link: o.Link ? `<a href="${o.Link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
                    }));
                openDrilldown(`Orders - ${series.labels[idx]}`, ["Login_Date","PO_Number","Job_Name","Status","Value","Link"], rows);
            }
        }
    });
}

/*****************************************
* MONTHLY PO CHART - FIXED COLUMNS
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
                    .filter(o => o.Login_Date && o.Login_Date.startsWith(month))
                    .map(o => ({
                        Login_Date: o.Login_Date,
                        PO_Number: o.PO_Number,
                        Job_Name: o.Job_Name,
                        Status: o.Status,
                        Value: o.Value,
                        Dispatch_Qty: o.Dispatch_Qty,
                        Link: o.Link ? `<a href="${o.Link}" target="_blank" style="color:#1a237e;text-decoration:underline;font-weight:600;">DOWNLOAD</a>` : ""
                    }));
                const titleMonth = monthLabelFromKey(month);
                openDrilldown(`PO Details - ${titleMonth}`, ["Login_Date","PO_Number","Job_Name","Status","Value","Dispatch_Qty","Link"], rows);
            }
        }
    });
}

/*****************************************
* ORDER COMPLETION PIE CHART - FIXED COLUMNS
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
                        Login_Date: o.Login_Date,
                        PO_Number: o.PO_Number,
                        Job_Name: o.Job_Name,
                        Status: o.Status,
                        Value: o.Value,
                        Link: o.Link ? `<a href="${o.Link}" target="_blank">VIEW</a>` : ""
                    }));
                openDrilldown(`Order Status - ${data.labels[idx]}`, ["Login_Date", "PO_Number", "Job_Name", "Status", "Value", "Link"], rows);
            }
        }
    });
}

/*****************************************
* SKU SUMMARY DRILLDOWN - FIXED COLUMNS
*****************************************/
function openSkuSummary() {
    const data = prepareSkuSummary(orderBookData);
    openDrilldown("SKU Summary (Click SKU for Monthly Trend)", ["sku", "Dispatch_Qty", "poCount"], data);

    const clearBtn = document.getElementById("clearSkuFilterBtn");
    if (clearBtn) clearBtn.style.display = "block";

    setTimeout(() => {
        const tbody = document.getElementById("drilldown-body");
        if (tbody) {
            [...tbody.rows].forEach((row, idx) => {
                row.style.cursor = "pointer";
                row.onclick = () => {
                    autoCloseDrilldown();
                    renderSkuMonthlyChart(data[idx].sku);
                };
            });
        }
    }, 50);
}

/*****************************************
* CLEAR SELECTION - BACK TO ALL SKUs
*****************************************/
function clearSkuSelection() {
    dashboardState.currentView = 'all-skus';
    localStorage.setItem('jainyticDashboard', JSON.stringify(dashboardState));

    const clearBtn = document.getElementById("clearSkuFilterBtn");
    if (clearBtn) clearBtn.style.display = "none";

    renderAllSkusMonthlyTrend();
}

/*****************************************
* SPECIFIC SKU MONTHLY CHART - FIXED COLUMNS
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
* SKU LIST BY MONTH - FIXED COLUMNS
*****************************************/
function renderSkuListByMonth(month) {
    const skuMap = {};
    orderBookData
        .filter(o => o.Login_Date && (!month || o.Login_Date.startsWith(month)))
        .forEach(o => {
            const sku = o.Job_Name || "Unknown SKU";
            const orderQty = Number(o.Order_Qty) || 0;
            const dispQty = Number(o.Dispatch_Qty) || 0;
            const value = Number(o.Value) || 0;

            if (!skuMap[sku]) {
                skuMap[sku] = {
                    sku,
                    poCount: 0,
                    Order_Qty: 0,
                    Dispatch_Qty: 0,
                    pendingQty: 0,
                    Value: 0,
                    rows: []
                };
            }

            skuMap[sku].poCount += 1;
            skuMap[sku].Order_Qty += orderQty;
            skuMap[sku].Dispatch_Qty += dispQty;
            skuMap[sku].pendingQty += (o.Status || "").toLowerCase() === "incomplete" ? (orderQty - dispQty) : 0;
            skuMap[sku].Value += value;
            skuMap[sku].rows.push(o);
        });

    const sorted = Object.values(skuMap).sort((a, b) => b.Dispatch_Qty - a.Dispatch_Qty);
    const tbody = document.getElementById("skuListBody");
    if (tbody) tbody.innerHTML = "";

    sorted.forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${s.sku}</td>
            <td align='center'>${s.poCount.toLocaleString()}</td>
            <td align='center'>${s.Order_Qty.toLocaleString()}</td>
            <td align='center'>${s.Dispatch_Qty.toLocaleString()}</td>
            <td align='center'>${s.pendingQty.toLocaleString()}</td>
        `;
        tr.onclick = () => {
            const rows = s.rows.map(o => ({
                Login_Date: o.Login_Date,
                PO_Number: o.PO_Number,
                Job_Name: o.Job_Name,
                Status: o.Status,
                Value: o.Value,
                Link: o.Link ? `<a href="${o.Link}" target="_blank">VIEW</a>` : ""
            }));
            openDrilldown(`SKU Details - ${s.sku}`, ["Login_Date", "PO_Number", "Job_Name", "Status", "Value", "Link"], rows);
        };
        if (tbody) tbody.appendChild(tr);
    });
}

/*****************************************
* TOP SKUs BY DISPATCH - FIXED COLUMNS
*****************************************/
function renderTopSkusByDispatch(orderBookData, limit = 20) {
    const skuMap = {};
    orderBookData.forEach(row => {
        const sku = (row.Job_Name || row.Brand || "Unknown SKU").trim();
        const qty = Number(row.Dispatch_Qty || 0);
        if (!sku || qty <= 0) return;
        skuMap[sku] = (skuMap[sku] || 0) + qty;
    });

    const sortedSkus = Object.entries(skuMap)
        .map(([sku, qty]) => ({ sku, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit);

    const container = document.getElementById("topSkuList");
    if (!container) return;

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
        const card = document.getElementById("skuMonthlyChartCard");
        if (card) card.appendChild(container);
    }

    const rows = series.labels.map((m, i) => ({
        month: m,
        Dispatch_Qty: series.values[i],
        poCount: series.poCounts[i]
    }));

    rows.sort((a, b) => b.Dispatch_Qty - a.Dispatch_Qty);

    container.innerHTML = rows.map((r, i) => `
        <div class="sku-item" style="cursor:pointer; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;"
             onclick="highlightMonthOnChart('${r.month}')">
          <span><strong>${i + 1}.</strong> ${r.month}</span>
          <span style="color: #34618fff; font-weight: 500;">${r.Dispatch_Qty.toLocaleString()} Qty</span>
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
        const card = document.getElementById("skuMonthlyChartCard");
        if (card) card.appendChild(container);
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
