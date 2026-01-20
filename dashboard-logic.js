function filterDataByMonth() {
    const monthSelector = document.getElementById("monthSelector");
    const selectedMonth = monthSelector.value;
    
    if (!selectedMonth) return;
    
    const filteredSales = salesBook.filter(s => monthKey(s.date) === selectedMonth);
    const filteredOrders = orderBook.filter(o => monthKey(o.date) === selectedMonth);
    
    // Recalculate KPIs for selected month
    const kpi = calculateKPIs(filteredOrders, filteredSales);
    const pendingDispatch = calculatePendingDispatch(filteredOrders);
    const financial = calculateFinancialOverview(filteredSales);
    
    // Update UI with filtered data
    updateDashboard(kpi, pendingDispatch, financial, filteredSales, filteredOrders);
    
    return { filteredSales, filteredOrders };
}
// ===== UTIL =====
function sumBy(arr, selector) {
    return arr.reduce((s, x) => s + (selector(x) || 0), 0);
}

function monthKey(dateStr) {
    return dateStr ? dateStr.slice(0, 7) : "";
}

// ===== 1. FINANCIAL OVERVIEW =====
function calculateFinancialOverview(salesBook, todayStr = "2025-12-20") {
    const uniqueInvoices = new Set(salesBook.map(x => x.invoiceNo)).size;

    const today = new Date(todayStr);
    let outstandingAmount = 0;

    salesBook.forEach(inv => {
        const due = new Date(inv.dueDate);
        if (due <= today) outstandingAmount += (inv.value || 0);
    });

    return {
        totalInvoiceNumber: uniqueInvoices,
        outstandingAmountInLakh: outstandingAmount / 100000
    };
}

// ===== 2. PENDING DISPATCH (Option B — Remaining Value) =====
function calculatePendingDispatch(orderBook) {
    let totalRemaining = 0;

    orderBook.forEach(o => {
        if ((o.status || "").toLowerCase() === "incomplete" && o.value) {
            totalRemaining += o.value;
        }
    });

    return totalRemaining / 100000;
}

// ===== 3. KPI CALCULATIONS =====
function calculateKPIs(orderBook, salesBook) {
    const normalizedSales = salesBook.map(x => ({
        ...x,
        date: x.date ? x.date.slice(0, 10) : ""
    }));

    const ytdSales = sumBy(normalizedSales, x => x.value) / 100000;

    const uniqueMonths = new Set(
        normalizedSales.map(x => monthKey(x.date)).filter(Boolean)
    );
    const avgMonthlySale = ytdSales / (uniqueMonths.size || 1);

    const uniquePOs = new Set(orderBook.map(x => x.poNumber)).size;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    const currentMonthSales = sumBy(
        normalizedSales.filter(x => monthKey(x.date) === currentMonth),
        x => x.value
    ) / 100000;

    const totalSKU = new Set(orderBook.map(x => x.jobName)).size;

    const totalPOValue = sumBy(orderBook, x => x.value);
    const completeValue = sumBy(
        orderBook.filter(o => (o.status || "").toLowerCase() === "complete"),
        x => x.value
    );
    const completionRate = totalPOValue ? (completeValue / totalPOValue) * 100 : 0;

    return {
        ytdSales,
        avgMonthlySale,
        uniquePOs,
        currentMonthSales,
        totalSKU,
        completionRate,
        totalPOValue: totalPOValue / 100000,
        completeValue: completeValue / 100000
    };
}

// ===== 4. MONTHLY SALES SERIES =====
function prepareMonthlySalesSeries(salesBook) {
    const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"];
    const labels = [ "October 2025", "November 2025", "December 2025", "January 2026"," February 2026"];

    const sales = months.map(m =>
        sumBy(salesBook.filter(s => monthKey(s.date) === m), x => x.value) / 100000
    );

    const growth = sales.map((v, i) => i === 0 ? 0 : ((v - sales[i - 1]) / (sales[i - 1] || 1)) * 100);

    const cumulative = [];
    sales.reduce((acc, val, i) => cumulative[i] = acc + val, 0);

    const barColors = growth.map(g => g > 0 ? "#4caf50" : g < 0 ? "#f44336" : "#1a237e");

    return { labels, months, sales, growth, cumulative, barColors };
}

// ===== 5. MONTHLY PO SERIES =====
function monthLabelFromKey(monthKey) {
    const [y, m] = monthKey.split("-");
    return new Date(y, m - 1).toLocaleString("en-IN", {
        month: "long",
        year: "numeric"
    });
}

function prepareMonthlyPOSeries(orderBook) {
    const months = ["2025-10", "2025-11", "2025-12"];
    const labels = ["October 2025", "November 2025", "December 2025","January 2026"];

    const poCount = months.map(m => orderBook.filter(o => monthKey(o.date) === m && o.value).length);

    const poValue = months.map(m =>
        sumBy(orderBook.filter(o => monthKey(o.date) === m && o.value), x => x.value) / 100000
    );

    const growth = poValue.map((v, i) => i === 0 ? 0 : ((v - poValue[i - 1]) / (poValue[i - 1] || 1)) * 100);

    return { labels, months, poCount, poValue, growth };
}

