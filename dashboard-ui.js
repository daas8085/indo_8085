// ===== UTIL FUNCTIONS =====
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

// Global unique item codes for KPI display
const uniqueItemCodes = itemMasterData ? new Set(itemMasterData.map(i => i.Item_Code)) : new Set();

// ===== 1. FILTER DATA BY MONTH =====
function filterDataByMonth() {
    const monthSelector = document.getElementById("monthSelector");
    const selectedMonth = monthSelector ? monthSelector.value : "";
    
    if (!selectedMonth) return;
    
    const filteredSales = salesBookData.filter(s => monthKey(s.Date) === selectedMonth);
    const filteredOrders = orderBookData.filter(o => monthKey(o.Login_Date) === selectedMonth);
    
    // Recalculate KPIs for selected month
    const kpi = calculateKPIs(filteredOrders, filteredSales);
    const pendingDispatch = calculatePendingDispatch(filteredOrders);
    const financial = calculateFinancialOverview(filteredSales);
    
    // Update UI with filtered data
    updateDashboard(kpi, pendingDispatch, financial, filteredSales, filteredOrders);
    
    return { filteredSales, filteredOrders };
}

// ===== 2. FINANCIAL OVERVIEW - FIXED COLUMNS =====
function calculateFinancialOverview(salesBookData, todayStr = "2025-12-20") {
    const uniqueInvoices = new Set(salesBookData.map(x => x.Invoice_No)).size;

    const today = new Date(todayStr);
    let outstandingAmount = 0;

    salesBookData.forEach(inv => {
        const due = new Date(inv.Due_Date);
        if (due <= today) outstandingAmount += (inv.Value || 0);
    });

    return {
        totalInvoiceNumber: uniqueInvoices,
        outstandingAmountInLakh: outstandingAmount / 100000
    };
}

// ===== 3. PENDING DISPATCH - FIXED COLUMNS =====
function calculatePendingDispatch(orderBookData) {
    let totalRemaining = 0;

    orderBookData.forEach(o => {
        if ((o.Status || "").toLowerCase() === "incomplete" && o.Value) {
            totalRemaining += o.Value;
        }
    });

    return totalRemaining / 100000;
}

