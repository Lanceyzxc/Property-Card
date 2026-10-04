const REPORT_DEPARTMENTS = ['MAIN', 'COTT', 'CFAST', 'CCMS', 'COED', 'ENTIENZA', 'CBPA', 'CANR', 'COENG', 'CAS'];
const BREAKDOWN_VISIBLE_LIMIT = 8;
const REPORT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA1q2b0fyIidVRspGg31_xF_vpOu8dYRug',
  authDomain: 'ucn-property-tag-b7e0a.firebaseapp.com',
  projectId: 'ucn-property-tag-b7e0a',
  storageBucket: 'ucn-property-tag-b7e0a.firebasestorage.app',
  messagingSenderId: '252936858515',
  appId: '1:252936858515:web:3026ba3bfdb080949ad666',
  measurementId: 'G-TSRG9YCCHN'
};

let reportRecords = [];
let reportDepartment = '';

function normalizeReportDepartment(value) {
  const department = String(value || '').trim().toUpperCase();
  if (department === 'GASS') return 'MAIN';
  return department === 'IABD' ? 'ENTIENZA' : department;
}

function isMainReportDepartment() {
  return normalizeReportDepartment(reportDepartment) === 'MAIN';
}

function cleanReportText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function getRecordDepartment(record) {
  const explicitDepartment = record.dept || record.department || record.office;
  if (explicitDepartment) return normalizeReportDepartment(explicitDepartment);
  const color = String(record.color || '').toLowerCase();
  const colors = ['#9a0603', '#8c52ff', '#38b6ff', '#737373', '#004aad', '#ff751f', '#faf901', '#499632', '#ffde59', '#ff3131'];
  const colorIndex = colors.indexOf(color);
  return colorIndex < 0 ? 'UNASSIGNED' : REPORT_DEPARTMENTS[colorIndex];
}