// ===== 6. PRODUCT DISTRIBUTION =====
function prepareCompletionPieData(orderBook) {
    let completeValue = 0;
    let incompleteValue = 0;
    let completeCount = 0;
    let incompleteCount = 0;

    orderBook.forEach(o => {
        const status = (o.status || "").toLowerCase();
        const val = o.value || 0;

        if (status === "complete") {
            completeValue += val;
            completeCount++;
        }

        if (status === "incomplete") {
            incompleteValue += val;
            incompleteCount++;
        }
    });

    return {
        labels: ["Complete", "Incomplete"],
        values: [completeValue / 100000, incompleteValue / 100000],
        counts: [completeCount, incompleteCount]
    };
}

// ===== 7. COMPLETION =====
function prepareCompletionChartData(kpi, pendingDispatchInLakh) {
    return {
        labels: ["Total PO Value", "Complete Value", "Pending Value"],
        values: [kpi.totalPOValue, kpi.completeValue, pendingDispatchInLakh]
    };
}

// ===== 8. TOP SKUs =====
function prepareTopSKUs(orderBook, topN = 8) {
    const jobDispatchMap = {};

    orderBook.forEach(o => {
        if (!o.jobName) return;
        const qtyOrder = Number(o.orderQty) || 0;
        const qtyDisp = Number(o.dispQty) || 0;

        if (!jobDispatchMap[o.jobName]) {
            jobDispatchMap[o.jobName] = {
                jobName: o.jobName,
                brand: o.brand,
                totalOrder: 0,
                totalDispatch: 0,
                poSet: new Set()
            };
        }

        const item = jobDispatchMap[o.jobName];
        item.totalOrder += qtyOrder;
        item.totalDispatch += qtyDisp;
        item.poSet.add(o.poNumber);
    });

    const arr = Object.values(jobDispatchMap).map(x => ({
        jobName: x.jobName,
        brand: x.brand,
        totalOrder: x.totalOrder,
        totalDispatch: x.totalDispatch,
        poCount: x.poSet.size
    }));

    arr.sort((a, b) => b.totalDispatch - a.totalDispatch);

    const top = arr.slice(0, topN);
    const totalDispatchQty = arr.reduce((s, x) => s + x.totalDispatch, 0);

    return { top, totalDispatchQty };
}

function prepareOrderCompletionStatus(orderBook) {
    const completed = orderBook.filter(
        o => (o.status || "").toLowerCase() === "complete"
    );

    const incomplete = orderBook.filter(
        o => (o.status || "").toLowerCase() !== "complete"
    );

    return {
        labels: ["Completed", "Incomplete"],
        valueLakh: [
            completed.reduce((s, x) => s + (x.value || 0), 0) / 100000,
            incomplete.reduce((s, x) => s + (x.value || 0), 0) / 100000
        ],
        poCount: [
            completed.length,
            incomplete.length
        ],
        completed,
        incomplete
    };
}
// ===== UTIL =====
function sumBy(arr, selector) {
    return arr.reduce((s, x) => s + (selector(x) || 0), 0);
}

function monthKey(dateStr) {
    return dateStr ? dateStr.slice(0, 7) : "";
}

function monthLabelFromKey(monthKey) {
    const [y, m] = monthKey.split("-");
    return new Date(y, m - 1).toLocaleString("en-IN", {
        month: "long",
        year: "numeric"
    });
}

// ===== EXISTING LOGIC (UNCHANGED) =====
// (your full original logic remains as-is)

// ===== ADDITION: SKU SUMMARY =====
function prepareSkuSummary(orderBook) {
    const map = {};

    orderBook.forEach(o => {
        if (!o.jobName) return;

        const qty = Number(o.dispQty) || 0;

        if (!map[o.jobName]) {
            map[o.jobName] = {
                sku: o.jobName,
                totalDispatch: 0,
                poSet: new Set()
            };
        }

        map[o.jobName].totalDispatch += qty;
        map[o.jobName].poSet.add(o.poNumber);
    });

    return Object.values(map)
        .map(x => ({
            sku: x.sku,
            dispatchQty: x.totalDispatch,
            poCount: x.poSet.size
        }))
        .sort((a, b) => b.dispatchQty - a.dispatchQty);
}

// ===== ADDITION: SKU MONTHLY DISPATCH =====
function prepareSkuMonthlyDispatch(orderBook, sku) {
    const monthMap = {};

    orderBook
        .filter(o => o.jobName === sku)
        .forEach(o => {
            const m = monthKey(o.date);
            if (!m) return;
            monthMap[m] = (monthMap[m] || 0) + (Number(o.dispQty) || 0);
        });

    const months = Object.keys(monthMap).sort();

    return {
        labels: months.map(monthLabelFromKey),
        values: months.map(m => monthMap[m])
    };
}
/*****************************************
 * SKU vs SKU MONTHLY COMPARISON
 *****************************************/
function prepareSkuComparison(orderBook, skuA, skuB) {

    function getMonthly(sku) {
        const map = {};
        orderBook
            .filter(o => o.jobName === sku)
            .forEach(o => {
                const m = monthKey(o.date);
                map[m] = (map[m] || 0) + Number(o.dispQty || 0);
            });
        return map;
    }

    const aMap = getMonthly(skuA);
    const bMap = getMonthly(skuB);

    const months = Array.from(new Set([
        ...Object.keys(aMap),
        ...Object.keys(bMap)
    ])).sort();

    return {
        labels: months.map(monthLabelFromKey),
        aValues: months.map(m => aMap[m] || 0),
        bValues: months.map(m => bMap[m] || 0)
    };
}
const uniqueItemCodes = new Set(
    itemMasterData.map(i => i.itemCode)
);

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