// ===== 4. KPI CALCULATIONS - FIXED COLUMNS =====
function calculateKPIs(orderBookData, salesBookData) {
    const normalizedSales = salesBookData.map(x => ({
        ...x,
        Date: x.Date ? x.Date.slice(0, 10) : ""
    }));

    const ytdSales = sumBy(normalizedSales, x => x.Value) / 100000;

    const uniqueMonths = new Set(
        normalizedSales.map(x => monthKey(x.Date)).filter(Boolean)
    );
    const avgMonthlySale = ytdSales / (uniqueMonths.size || 1);

    const uniquePOs = new Set(orderBookData.map(x => x.PO_Number)).size;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    const currentMonthSales = sumBy(
        normalizedSales.filter(x => monthKey(x.Date) === currentMonth),
        x => x.Value
    ) / 100000;

    const totalSKU = new Set(orderBookData.map(x => x.Job_Name)).size;

    const totalPOValue = sumBy(orderBookData, x => x.Value);
    const completeValue = sumBy(
        orderBookData.filter(o => (o.Status || "").toLowerCase() === "complete"),
        x => x.Value
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

// ===== 5. MONTHLY SALES SERIES - FIXED COLUMNS =====
function prepareMonthlySalesSeries(salesBookData) {
    const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"];
    const labels = ["October 2025", "November 2025", "December 2025", "January 2026", "February 2026"];

    const sales = months.map(m =>
        sumBy(salesBookData.filter(s => monthKey(s.Date) === m), x => x.Value) / 100000
    );

    const growth = sales.map((v, i) => i === 0 ? 0 : ((v - sales[i - 1]) / (sales[i - 1] || 1)) * 100);

    const cumulative = [];
    sales.reduce((acc, val, i) => cumulative[i] = acc + val, 0);

    const barColors = growth.map(g => g > 0 ? "#4caf50" : g < 0 ? "#f44336" : "#1a237e");

    return { labels, months, sales, growth, cumulative, barColors };
}

// ===== 6. MONTHLY PO SERIES - FIXED COLUMNS =====
function prepareMonthlyPOSeries(orderBookData) {
    const months = ["2025-10", "2025-11", "2025-12", "2026-01"];
    const labels = ["October 2025", "November 2025", "December 2025", "January 2026"];

    const PO_Count = months.map(m => orderBookData.filter(o => monthKey(o.Login_Date) === m && o.Value).length);

    const poValue = months.map(m =>
        sumBy(orderBookData.filter(o => monthKey(o.Login_Date) === m && o.Value), x => x.Value) / 100000
    );

    const growth = poValue.map((v, i) => i === 0 ? 0 : ((v - poValue[i - 1]) / (poValue[i - 1] || 1)) * 100);

    return { labels, months, PO_Count, poValue, growth };
}

// ===== 7. ORDER COMPLETION STATUS - FIXED COLUMNS =====
function prepareOrderCompletionStatus(orderBookData) {
    const completed = orderBookData.filter(
        o => (o.Status || "").toLowerCase() === "complete"
    );

    const incomplete = orderBookData.filter(
        o => (o.Status || "").toLowerCase() !== "complete"
    );

    return {
        labels: ["Completed", "Incomplete"],
        valueLakh: [
            completed.reduce((s, x) => s + (x.Value || 0), 0) / 100000,
            incomplete.reduce((s, x) => s + (x.Value || 0), 0) / 100000
        ],
        PO_Count: [
            completed.length,
            incomplete.length
        ],
        completed,
        incomplete
    };
}

// ===== 8. TOP SKUs PREPARATION - FIXED COLUMNS =====
function prepareTopSKUs(orderBookData, topN = 8) {
    const jobDispatchMap = {};

    orderBookData.forEach(o => {
        if (!o.Job_Name) return;
        const qtyOrder = Number(o.Order_Qty) || 0;
        const qtyDisp = Number(o.Dispatch_Qty) || 0;

        if (!jobDispatchMap[o.Job_Name]) {
            jobDispatchMap[o.Job_Name] = {
                Job_Name: o.Job_Name,
                Brand: o.Brand,
                totalOrder: 0,
                totalDispatch: 0,
                poSet: new Set()
            };
        }

        const item = jobDispatchMap[o.Job_Name];
        item.totalOrder += qtyOrder;
        item.totalDispatch += qtyDisp;
        item.poSet.add(o.PO_Number);
    });

    const arr = Object.values(jobDispatchMap).map(x => ({
        Job_Name: x.Job_Name,
        Brand: x.Brand,
        totalOrder: x.totalOrder,
        totalDispatch: x.totalDispatch,
        PO_Count: x.poSet.size
    }));

    arr.sort((a, b) => b.totalDispatch - a.totalDispatch);

    const top = arr.slice(0, topN);
    const totalDispatchQty = arr.reduce((s, x) => s + x.totalDispatch, 0);

    return { top, totalDispatchQty };
}

// ===== 9. SKU SUMMARY - FIXED COLUMNS =====
function prepareSkuSummary(orderBookData) {
    const map = {};

    orderBookData.forEach(o => {
        if (!o.Job_Name) return;

        const qty = Number(o.Dispatch_Qty) || 0;

        if (!map[o.Job_Name]) {
            map[o.Job_Name] = {
                sku: o.Job_Name,
                totalDispatch: 0,
                poSet: new Set()
            };
        }

        map[o.Job_Name].totalDispatch += qty;
        map[o.Job_Name].poSet.add(o.PO_Number);
    });

    return Object.values(map)
        .map(x => ({
            sku: x.sku,
            Dispatch_Qty: x.totalDispatch,
            PO_Count: x.poSet.size
        }))
        .sort((a, b) => b.Dispatch_Qty - a.Dispatch_Qty);
}

// ===== 10. SKU MONTHLY DISPATCH - FIXED COLUMNS =====
function prepareSkuMonthlyDispatch(orderBookData, sku) {
    const monthMap = {};

    orderBookData
        .filter(o => o.Job_Name === sku)
        .forEach(o => {
            const m = monthKey(o.Login_Date);
            if (!m) return;
            monthMap[m] = (monthMap[m] || 0) + (Number(o.Dispatch_Qty) || 0);
        });

    const months = Object.keys(monthMap).sort();

    return {
        labels: months.map(monthLabelFromKey),
        values: months.map(m => monthMap[m])
    };
}

// ===== 11. ALL SKUs MONTHLY DISPATCH - FIXED COLUMNS =====
function prepareAllSkusMonthlyDispatch(orderBookData) {
    const monthMap = {};
    orderBookData.forEach(o => {
        if (!o.Login_Date || !o.Dispatch_Qty) return;
        const month = o.Login_Date.slice(0, 7);
        const dispQty = Number(o.Dispatch_Qty) || 0;
        if (!monthMap[month]) monthMap[month] = { Dispatch_Qty: 0, PO_Count: 0 };
        monthMap[month].Dispatch_Qty += dispQty;
        monthMap[month].PO_Count += 1;
    });

    const sortedMonths = Object.keys(monthMap).sort();
    return {
        labels: sortedMonths.map(m => monthLabelFromKey(m)),
        values: sortedMonths.map(m => monthMap[m].Dispatch_Qty),
        PO_Counts: sortedMonths.map(m => monthMap[m].PO_Count),
        months: sortedMonths
    };
}

// ===== 12. SKU vs SKU COMPARISON - FIXED COLUMNS =====
function prepareSkuComparison(orderBookData, skuA, skuB) {
    function getMonthly(sku) {
        const map = {};
        orderBookData
            .filter(o => o.Job_Name === sku)
            .forEach(o => {
                const m = monthKey(o.Login_Date);
                map[m] = (map[m] || 0) + Number(o.Dispatch_Qty || 0);
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

// ===== 13. TABLE SLIDER =====
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

// ===== 14. UPDATE DASHBOARD (STUB - Customize as needed) =====
function updateDashboard(kpi, pendingDispatch, financial, filteredSales, filteredOrders) {
    // Update KPI displays
    document.getElementById("ytd-sale").textContent = kpi.ytdSales.toFixed(2);
    document.getElementById("current-month-sale").textContent = `${kpi.currentMonthSales.toFixed(2)} L`;
    document.getElementById("completion-rate").textContent = kpi.completionRate.toFixed(1);
    document.getElementById("pending-dispatch").textContent = `${pendingDispatch.toFixed(2)} L`;
    // Add more UI updates as needed
}