function parseAcquisitionDate(value) {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const timestampDate = value.toDate();
    return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = cleanReportText(value);
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) return parsed;
    return null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCost(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = cleanReportText(value);
  if (!text) return 0;
  const isNegative = /^\(.*\)$/.test(text);
  const numeric = Number(text.replace(/[₱,$\s,()]/g, '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  return isNegative ? -Math.abs(numeric) : numeric;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
}

function populateReportFilters(records) {
  const departmentSelect = document.getElementById('department-filter');
  const yearSelect = document.getElementById('year-filter');
  const selectedDepartment = departmentSelect.value;
  const selectedYear = yearSelect.value;
  const departments = [...new Set(records.map(getRecordDepartment).filter(Boolean))].sort();
  const years = [...new Set(records.map(record => parseAcquisitionDate(record.dateAcquired)?.getFullYear()).filter(Boolean))].sort((left, right) => right - left);

  departmentSelect.innerHTML = '<option value="ALL">All departments</option>';
  if (isMainReportDepartment()) {
    departments.forEach(department => departmentSelect.add(new Option(department, department)));
    departmentSelect.closest('label').hidden = false;
  } else {
    departmentSelect.closest('label').hidden = true;
  }
  if ([...departmentSelect.options].some(option => option.value === selectedDepartment)) departmentSelect.value = selectedDepartment;

  yearSelect.innerHTML = '<option value="ALL">All years</option>';
  years.forEach(year => yearSelect.add(new Option(String(year), String(year))));
  if ([...yearSelect.options].some(option => option.value === selectedYear)) yearSelect.value = selectedYear;
}

function getFilteredReportRecords() {
  const selectedDepartment = document.getElementById('department-filter').value;
  const selectedYear = document.getElementById('year-filter').value;
  return reportRecords.filter(record => {
    if (selectedDepartment !== 'ALL' && getRecordDepartment(record) !== selectedDepartment) return false;
    if (selectedYear !== 'ALL' && String(parseAcquisitionDate(record.dateAcquired)?.getFullYear() || '') !== selectedYear) return false;
    return true;
  });
}

function summarizeRecords(records) {
  let quantity = 0;
  let acquisitionValue = 0;
  const byDepartment = new Map();
  const byYear = new Map();
  const bySupplier = new Map();
  const byFund = new Map();
  const byRequestor = new Map();

  records.forEach(record => {
    const department = getRecordDepartment(record) || 'UNASSIGNED';
    const date = parseAcquisitionDate(record.dateAcquired);
    const departmentSummary = byDepartment.get(department) || { department, records: 0, quantity: 0, value: 0, latestDate: null };
    const recordQuantity = Math.max(0, Number.parseFloat(record.quantity) || 1);
    const cost = parseCost(record.acquisitionCost);
    addBreakdownEntry(bySupplier, record.supplier, recordQuantity, cost);
    addBreakdownEntry(byFund, record.fund || record.fundCluster, recordQuantity, cost);
    addBreakdownEntry(byRequestor, record.requestedBy || record.requestor || record.requestedByName, recordQuantity, cost);
    departmentSummary.records += 1;
    departmentSummary.quantity += recordQuantity;
    departmentSummary.value += cost;
    if (date && (!departmentSummary.latestDate || date > departmentSummary.latestDate)) departmentSummary.latestDate = date;
    byDepartment.set(department, departmentSummary);

    quantity += recordQuantity;
    acquisitionValue += cost;
    if (date) {
      const year = date.getFullYear();
      const yearSummary = byYear.get(year) || { year, count: 0, value: 0 };
      yearSummary.count += 1;
      yearSummary.value += cost;
      byYear.set(year, yearSummary);
    }
  });

  return {
    quantity,
    acquisitionValue,
    byDepartment: [...byDepartment.values()].sort((left, right) => right.records - left.records || left.department.localeCompare(right.department)),
    bySupplier: sortBreakdownEntries(bySupplier),
    byFund: sortBreakdownEntries(byFund),
    byRequestor: sortBreakdownEntries(byRequestor),
    byYear: [...byYear.values()].sort((left, right) => left.year - right.year)
  };
}

function addBreakdownEntry(groups, label, quantity, value) {
  const name = cleanReportText(label) || 'Not recorded';
  const summary = groups.get(name) || { name, records: 0, quantity: 0, value: 0 };
  summary.records += 1;
  summary.quantity += quantity;
  summary.value += value;
  groups.set(name, summary);
}

function sortBreakdownEntries(groups) {
  return [...groups.values()].sort((left, right) => right.records - left.records || left.name.localeCompare(right.name));
}

function renderBreakdownTable(tableId, toggleId, summaryId, label, summaries) {
  const table = document.getElementById(tableId);
  const toggle = document.getElementById(toggleId);
  const summaryText = document.getElementById(summaryId);
  const isExpanded = toggle.dataset.expanded === 'true';
  const visibleSummaries = isExpanded ? summaries : summaries.slice(0, BREAKDOWN_VISIBLE_LIMIT);
  const maxRecords = Math.max(...summaries.map(summary => summary.records), 1);
  const totalRecords = summaries.reduce((total, summary) => total + summary.records, 0);

  if (!summaries.length) {
    table.innerHTML = '<tr><td colspan="4" class="table-empty">No records match these filters.</td></tr>';
  } else {
    table.innerHTML = visibleSummaries.map((summary, index) => {
      const share = summary.records / maxRecords * 100;
      return `<tr><td class="breakdown-name" title="${escapeReportHtml(summary.name)}"><span class="rank-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeReportHtml(summary.name)}</span></td><td class="breakdown-record-count"><strong>${formatNumber(summary.records)}</strong><span class="rank-track" aria-label="${Math.round(share)} percent of highest record count"><i style="width:${share}%"></i></span></td><td>${formatNumber(summary.quantity)}</td><td class="breakdown-value">${formatCurrency(summary.value)}</td></tr>`;
    }).join('');
  }

  const totalAssets = summaries.reduce((total, summary) => total + summary.quantity, 0);
  summaryText.textContent = `${formatNumber(summaries.length)} ${label} · ${formatNumber(totalRecords)} records · ${formatNumber(totalAssets)} assets`;
  toggle.hidden = summaries.length <= BREAKDOWN_VISIBLE_LIMIT;
  toggle.textContent = isExpanded ? 'Show top entries' : `View all ${label} (${formatNumber(summaries.length)})`;
}

function renderDepartmentChart(summaries) {
  const chart = document.getElementById('department-chart');
  if (!summaries.length) {
    chart.innerHTML = '<div class="chart-empty">No records match these filters.</div>';
    return;
  }
  const largestCount = Math.max(...summaries.map(summary => summary.records), 1);
  const largestValue = Math.max(...summaries.map(summary => Math.max(summary.value, 0)), 1);
  chart.innerHTML = summaries.map(summary => `
    <div class="department-row">
      <span class="department-name" title="${escapeReportHtml(summary.department)}">${escapeReportHtml(summary.department)}</span>
      <div class="bar-pair" aria-hidden="true">
        <div class="bar-track"><div class="bar-fill records" style="width:${summary.records / largestCount * 100}%"></div></div>
        <div class="bar-track"><div class="bar-fill value" style="width:${Math.max(summary.value, 0) / largestValue * 100}%"></div></div>
      </div>
      <span class="department-stats"><strong>${formatNumber(summary.records)} records</strong><span>${formatCurrency(summary.value)}</span></span>
    </div>`).join('');
}

function renderYearChart(yearSummaries) {
  const chart = document.getElementById('year-chart');
  if (!yearSummaries.length) {
    chart.innerHTML = '<div class="chart-empty">No dated records match these filters.</div>';
    return;
  }
  const visibleYears = yearSummaries.slice(-7);
  const chartWidth = 720;
  const chartHeight = 230;
  const plot = { left: 54, right: 658, top: 20, bottom: 183 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxCount = getChartScaleMax(Math.max(...visibleYears.map(summary => summary.count), 1));
  const maxValue = getChartScaleMax(Math.max(...visibleYears.map(summary => summary.value), 1));
  const yForCount = count => plot.bottom - count / maxCount * plotHeight;
  const yForValue = value => plot.bottom - Math.max(0, value) / maxValue * plotHeight;
  const xForYear = index => visibleYears.length === 1
    ? plot.left + plotWidth / 2
    : plot.left + index * plotWidth / (visibleYears.length - 1);
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = plot.top + plotHeight * ratio;
    const count = Math.round(maxCount * (1 - ratio));
    const value = maxValue * (1 - ratio);
    return `<g class="graph-grid"><line x1="${plot.left}" y1="${y}" x2="${plot.right}" y2="${y}"/><text x="${plot.left - 9}" y="${y + 3}" text-anchor="end">${formatNumber(count)}</text><text x="${plot.right + 9}" y="${y + 3}" text-anchor="start">${formatCompactCurrency(value)}</text></g>`;
  }).join('');
  const barWidth = Math.min(34, Math.max(16, plotWidth / visibleYears.length * .42));
  const bars = visibleYears.map((summary, index) => {
    const x = xForYear(index);
    const y = yForCount(summary.count);
    return `<g class="graph-bar-group"><title>${summary.year}: ${formatNumber(summary.count)} records, ${formatCurrency(summary.value)}</title><rect class="graph-bar" x="${x - barWidth / 2}" y="${y}" width="${barWidth}" height="${plot.bottom - y}" rx="5"/><text class="graph-x-label" x="${x}" y="${plot.bottom + 22}" text-anchor="middle">${summary.year}</text></g>`;
  }).join('');
  const valueLine = visibleYears.map((summary, index) => `${index ? 'L' : 'M'} ${xForYear(index)} ${yForValue(summary.value)}`).join(' ');
  const valuePoints = visibleYears.map((summary, index) => `<circle class="graph-point" cx="${xForYear(index)}" cy="${yForValue(summary.value)}" r="4"><title>${summary.year}: ${formatCurrency(summary.value)}</title></circle>`).join('');
  const axisLabels = `<text class="graph-axis-title" transform="translate(13 ${plot.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">RECORDS</text><text class="graph-axis-title" transform="translate(${chartWidth - 9} ${plot.top + plotHeight / 2}) rotate(90)" text-anchor="middle">PHP</text>`;

  chart.innerHTML = `<svg class="year-graph" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Annual record counts shown as bars and total acquisition value shown as a line. ${visibleYears.map(summary => `${summary.year}: ${summary.count} records, ${formatCurrency(summary.value)}`).join('; ')}">
    ${gridLines}${axisLabels}<g class="graph-bars">${bars}</g><path class="graph-value-line" d="${valueLine}"/>${valuePoints}
  </svg>`;
}

function getChartScaleMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatCompactCurrency(value) {
  if (value >= 1000000) return `₱${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)}m`;
  if (value >= 1000) return `₱${Math.round(value / 1000)}k`;
  return `₱${Math.round(value)}`;
}

function renderDepartmentTable(summaries, totals) {
  const table = document.getElementById('department-table');
  const footer = document.getElementById('department-table-footer');
  if (!summaries.length) {
    table.innerHTML = '<tr><td colspan="5" class="table-empty">No records match these filters.</td></tr>';
    footer.innerHTML = '';
    return;
  }

  table.innerHTML = summaries.map(summary => {
    const latestDate = summary.latestDate ? summary.latestDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
    return `<tr><td>${escapeReportHtml(summary.department)}</td><td>${formatNumber(summary.records)}</td><td>${formatNumber(summary.quantity)}</td><td>${formatCurrency(summary.value)}</td><td>${latestDate}</td></tr>`;
  }).join('');
  footer.innerHTML = `<tr><td>FILTERED TOTAL</td><td>${formatNumber(totals.records)}</td><td>${formatNumber(totals.quantity)}</td><td>${formatCurrency(totals.acquisitionValue)}</td><td></td></tr>`;
}

function renderReport() {
  const records = getFilteredReportRecords();
  const totals = summarizeRecords(records);
  document.getElementById('metric-records').textContent = formatNumber(records.length);
  document.getElementById('metric-quantity').textContent = formatNumber(totals.quantity);
  document.getElementById('metric-value').textContent = formatCurrency(totals.acquisitionValue);
  document.getElementById('metric-records-note').textContent = `${totals.byDepartment.length} ${totals.byDepartment.length === 1 ? 'department' : 'departments'} in this view`;
  document.getElementById('filter-result').textContent = `${formatNumber(records.length)} of ${formatNumber(reportRecords.length)} records`;

  const selectedYear = document.getElementById('year-filter').value;
  const selectedDepartment = document.getElementById('department-filter').value;
  const scopeLabel = selectedDepartment === 'ALL' ? (isMainReportDepartment() ? 'ALL DEPARTMENTS' : selectedDepartment) : selectedDepartment;
  document.getElementById('report-period-label').textContent = selectedYear === 'ALL' ? scopeLabel : `${scopeLabel} / ${selectedYear}`;
  document.getElementById('table-context').textContent = selectedDepartment === 'ALL' ? 'Live Firestore records' : `${selectedDepartment} records`;
  renderDepartmentChart(totals.byDepartment);
  renderYearChart(totals.byYear);
  renderDepartmentTable(totals.byDepartment, { records: records.length, ...totals });
  renderBreakdownTable('supplier-table', 'toggle-suppliers', 'supplier-summary', 'suppliers', totals.bySupplier);
  renderBreakdownTable('fund-table', 'toggle-funds', 'fund-summary', 'funds', totals.byFund);
  renderBreakdownTable('requestor-table', 'toggle-requestors', 'requestor-summary', 'requestors', totals.byRequestor);
}

function escapeReportHtml(value) {
  return cleanReportText(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function downloadReportCsv() {
  const records = getFilteredReportRecords();
  const headers = ['Department', 'Property Number', 'Description', 'Quantity', 'Unit', 'Acquisition Cost (PHP)', 'Date Acquired', 'Person Accountable', 'Location', 'Fund', 'Serial Number', 'Inventory Tag'];
  const rows = records.map(record => {
    return [getRecordDepartment(record), record.propertyNo, record.itemDescription, record.quantity, record.unit, record.acquisitionCost, record.dateAcquired, record.requestedBy, record.endUserLocation, record.fund, record.serialNo, record.inventoryTag];
  });
  const csv = [headers, ...rows].map(row => row.map(value => `"${cleanReportText(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `ucn-property-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

function setReportMessage(message, isError = false) {
  const messageElement = document.getElementById('report-message');
  messageElement.textContent = message;
  messageElement.hidden = !message;
  messageElement.style.background = isError ? '#f1dfdc' : '';
  if (isError) document.getElementById('sync-status').textContent = 'Unable to connect';
}

function startAnalytics() {
  const sessionDepartment = sessionStorage.getItem('propertyCardDepartment');
  const rememberedDepartment = localStorage.getItem('propertyCardDepartment');
  const remembersLogin = localStorage.getItem('propertyCardRememberLogin') === 'true';
  reportDepartment = normalizeReportDepartment(sessionDepartment || (remembersLogin ? rememberedDepartment : ''));
  if (!reportDepartment) {
    window.location.replace('login.html');
    return;
  }

  document.getElementById('report-generated').textContent = `REPORT GENERATED ${new Date().toLocaleString('en-PH')}`;
  document.getElementById('department-filter').addEventListener('change', renderReport);
  document.getElementById('year-filter').addEventListener('change', renderReport);
  document.getElementById('reset-filters').addEventListener('click', () => {
    document.getElementById('department-filter').value = 'ALL';
    document.getElementById('year-filter').value = 'ALL';
    renderReport();
  });
  document.getElementById('export-report').addEventListener('click', downloadReportCsv);
  document.getElementById('print-report').addEventListener('click', () => window.print());
  [['toggle-suppliers', 'supplier'], ['toggle-funds', 'fund'], ['toggle-requestors', 'requestor']].forEach(([buttonId, group]) => {
    document.getElementById(buttonId).addEventListener('click', event => {
      const button = event.currentTarget;
      button.dataset.expanded = button.dataset.expanded === 'true' ? 'false' : 'true';
      renderReport();
      document.getElementById(`${group}-table`).closest('.breakdown-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });

  if (!window.firebase) {
    setReportMessage('The report could not connect because the Firebase service did not load. Check your connection and reload.', true);
    return;
  }

  try {
    firebase.initializeApp(REPORT_FIREBASE_CONFIG);
    const firestore = firebase.firestore();
    let query = firestore.collection('propertyTags');
    if (!isMainReportDepartment()) {
      query = reportDepartment === 'ENTIENZA'
        ? query.where('dept', 'in', ['ENTIENZA', 'IABD'])
        : query.where('dept', '==', reportDepartment);
    }

    query.onSnapshot(snapshot => {
      reportRecords = snapshot.docs.map(document => ({ cardId: document.id, ...document.data() }));
      populateReportFilters(reportRecords);
      document.getElementById('sync-status').textContent = `Updated ${new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
      setReportMessage('');
      renderReport();
    }, error => {
      console.error('Analytics Firestore error:', error);
      setReportMessage('Could not load property records. Check your connection and Firestore access, then reload this report.', true);
      document.getElementById('department-table').innerHTML = '<tr><td colspan="5" class="table-empty">Records could not be loaded.</td></tr>';
      document.getElementById('department-chart').innerHTML = '<div class="chart-empty">Report data is unavailable.</div>';
      document.getElementById('year-chart').innerHTML = '<div class="chart-empty">Report data is unavailable.</div>';
    });
  } catch (error) {
    console.error('Analytics initialization error:', error);
    setReportMessage('Analytics could not initialize. Reload the page or contact your system administrator.', true);
  }
}

document.addEventListener('DOMContentLoaded', startAnalytics);