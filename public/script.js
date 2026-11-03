/** @format */

// Global variables
let currentSumberLimbah = null;
let currentJenisLimbah = null;
let charts = {};
let unit = 'kg'; // Default unit is grams
let managePassword = '';
const summaryChartColors = [
	'#3b82f6',
	'#10b981',
	'#f59e0b',
	'#ef4444',
	'#8b5cf6',
	'#06b6d4',
	'#84cc16',
	'#f97316',
	'#ec4899',
	'#6366f1',
	'#14b8a6',
	'#eab308',
	'#f43f5e',
	'#a855f7',
	'#0ea5e9',
	'#22c55e',
	'#d946ef',
	'#64748b',
	'#fb7185',
	'#4ade80',
	'#38bdf8',
	'#c084fc',
	'#facc15',
	'#2dd4bf',
	'#fb923c',
	'#818cf8',
	'#a3e635',
	'#e879f9',
	'#f87171',
	'#34d399',
	'#60a5fa',
	'#fbbf24',
	'#c08457',
	'#d8b4fe',
	'#67e8f9',
	'#bef264',
	'#fda4af',
	'#93c5fd',
	'#86efac',
	'#fdba74',
];

Chart.defaults.color = '#a7b5c9';
Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.16)';
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.scale.grid.color = 'rgba(148, 163, 184, 0.12)';
Chart.defaults.scale.ticks.color = '#94a3b8';
Chart.defaults.plugins.legend.labels.color = '#cbd5e1';

// ============ Initialization ============
document.addEventListener('DOMContentLoaded', () => {
	initializeEventListeners();
	setDefaultDates();
	loadSummaryData();
});

async function fetchJson(url) {
	const response = await fetch(url);
	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.error || `Permintaan gagal (${response.status})`);
	}
	return data;
}

function setDefaultDates() {
	const today = new Date();
	const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
	const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
	const firstDayOfYear = new Date(today.getFullYear(), 0, 2);

	const formatDate = (date) => date.toISOString().split('T')[0];

	document.getElementById('startDate').value = formatDate(firstDayOfYear);
	document.getElementById('endDate').value = formatDate(today);
	document.getElementById('sumberLimbahStartDate').value = formatDate(firstDayOfYear);
	document.getElementById('sumberLimbahEndDate').value = formatDate(today);
	document.getElementById('jenisLimbahStartDate').value = formatDate(firstDayOfYear);
	document.getElementById('jenisLimbahEndDate').value = formatDate(today);
	document.getElementById('historyStartDate').value = formatDate(firstDayOfYear);
	document.getElementById('historyEndDate').value = formatDate(today);
}

// ============ Event Listeners ============
function initializeEventListeners() {
	// Navigation
	document.querySelectorAll('.nav-link').forEach((link) => {
		link.addEventListener('click', (e) => {
			e.preventDefault();
			switchMenu(link.dataset.menu);
		});
	});

	// Summary Menu
	document.getElementById('filterBtn').addEventListener('click', loadSummaryData);
	// document.getElementById("exportBtn").addEventListener("click", exportData);

	document.getElementById('sumberLimbahFilterBtn').addEventListener('click', loadSumberLimbahDetails);
	// document
	//   .getElementById("sumberLimbahExportBtn")
	//   .addEventListener("click", exportSumberLimbahData);

	// JenisLimbah Menu
	document.getElementById('jenisLimbahFilterBtn').addEventListener('click', loadJenisLimbahDetails);
	// document
	//   .getElementById("jenisLimbahExportBtn")
	//   .addEventListener("click", exportJenisLimbahData);

	// History Menu
	document.getElementById('historyFilterBtn').addEventListener('click', loadHistoryData);
	document
	  .getElementById("historyExportBtn")
	  .addEventListener("click", exportHistoryData);
	document.getElementById('historyPreviousBtn').addEventListener('click', () => changeHistoryPage(-1));
	document.getElementById('historyNextBtn').addEventListener('click', () => changeHistoryPage(1));

	document.querySelectorAll('.manage-tab').forEach((tab) => {
		tab.addEventListener('click', () => switchMasterTab(tab.dataset.masterTab));
	});
	document.getElementById('wasteForm').addEventListener('submit', saveWaste);
	document.getElementById('sourceForm').addEventListener('submit', saveSource);
	document.getElementById('divisionForm').addEventListener('submit', saveDivision);
	document.getElementById('operatorForm').addEventListener('submit', saveOperator);
	document.getElementById('manageLoginForm').addEventListener('submit', loginToManage);
	document.getElementById('manageLogoutBtn').addEventListener('click', logoutFromManage);
	document.getElementById('weighingSelectAll').addEventListener('change', (event) => {
		document.querySelectorAll('#weighingManageBody [data-weighing-id]').forEach((checkbox) => {
			checkbox.checked = event.target.checked;
		});
		updateSelectedWeighingCount();
	});
	document.getElementById('weighingManageBody').addEventListener('change', updateSelectedWeighingCount);
	document.getElementById('deleteSelectedWeighingBtn').addEventListener('click', deleteSelectedWeighing);
	document.addEventListener('click', (event) => {
		const button = event.target.closest('[data-download-code]');
		if (!button) return;
		downloadMasterCode(button.dataset.downloadCode, button.dataset.codeType);
	});
}

// ============ Menu Switching ============
function switchMenu(menuName) {
	// Hide all sections
	document.querySelectorAll('.menu-section').forEach((section) => {
		section.classList.remove('active');
	});

	// Remove active from all nav links
	document.querySelectorAll('.nav-link').forEach((link) => {
		link.classList.remove('active');
	});

	// Show selected section
	document.getElementById(menuName).classList.add('active');

	// Set active nav link
	document.querySelector(`[data-menu="${menuName}"]`).classList.add('active');

	// Reset sumberLimbah detail state when switching menus
	if (menuName !== 'sumberLimbah' || (menuName === 'sumberLimbah' && currentSumberLimbah)) {
		// Reset to list view if switching away from sumberLimbah or if we're in detail view
		if (menuName === 'sumberLimbah') {
			currentSumberLimbah = null;
			const sumberLimbahDetailsSection = document.getElementById('sumberLimbahDetailsSection');
			const sumberLimbahContainer = document.getElementById('sumberLimbahContainer');
			if (sumberLimbahDetailsSection) sumberLimbahDetailsSection.style.display = 'none';
			if (sumberLimbahContainer) sumberLimbahContainer.style.display = 'grid';
		}
	}
	if (menuName !== 'sumberLimbah') {
		currentSumberLimbah = null;
		document.getElementById('sumberLimbahTitle').textContent = 'Daftar Sumber Limbah';
		document.getElementById('sumberLimbahDetailsSection').style.display = 'none';
		document.getElementById('sumberLimbahContainer').style.display = 'grid';
	}

	if (menuName === 'jenisLimbah') {
		currentJenisLimbah = null;
		document.getElementById('jenisLimbahTitle').textContent = 'Daftar Jenis Limbah';
		document.getElementById('jenisLimbahDetailsSection').style.display = 'none';
		document.getElementById('jenisLimbahContainer').style.display = 'grid';
	}

	// Load data for the menu
	if (menuName === 'summary') {
		loadSummaryData();
	} else if (menuName === 'sumberLimbah') {
		loadSumberLimbah();
	} else if (menuName === 'jenisLimbah') {
		loadJenisLimbah();
	} else if (menuName === 'history') {
		loadHistoryData();
	} else if (menuName === 'manage' && managePassword) {
		loadMasterData();
	}
}

// ============ SUMMARY MENU ============
async function loadSummaryData() {
	const startDate = document.getElementById('startDate').value;
	const endDate = document.getElementById('endDate').value;
	const period = document.getElementById('summaryPeriod').value;

	try {
		// Load summary aggregates and weighing rows for period charts.
		const [sumberLimbah, jenisLimbah, weighingRows] = await Promise.all([
			fetchJson(`/api/summary?table=sumber_limbah&startDate=${startDate}&endDate=${endDate}`),
			fetchJson(`/api/summary?table=jenis_limbah&startDate=${startDate}&endDate=${endDate}`),
			fetchJson(`/api/weighing?${new URLSearchParams({ startDate, endDate })}`),
		]);

		// Calculate statistics
		const sumberLimbahCount = sumberLimbah.length;
		const jenisLimbahCount = jenisLimbah.length;
		const totalWeighing = sumberLimbah.reduce((sum, item) => sum + Number(item.count || 0), 0);
		const totalWeight = sumberLimbah.reduce((sum, item) => sum + Number(item.total_weight || 0), 0);
		const avgWeight = totalWeighing > 0 ? totalWeight / totalWeighing : 0;

		// Update stat cards
		document.getElementById('totalWeighing').textContent = totalWeighing;
		document.getElementById('sumberLimbahCount').textContent = sumberLimbahCount;
		document.getElementById('jenisLimbahCount').textContent = jenisLimbahCount;
		document.getElementById('totalWeight').textContent = formatWeight_onCard(totalWeight);
		document.getElementById('avgWeight').textContent = formatWeight_onCard(avgWeight);

		createPeriodSummaryBarChart(aggregatePeriodData(weighingRows, period, 'jenisLimbah'), 'jenisLimbahBarChart', 'jenisLimbahBar');
		createPeriodSummaryBarChart(aggregatePeriodData(weighingRows, period, 'source'), 'sumberLimbahBarChart', 'sumberLimbahBar');

		createPeriodSummaryBarChart(aggregatePeriodData(weighingRows, period, 'category'), 'categoryTrendChart', 'categoryTrend');
		renderSummaryWasteDetails(weighingRows, period);
	} catch (error) {
		console.error('Error loading summary data:', error);
		alert('Gagal memuat data ringkasan');
	}
}

function aggregatePeriodData(rows, period, dimension) {
	if (!Array.isArray(rows)) {
		throw new Error('Format data weighing tidak valid untuk grafik periode');
	}

	const seriesConfig = {
		category: { getValue: (row) => row.kategori_limbah, error: 'kategori limbah' },
		jenisLimbah: { getValue: (row) => row.jenis_limbah, error: 'jenis limbah' },
		source: { getValue: (row) => row.sumber_limbah, error: 'sumber limbah' },
	}[dimension];
	if (!seriesConfig) {
		throw new Error('Dimensi grafik periode tidak valid');
	}

	const totals = new Map();
	rows.forEach((row) => {
		const date = String(row.date || row.tanggal || '').slice(0, 10);
		const series = seriesConfig.getValue(row);
		const weight = Number(row.berat);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !series || !Number.isFinite(weight)) {
			throw new Error(`Data weighing tidak lengkap untuk grafik ${seriesConfig.error}`);
		}

		const periodLabel = getSummaryPeriodLabel(date, period);

		const key = `${periodLabel}\u0000${series}`;
		const aggregate = totals.get(key) || { period: periodLabel, series, total_weight: 0, count: 0 };
		aggregate.total_weight += weight;
		aggregate.count += 1;
		totals.set(key, aggregate);
	});
	// console.log(`Aggregated data for ${dimension}:`, [...totals.values()]);

	return [...totals.values()].sort((a, b) => a.period.localeCompare(b.period) || a.series.localeCompare(b.series));
}

function getSummaryPeriodLabel(date, period) {
	const monthStr_index = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
	if (period === 'day') return date;
	if (period === 'week') {
		const day = new Date(`${date}T00:00:00Z`);
		day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
		return day.toISOString().slice(0, 10);
	}
	if (period === 'month') return date.slice(0, 7);
	if (period === 'year') return date.slice(0, 4);
	throw new Error('Periode ringkasan tidak valid');
}

function formatSummaryPeriodLabel(periodLabel, period) {
	if (period === 'year') return periodLabel;

	const dateValue = period === 'month' ? `${periodLabel}-01` : `${periodLabel}T00:00:00Z`;
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) {
		throw new Error('Label periode ringkasan tidak valid');
	}
	return new Intl.DateTimeFormat('id-ID', { day: period === 'month' ? undefined : 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function renderSummaryWasteDetails(rows, period) {
	const container = document.getElementById('summaryWasteDetails');
	if (!container) {
		throw new Error('Kontainer rincian jenis limbah tidak ditemukan');
	}
	if (!Array.isArray(rows)) {
		throw new Error('Format data weighing tidak valid untuk rincian limbah');
	}
	const categories = new Map();
	rows.forEach((row) => {
		const date = String(row.date || row.tanggal || '').slice(0, 10);
		const category = row.kategori_limbah;
		const jenisLimbah = row.jenis_limbah;
		const weight = Number(row.berat);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !category || !jenisLimbah || !Number.isFinite(weight)) {
			throw new Error('Data weighing tidak lengkap untuk rincian jenis limbah');
		}

		const periodLabel = getSummaryPeriodLabel(date, period);
		if (!categories.has(category)) {
			categories.set(category, { totalWeight: 0, totalCount: 0, periods: new Map() });
		}

		const categoryData = categories.get(category);
		if (!categoryData.periods.has(periodLabel)) {
			categoryData.periods.set(periodLabel, { totalWeight: 0, totalCount: 0, jenisLimbah: new Map() });
		}

		const periodData = categoryData.periods.get(periodLabel);
		const jenisData = periodData.jenisLimbah.get(jenisLimbah) || { totalWeight: 0, count: 0 };
		jenisData.totalWeight += weight;
		jenisData.count += 1;
		periodData.jenisLimbah.set(jenisLimbah, jenisData);
		periodData.totalWeight += weight;
		periodData.totalCount += 1;
		categoryData.totalWeight += weight;
		categoryData.totalCount += 1;
	});

	if (categories.size === 0) {
		container.innerHTML = '<div class="empty-state"><p>Tidak ada data jenis limbah pada periode ini.</p></div>';
		return;
	}

	container.innerHTML = [...categories.entries()]
		.sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
		.map(([category, categoryData]) => {
			const periodGroups = [...categoryData.periods.entries()]
				.sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
				.map(
					([periodLabel, periodData]) => `
            <section class="summary-period-group">
              <div class="summary-period-heading">
                <h5>${escapeHtml(formatSummaryPeriodLabel(periodLabel, period))}</h5>
                <span>${escapeHtml(formatWeight_onCard(periodData.totalWeight))}</span>
              </div>
              <div class="summary-waste-table-wrap">
                <table class="summary-waste-table">
                  <thead>
                    <tr>
                      <th>Jenis Limbah</th>
                      <th>Jumlah</th>
                      <th>Total Berat</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[...periodData.jenisLimbah.entries()]
											.sort(([jenisA], [jenisB]) => jenisA.localeCompare(jenisB))
											.map(
												([jenisLimbah, jenisData]) => `
                          <tr>
                            <td>${escapeHtml(jenisLimbah)}</td>
                            <td>${jenisData.count}</td>
                            <td>${escapeHtml(formatWeight_onCard(jenisData.totalWeight))}</td>
                          </tr>
                        `,
											)
											.join('')}
                  </tbody>
                </table>
              </div>
            </section>
          `,
				)
				.join('');

			return `
        <article class="summary-category-card">
          <header class="summary-category-header">
            <div>
              <span class="summary-category-label">Kategori Limbah</span>
              <h4>${escapeHtml(category)}</h4>
            </div>
            <div class="summary-category-total">
              <span>${categoryData.totalCount} penimbangan</span>
              <strong>${escapeHtml(formatWeight_onCard(categoryData.totalWeight))}</strong>
            </div>
          </header>
          <div class="summary-category-periods">${periodGroups}</div>
        </article>
      `;
		})
		.join('');
}

function createPeriodSummaryBarChart(data, canvasId, chartKey) {
	const ctx = document.getElementById(canvasId);
	if (!ctx) {
		console.error(`Canvas ${canvasId} tidak ditemukan`);
		return;
	}

	if (charts[chartKey]) {
		charts[chartKey].destroy();
	}

	const labels = [...new Set(data.map((item) => item.period))];
	const series = [...new Set(data.map((item) => item.series))].sort();
	const seriesColors = new Map(series.map((name, index) => [name, summaryChartColors[index % summaryChartColors.length]]));
	const datasets = labels.flatMap((period, periodIndex) => {
		const periodRows = data
			.filter((item) => item.period === period)
			.sort((a, b) => Number(a.total_weight) - Number(b.total_weight) || a.series.localeCompare(b.series));

		return periodRows.map((row, index) => ({
			label: row.series,
			data: labels.map((_, labelIndex) => (labelIndex === periodIndex ? Number(row.total_weight) : null)),
			backgroundColor: seriesColors.get(row.series),
			borderColor: seriesColors.get(row.series),
			borderRadius: 4,
			grouped: false,
			order: index,
		}));
	});

	charts[chartKey] = new Chart(ctx, {
		type: 'bar',
		data: { labels, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: true,
			plugins: {
				legend: {
					display: true,
					position: 'top',
					labels: {
						generateLabels(chart) {
							const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
							const seen = new Set();

							return labels.filter((item) => {
								if (seen.has(item.text)) {
									return false;
								}
								seen.add(item.text);

								const datasetIndices = chart.data.datasets.map((dataset, index) => (dataset.label === item.text ? index : -1)).filter((index) => index !== -1);
								item.hidden = datasetIndices.every((index) => !chart.isDatasetVisible(index));
								item.fontColor = '#ffffff';
								return true;
							});
						},
					},
					onClick(event, item, legend) {
						const matchingIndices = legend.chart.data.datasets
							.map((dataset, index) => (dataset.label === item.text ? index : -1))
							.filter((index) => index !== -1);
						const shouldShow = matchingIndices.some((index) => !legend.chart.isDatasetVisible(index));
						matchingIndices.forEach((index) => legend.chart.setDatasetVisibility(index, shouldShow));
						legend.chart.update();
					},
				},
				tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${Number(context.raw).toLocaleString('id-ID')} ${unit}` } },
			},
			scales: {
				x: { stacked: false },
				y: {
					stacked: false,
					beginAtZero: true,
					title: { display: true, text: `Total Berat (${unit})` },
					ticks: { callback: (value) => Number(value).toLocaleString('id-ID') },
				},
			},
		},
	});
}

function createSummaryDoughnutChart(data, id, metric = 'count') {
	const ctx = document.getElementById(id);

	if (!ctx) {
		console.error(`Canvas ${id} tidak ditemukan`);
		return;
	}

	let chartKey;
	let labels;
	let weightTotals;

	if (id.startsWith('jenisLimbah')) {
		chartKey = id === 'jenisLimbahWeightDoughnutChart' ? 'jenisLimbahWeightDoughnut' : 'jenisLimbahDoughnut';
		labels = data.map((item) => item.jenis_limbah);
	} else if (id.startsWith('sumberLimbah')) {
		chartKey = id === 'sumberLimbahWeightDoughnutChart' ? 'sumberLimbahWeightDoughnut' : 'sumberLimbahDoughnut';
		labels = data.map((item) => item.sumber_limbah);
	} else {
		console.error(`Unknown chart id: ${id}`);
		return;
	}

	// Destroy chart lama
	if (charts[chartKey]) {
		charts[chartKey].destroy();
		charts[chartKey] = null;
	}

	const values = data.map((item) => Number(item[metric === 'count' ? 'count' : 'total_weight'] || 0));
	const totalWeight = values.reduce((sum, value) => sum + value, 0);
	const chartValues = metric === 'weightPercentage' ? values.map((value) => (totalWeight > 0 ? (value / totalWeight) * 100 : 0)) : values;
	weightTotals = values;

	charts[chartKey] = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: labels,
			datasets: [
				{ 
					data: chartValues, 
					backgroundColor: summaryChartColors.slice(0, labels.length),
					borderColor: '#172235', 
					borderWidth: 1,
					borderRadius: 5, 
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			animation: true,
			plugins: {
				legend: { display: true, position: 'right' },
				tooltip: {
					callbacks: {
						label: (context) => {
							if (metric === 'weightPercentage') {
								const weight = weightTotals[context.dataIndex];
								return `${context.label}: ${Number(context.raw).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% (${weight.toLocaleString('id-ID')} ${unit})`;
							}
							return `${context.label}: ${Number(context.raw).toLocaleString('id-ID')} penimbangan`;
						},
					},
				},
			},
		},
	});
}

// ============ JENIS LIMBAH MENU ============
async function loadJenisLimbah() {
	const startDate = document.getElementById('startDate').value;
	const endDate = document.getElementById('endDate').value;
	const jenisLimbahContainer = document.getElementById('jenisLimbahContainer');
	const summaryCharts = document.getElementById('jenisLimbahSummaryCharts');

	document.getElementById('jenisLimbahTitle').textContent = 'Daftar Jenis Limbah';
	document.getElementById('jenisLimbahDetailsSection').style.display = 'none';
	jenisLimbahContainer.style.display = 'grid';
	summaryCharts.style.display = 'grid';
	currentJenisLimbah = null;

	try {
		const params = new URLSearchParams({ startDate, endDate });
		const summary = await fetchJson(`/api/summary?table=jenis_limbah`);
		createSummaryDoughnutChart(summary, 'jenisLimbahDoughnutChart');
		createSummaryDoughnutChart(summary, 'jenisLimbahWeightDoughnutChart', 'weightPercentage');
		createCards(summary, 'jenisLimbahPage');
	} catch (error) {
		console.error('Error loading jenis limbah:', error);
		alert('Gagal memuat data jenis limbah');
	}
}

function showJenisLimbahDetails(jenisLimbah) {
	currentJenisLimbah = jenisLimbah;
	document.getElementById('jenisLimbahContainer').style.display = 'none';
	document.getElementById('jenisLimbahSummaryCharts').style.display = 'none';
	document.getElementById('jenisLimbahDetailsSection').style.display = 'block';
	document.getElementById('jenisLimbahTitle').textContent = `Detail Limbah: ${jenisLimbah}`;
	loadJenisLimbahDetails();
}

async function loadJenisLimbahDetails() {
	if (!currentJenisLimbah) return;

	const startDate = document.getElementById('jenisLimbahStartDate').value;
	const endDate = document.getElementById('jenisLimbahEndDate').value;
	const params = new URLSearchParams({ startDate, endDate, jenis_limbah: currentJenisLimbah });

	try {
		const data_penimbangan = await fetchJson(`/api/weighing?${params}`);
		const totalWeight = data_penimbangan.reduce((sum, item) => sum + Number(item.berat || 0), 0);
		const averageWeight = data_penimbangan.length > 0 ? totalWeight / data_penimbangan.length : 0;
		const sumberLimbah = new Set(data_penimbangan.map((item) => item.sumber_limbah));

		document.getElementById('jenisLimbahTotal').textContent = data_penimbangan.length;
		document.getElementById('jenisLimbahTotalWeight').textContent = formatWeight_onCard(totalWeight);
		document.getElementById('jenisLimbahAvgWeight').textContent = formatWeight_onCard(averageWeight);
		document.getElementById('jenisLimbahSumberLimbahCount').textContent = sumberLimbah.size;
		createSumberLimbahWeightChart(data_penimbangan, 'jenisLimbahSumberLimbahWeightChart');
		createJenisLimbahSumberLimbahChart(data_penimbangan);
		createJenisLimbahWeightLineChart(data_penimbangan);
	} catch (error) {
		console.error('Gagal memuat detail jenis limbah:', error);
		alert('Gagal memuat detail jenis limbah');
	}
}

function createJenisLimbahWeightLineChart(data) {
	const ctx = document.getElementById('jenisLimbahWeightLineChart');
	const previousVisibility = new Map(
		(charts.jenisLimbahWeightLine?.data.datasets || []).map((dataset, index) => [dataset.label, charts.jenisLimbahWeightLine.isDatasetVisible(index)]),
	);
	const parsedData = data
		.map((item) => {
			const timestamp = `${item.date}T${item.time}`;
			const date = new Date(timestamp);
			return Number.isNaN(date.getTime()) ? null : { ...item, _date: date };
		})
		.filter(Boolean)
		.sort((a, b) => a._date - b._date)
		.slice(-30);

	const labels = parsedData.map((item) => {
		const date = item._date;
		return new Intl.DateTimeFormat('id-ID', { month: 'short', day: 'numeric' }).format(date);
	});

	const sumberLimbah = [...new Set(parsedData.map((item) => item.sumber_limbah))].sort();
	const colors = summaryChartColors;
	const datasets = sumberLimbah.map((sumberLimbah, index) => ({
		label: sumberLimbah,
		hidden: previousVisibility.has(sumberLimbah) ? !previousVisibility.get(sumberLimbah) : false,
		data: parsedData.map((item) => (item.sumber_limbah === sumberLimbah ? Number(item.berat || 0) : null)),
		borderColor: colors[index % colors.length],
		backgroundColor: colors[index % colors.length] + '33',
		borderWidth: 2,
		pointRadius: 3,
		pointHoverRadius: 5,
		fill: false,
		tension: 0.25,
		spanGaps: true,
	}));

	if (charts.jenisLimbahWeightLine) {
		charts.jenisLimbahWeightLine.data.labels = labels;
		charts.jenisLimbahWeightLine.data.datasets = datasets;
		charts.jenisLimbahWeightLine.update('none');
		return;
	}

	charts.jenisLimbahWeightLine = new Chart(ctx, {
		type: 'line',
		data: { labels, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: true,
			onClick: (event, elements, chart) => {
				const point = elements.find((element) => element.datasetIndex >= 0);
				if (!point) return;

				const datasetIndex = point.datasetIndex;
				chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
				chart.update();
			},
			scales: {
				x: { ticks: { display: true, autoSkip: true, maxTicksLimit: 10 }, title: { display: false, text: 'Waktu Penimbangan' } },
				y: { beginAtZero: false, title: { display: true, text: `Berat (${unit})` } },
			},
			plugins: {
				legend: { display: true, position: 'top' },
				tooltip: {
					callbacks: {
						label: (context) => {
							const weight = Number(context.raw || 0);
							return `${context.dataset.label}: ${formatWeight_onCard(weight)}`;
						},
					},
				},
			},
		},
	});
}

function createSumberLimbahWeightChart(data, canvasId = 'sumberLimbahWeightChart') {
	const ctx = document.getElementById(canvasId);
	// console.log('Creating sumberLimbah weight chart with data:', data);

	if (charts.sumberLimbahWeight) {
		charts.sumberLimbahWeight.destroy();
	}

	// Group data by sumberLimbah
	const sumberLimbahData = {};
	data.forEach((item) => {
		if (!sumberLimbahData[item.sumber_limbah]) {
			sumberLimbahData[item.sumber_limbah] = 0;
		}
		sumberLimbahData[item.sumber_limbah] += Number(item.berat || 0);
	});

	const sumberLimbah = Object.keys(sumberLimbahData).sort();
	const weights = sumberLimbah.map((sumberLimbah) => sumberLimbahData[sumberLimbah]);
	const datasets = sumberLimbah.map((sumberLimbah, index) => {
		const color = summaryChartColors[index % summaryChartColors.length];
		return {
			label: sumberLimbah,
			data: weights.map((weight, dataIndex) => (dataIndex === index ? weight : null)),
			backgroundColor: color,
			borderColor: color,
			borderWidth: 1,
			borderRadius: 5,
			grouped: false,
		};
	});

	charts.sumberLimbahWeight = new Chart(ctx, {
		type: 'bar',
		data: { labels: sumberLimbah, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: true,
			plugins: {
				legend: { display: true, position: 'top', labels: { color: '#ffffff' } },
				tooltip: {
					callbacks: {
						label: (context) => {
							const weight = Number(context.raw || 0);
							return `${context.dataset.label}: ${formatWeight_onCard(weight)}`;
						},
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					title: { display: true, text: `Berat (${unit})` },
					ticks: {
						callback: function (value) {
							return value.toLocaleString('id-ID');
						},
					},
				},
			},
		},
	});
}

function createJenisLimbahSumberLimbahChart(data) {
	const ctx = document.getElementById('jenisLimbahSumberLimbahChart');

	const sumberLimbahData = {};
	data.forEach((item) => {
		sumberLimbahData[item.sumber_limbah] = (sumberLimbahData[item.sumber_limbah] || 0) + 1;
	});

	const sumberLimbah = Object.keys(sumberLimbahData).sort();

	if (charts.jenisLimbahSumberLimbah) {
		charts.jenisLimbahSumberLimbah.data.labels = sumberLimbah;
		charts.jenisLimbahSumberLimbah.data.datasets[0].data = sumberLimbah.map((sumberLimbah) => sumberLimbahData[sumberLimbah]);
		charts.jenisLimbahSumberLimbah.update('none');
		return;
	}

	charts.jenisLimbahSumberLimbah = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: sumberLimbah,
			datasets: [
				{
					label: 'Jumlah Penimbangan',
					data: sumberLimbah.map((sumberLimbah) => sumberLimbahData[sumberLimbah]),
					backgroundColor: summaryChartColors.slice(0, sumberLimbah.length),
					borderColor: '#07051d',
					borderWidth: 1,
					borderRadius: 5,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			animation: true,
			plugins: {
				legend: { display: true, position: 'right' },
				tooltip: { callbacks: { label: (context) => `${context.label}: ${Number(context.raw).toLocaleString('id-ID')} penimbangan` } },
			},
		},
	});
}

// ============ SUMBER LIMBAH MENU ============
async function loadSumberLimbah() {
	// Reset to list view state
	const sumberLimbahDetailsSection = document.getElementById('sumberLimbahDetailsSection');
	const sumberLimbahContainer = document.getElementById('sumberLimbahContainer');
	const summaryCharts = document.getElementById('sumberLimbahSummaryCharts');
	document.getElementById('sumberLimbahTitle').textContent = 'Daftar Sumber Limbah';

	currentSumberLimbah = null;

	try {
		const startDate = document.getElementById('startDate').value;
		const endDate = document.getElementById('endDate').value;
		const params = new URLSearchParams({ startDate, endDate });
		const sumberLimbah = await fetchJson(`/api/summary?table=sumber_limbah`);
		createSummaryDoughnutChart(sumberLimbah, 'sumberLimbahDoughnutChart');
		createSummaryDoughnutChart(sumberLimbah, 'sumberLimbahWeightDoughnutChart', 'weightPercentage');

		const container = document.getElementById('sumberLimbahContainer');
		summaryCharts.style.display = 'grid';
		sumberLimbahDetailsSection.style.display = 'none';
		sumberLimbahContainer.style.display = 'grid';

		if (sumberLimbah.length === 0) {
			container.innerHTML = '<div class="empty-state"><p>Tidak ada data sumber limbah</p></div>';
			return;
		}

		createCards(sumberLimbah, 'sumberLimbahPage');
	} catch (error) {
		console.error('Error loading sumber limbah:', error);
		alert('Gagal memuat data sumber limbah');
	}
}

function showSumberLimbahDetails(sumberLimbah) {
	currentSumberLimbah = sumberLimbah;
	document.getElementById('sumberLimbahContainer').style.display = 'none';
	document.getElementById('sumberLimbahSummaryCharts').style.display = 'none';
	document.getElementById('sumberLimbahDetailsSection').style.display = 'block';
	document.getElementById('sumberLimbahTitle').textContent = `Detail Sumber Limbah: ${sumberLimbah}`;
	loadSumberLimbahDetails();
}

function backToSumberLimbahList() {
	document.getElementById('sumberLimbahDetailsSection').style.display = 'none';
	document.getElementById('sumberLimbahContainer').style.display = 'grid';
	currentSumberLimbah = null;
	// Reload sumberLimbah list to ensure it displays correctly
	loadSumberLimbah();
}

async function loadSumberLimbahDetails() {
	const startDate = document.getElementById('sumberLimbahStartDate').value;
	const endDate = document.getElementById('sumberLimbahEndDate').value;

	try {
		const [stats, filterData] = await Promise.all([
			fetchJson(`/api/sumber-limbah-stats/${encodeURIComponent(currentSumberLimbah)}?startDate=${startDate}&endDate=${endDate}`),
			fetchJson(`/api/sumber-limbah/${encodeURIComponent(currentSumberLimbah)}?startDate=${startDate}&endDate=${endDate}`),
		]);

		// Update statistics
		let totalWeighing = 0;
		let totalWeight = 0;
		let maxWeight = 0;

		stats.forEach((stat) => {
			totalWeighing += stat.count;
			totalWeight += stat.total_weight;
			if (stat.max_weight > maxWeight) {
				maxWeight = stat.max_weight;
			}
		});

		const avgWeight = totalWeighing > 0 ? totalWeight / totalWeighing : 0;

		document.getElementById('sumberLimbahTotal').textContent = totalWeighing;
		document.getElementById('sumberLimbahTotalWeight').textContent = formatWeight_onCard(totalWeight);
		document.getElementById('sumberLimbahAvgWeight').textContent = formatWeight_onCard(avgWeight);
		document.getElementById('sumberLimbahMaxWeight').textContent = formatWeight_onCard(maxWeight);

		// Create charts
		createSumberLimbahBarChart(filterData);
		createSumberLimbahDoughnutChart(filterData);
		loadStreamingData();
	} catch (error) {
		console.error('Gagal memuat detail sumber limbah:', error);
		alert('Gagal memuat detail sumber limbah');
	}
}

async function loadStreamingData() {
	try {
		const allData = await fetchJson(`/api/sumber-limbah/${encodeURIComponent(currentSumberLimbah)}`);

		createStreamingLineChart(allData, 'streamingLineChart');
	} catch (error) {
		console.error('Gagal memuat detail sumber limbah:', error);
		alert('Gagal memuat detail sumber limbah');
	}
}

function createStreamingLineChart(data, canvasId) {
	const ctx = document.getElementById(canvasId);
	const previousVisibility = new Map(
		(charts.jenisLimbahWeightLine?.data.datasets || []).map((dataset, index) => [dataset.label, charts.jenisLimbahWeightLine.isDatasetVisible(index)]),
	);
	const parsedData = data
		.map((item) => {
			const timestamp = `${item.date}T${item.time}`;
			const date = new Date(timestamp);
			return Number.isNaN(date.getTime()) ? null : { ...item, _date: date };
		})
		.filter(Boolean)
		.sort((a, b) => a._date - b._date)
		.slice(-30);

	const labels = parsedData.map((item) => {
		const date = item._date;
		return new Intl.DateTimeFormat('id-ID', { month: 'short', day: 'numeric' }).format(date);
	});

	const parsed_item = [...new Set(parsedData.map((item) => item.jenis_limbah))].sort();
	const colors = summaryChartColors;
	const datasets = parsed_item.map((itemName, index) => ({
		label: itemName,
		hidden: previousVisibility.has(itemName) ? !previousVisibility.get(itemName) : false,
		data: parsedData.map((item) => (item.jenis_limbah || '') === itemName ? Number(item.berat || 0) : null),
		borderColor: colors[index % colors.length],
		backgroundColor: colors[index % colors.length] + '33',
		borderWidth: 2,
		pointRadius: 3,
		pointHoverRadius: 5,
		fill: false,
		tension: 0.25,
		spanGaps: true,
	}));

	if (charts.sumberLimbahWeightLine) {
		charts.sumberLimbahWeightLine.data.labels = labels;
		charts.sumberLimbahWeightLine.data.datasets = datasets;
		charts.sumberLimbahWeightLine.update('none');
		return;
	}

	charts.sumberLimbahWeightLine = new Chart(ctx, {
		type: 'line',
		data: { labels, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: true,
			onClick: (event, elements, chart) => {
				const point = elements.find((element) => element.datasetIndex >= 0);
				if (!point) return;

				const datasetIndex = point.datasetIndex;
				chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
				chart.update();
			},
			scales: {
				x: { ticks: { display: true, autoSkip: true, maxTicksLimit: 10 }, title: { display: false, text: 'Waktu Penimbangan' } },
				y: { beginAtZero: false, title: { display: true, text: `Berat (${unit})` } },
			},
			plugins: {
				legend: { display: true, position: 'top' },
				tooltip: {
					callbacks: {
						label: (context) => {
							const weight = Number(context.raw || 0);
							return `${context.dataset.label}: ${formatWeight_onCard(weight)}`;
						},
					},
				},
			},
		},
	});
}

function createSumberLimbahBarChart(data) {
	const ctx = document.getElementById('sumberLimbahDetailBarChart');

	// const ctx = document.getElementById(canvasId);
	// console.log('Creating sumberLimbah weight chart with data:', data);

	if (charts.sumberLimbahBar) {
		charts.sumberLimbahBar.destroy();
	}

	// Group data by sumberLimbah
	const sumberLimbahData = {};
	data.forEach((item) => {
		if (!sumberLimbahData[item.jenis_limbah]) {
			sumberLimbahData[item.jenis_limbah] = 0;
		}
		sumberLimbahData[item.jenis_limbah] += Number(item.berat || 0);
	});

	const sumberLimbah = Object.keys(sumberLimbahData).sort();
	const weights = sumberLimbah.map((sumberLimbah) => sumberLimbahData[sumberLimbah]);
	const datasets = sumberLimbah.map((sumberLimbah, index) => {
		const color = summaryChartColors[index % summaryChartColors.length];
		return {
			label: sumberLimbah,
			data: weights.map((weight, dataIndex) => (dataIndex === index ? weight : null)),
			backgroundColor: color,
			borderColor: color,
			borderWidth: 1,
			borderRadius: 5,
			grouped: false,
		};
	});

	charts.sumberLimbahBar = new Chart(ctx, {
		type: 'bar',
		data: { labels: sumberLimbah, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: true,
			plugins: {
				legend: { display: true, position: 'top', labels: { color: '#ffffff' } },
				tooltip: {
					callbacks: {
						label: (context) => {
							const weight = Number(context.raw || 0);
							return `${context.dataset.label}: ${formatWeight_onCard(weight)}`;
						},
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					title: { display: true, text: `Berat (${unit})` },
					ticks: {
						callback: function (value) {
							return value.toLocaleString('id-ID');
						},
					},
				},
			},
		},
	});
	// if (charts.sumberLimbahBar) {
	// 	charts.sumberLimbahBar.destroy();
	// }

	// const parsedData = data
	// 	.map((item) => {
	// 		const timestamp = `${item.date}T${item.time}`;
	// 		const date = new Date(timestamp);
	// 		return Number.isNaN(date.getTime()) ? null : { ...item, _date: date };
	// 	})
	// 	.filter(Boolean)
	// 	.sort((a, b) => a._date - b._date)
	// 	.slice(-30);

	// const labels = parsedData.map((item) => {
	// 	const date = item._date;
	// 	return new Intl.DateTimeFormat('id-ID', { month: 'short', day: 'numeric' }).format(date);
	// });

	// const jenisLimbah = [...new Set(parsedData.map((item) => String(item.jenis_limbah || '').trim()).filter(Boolean))].sort();

	// const datasets = jenisLimbah.map((jenisLimbah, index) => {
	// 	const color = summaryChartColors[index % summaryChartColors.length];
	// 	return {
	// 		label: jenisLimbah,
	// 		data: parsedData.map((item) => {
	// 			const isMatch = String(item.jenis_limbah || '').trim() === jenisLimbah;
	// 			return isMatch ? Number(item.berat || item.weight || 0) : null;
	// 		}),
	// 		borderColor: color,
	// 		backgroundColor: color,
	// 		borderWidth: 1,
	// 		borderRadius: 5,
	// 		grouped: false,
	// 	};
	// });

	// charts.sumberLimbahBar = new Chart(ctx, {
	// 	type: 'bar',
	// 	data: { labels, datasets },
	// 	options: {
	// 		responsive: true,
	// 		maintainAspectRatio: false,
	// 		plugins: { legend: { display: true, position: 'bottom' } },
	// 		scales: { y: { beginAtZero: false, title: { display: true, text: 'Berat (gr)' } } },
	// 	},
	// });
}

function createSumberLimbahDoughnutChart(data) {
	const ctx = document.getElementById('detailSumberLimbahDoughnutChart');

	if (charts.sumberLimbahDoughnut) {
		charts.sumberLimbahDoughnut.destroy();
	}

	const jenisLimbahData = {};
	data.forEach((item) => {
		if (!jenisLimbahData[item.jenis_limbah]) {
			jenisLimbahData[item.jenis_limbah] = 0;
		}
		jenisLimbahData[item.jenis_limbah]++;
	});

	charts.sumberLimbahDoughnut = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: Object.keys(jenisLimbahData),
			datasets: [{ 
				data: Object.values(jenisLimbahData), 
				backgroundColor: summaryChartColors.slice(0, Object.keys(jenisLimbahData).length),
				borderColor: '#07051d', 
				borderWidth: 1,
				borderRadius: 5
			}],
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			// animation: false,
			plugins: { legend: { position: 'right' } },
		},
	});
}

// ============ HISTORY MENU ============

let tableData = [];
let sortDirection = {};
const HISTORY_PAGE_SIZE = 500;
let historyCurrentPage = 1;

async function loadHistoryData() {
	const startDate = document.getElementById('historyStartDate').value;
	const endDate = document.getElementById('historyEndDate').value;
	const sumberLimbah = document.getElementById('historySumberLimbahFilter').value;
	const jenisLimbah = document.getElementById('historyJenisLimbahFilter').value;
	const kategori = document.getElementById('historyKategoriFilter').value;

	try {
		await loadHistorySumberLimbahFilter();

		document.getElementById('historySumberLimbahFilter').value = sumberLimbah;
		document.getElementById('historyJenisLimbahFilter').value = jenisLimbah;
		document.getElementById('historyKategoriFilter').value = kategori;

		const params = new URLSearchParams({ startDate, endDate });

		if (sumberLimbah) params.append('sumber_limbah', sumberLimbah);
		if (jenisLimbah) params.append('jenis_limbah', jenisLimbah);
		if (kategori) params.append('kategori_limbah', kategori);

		const response = await fetch(`/api/weighing?${params}&export=true`);
		tableData = await response.json();
		historyCurrentPage = 1;

		renderTable();
	} catch (err) {
		console.error(err);
		alert('Gagal memuat history');
	}
}

function renderTable() {
	const tbody = document.getElementById('historyTableBody');

	tbody.innerHTML = '';

	if (tableData.length === 0) {
		tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:2rem">
                    Tidak ada data
                </td>
            </tr>`;
		updateHistoryPagination(0, 0, 0);
		return;
	}

	const totalPages = Math.ceil(tableData.length / HISTORY_PAGE_SIZE);
	const startIndex = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE;
	const pageRows = tableData.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);

	pageRows.forEach((row) => {
		tbody.insertAdjacentHTML(
			'beforeend',
			`
            <tr>
                <td>${escapeHtml(row.id_transaksi)}</td>
                <td><strong>${escapeHtml(row.sumber_limbah)}</strong></td>
                <td>${escapeHtml(row.jenis_limbah)}</td>
                <td>${escapeHtml(row.kategori_limbah)}</td>
                <td>${escapeHtml(row.operator)}</td>
                <td>${escapeHtml(row.divisi)}</td>
                <td>${Number(row.berat).toLocaleString('id-ID')} ${unit}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.time)}</td>
            </tr>
        `,
		);
	});

	updateHistoryPagination(totalPages, startIndex, pageRows.length);
}

function changeHistoryPage(direction) {
	const totalPages = Math.max(1, Math.ceil(tableData.length / HISTORY_PAGE_SIZE));
	const nextPage = historyCurrentPage + direction;

	if (nextPage < 1 || nextPage > totalPages) return;

	historyCurrentPage = nextPage;
	renderTable();
}

function updateHistoryPagination(totalPages, startIndex, visibleRows) {
	const pageInfo = document.getElementById('historyPageInfo');
	const previousButton = document.getElementById('historyPreviousBtn');
	const nextButton = document.getElementById('historyNextBtn');

	if (!pageInfo || !previousButton || !nextButton) return;

	const displayTotalPages = Math.max(1, totalPages);
	const firstRow = tableData.length === 0 ? 0 : startIndex + 1;
	const lastRow = startIndex + visibleRows;

	pageInfo.textContent =
		tableData.length === 0
			? 'Tidak ada data'
			: `Menampilkan ${firstRow}-${lastRow} dari ${tableData.length} data | Halaman ${historyCurrentPage} dari ${displayTotalPages}`;
	previousButton.disabled = historyCurrentPage <= 1;
	nextButton.disabled = historyCurrentPage >= displayTotalPages;
}

function sortTable(column) {
	sortDirection[column] = sortDirection[column] === 'asc' ? 'desc' : 'asc';

	const asc = sortDirection[column] === 'asc';

	tableData.sort((a, b) => {
		let x = a[column];
		let y = b[column];

		// angka
		if (!isNaN(x) && !isNaN(y)) {
			return asc ? x - y : y - x;
		}

		// tanggal
		if (column === 'date') {
			x = new Date(x);
			y = new Date(y);

			return asc ? x - y : y - x;
		}

		// string
		return asc ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
	});

	renderTable();
}

async function loadHistorySumberLimbahFilter() {
	await Promise.all([
		loadFilter('/api/filter-history?sumber_limbah=true', 'historySumberLimbahFilter', 'sumber_limbah'),

		loadFilter('/api/filter-history?jenis_limbah=true', 'historyJenisLimbahFilter', 'jenis_limbah'),

		loadFilter('/api/filter-history?kategori_limbah=true', 'historyKategoriFilter', 'kategori_limbah'),
	]);
}

async function loadFilter(url, selectId, key) {
	try {
		const select = document.getElementById(selectId);
		const currentValue = select.value;

		const response = await fetch(url);
		const data = await response.json();

		select.length = 1;

		data.forEach((item) => {
			const option = document.createElement('option');

			option.value = item[key];
			option.textContent = item[key];

			select.appendChild(option);
		});

		select.value = currentValue;
	} catch (err) {
		console.error(`Error loading ${selectId}:`, err);
	}

}

function mapWeighingExportRow(item) {
	return {
		// 'ID Log': item.id_log,
		'ID Transaksi': item.id_transaksi,
		// Timbangan: item.id_timbangan,
		'Sumber Limbah': item.sumber_limbah,
		'ID Sumber': item.id_sumber,
		'Nama Limbah': item.jenis_limbah,
		'Kategori Limbah': item.kategori_limbah,
		'Kode Limbah': item.id_limbah,
		Operator: item.operator,
		NIK: item.nik,
		Divisi: item.divisi,
		'Berat (kg)': item.berat,
		Tanggal: item.date,
		Waktu: item.time,
	};
}

// ============ MANAGE MENU ============

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function switchMasterTab(tabName) {
	document.querySelectorAll('.manage-tab').forEach((tab) => {
		tab.classList.toggle('active', tab.dataset.masterTab === tabName);
	});
	document.querySelectorAll('.master-panel').forEach((panel) => {
		panel.classList.toggle('active', panel.dataset.masterPanel === tabName);
	});
	if (tabName === 'weighing') {
		loadManageWeighingData();
	}
}

async function masterRequest(path, options = {}) {
	const response = await fetch(path, {
		...options,
		headers: { 'Content-Type': 'application/json', ...(managePassword ? { 'X-Manage-Password': managePassword } : {}), ...(options.headers || {}) },
	});
	const result = await response.json();
	if (!response.ok || result.success === false) {
		throw new Error(result.error || result.message || 'Permintaan gagal');
	}
	return result;
}

async function loginToManage(event) {
	event.preventDefault();
	const passwordInput = document.getElementById('managePassword');
	const message = document.getElementById('manageLoginMessage');
	message.hidden = true;

	try {
		const response = await fetch('/api/manage/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: passwordInput.value }),
		});
		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error || 'Password manage salah');
		}

		managePassword = passwordInput.value;
		passwordInput.value = '';
		document.getElementById('manageLogin').hidden = true;
		document.getElementById('manageContent').hidden = false;
		await loadMasterData();
	} catch (error) {
		message.textContent = error.message;
		message.hidden = false;
	}
}

function logoutFromManage() {
	managePassword = '';
	document.getElementById('manageContent').hidden = true;
	document.getElementById('manageLogin').hidden = false;
	document.getElementById('managePassword').focus();
}

async function loadManageWeighingData() {
	const tbody = document.getElementById('weighingManageBody');
	tbody.innerHTML = '<tr><td colspan="13" class="manage-empty">Memuat data...</td></tr>';
	document.getElementById('weighingSelectAll').checked = false;
	updateSelectedWeighingCount();

	try {
		const rows = await masterRequest('/api/weighing');
		renderManageWeighingRows(rows);
	} catch (error) {
		tbody.innerHTML = '<tr><td colspan="13" class="manage-empty">Gagal memuat data penimbangan.</td></tr>';
		alert(`Gagal memuat data penimbangan: ${error.message}`);
	}
}

function renderManageWeighingRows(rows) {
	const tbody = document.getElementById('weighingManageBody');
	if (!rows.length) {
		tbody.innerHTML = '<tr><td colspan="13" class="manage-empty">Belum ada data penimbangan</td></tr>';
		return;
	}

	tbody.innerHTML = rows
		.map(
			(row) => `
    <tr>
      <td class="checkbox-column"><input type="checkbox" data-weighing-id="${escapeHtml(row.id_log)}" aria-label="Pilih data log ${escapeHtml(row.id_log)}"></td>
      <td>${escapeHtml(row.id_transaksi)}</td>
      <td>${escapeHtml(row.sumber_limbah)}</td>
      <td>${escapeHtml(row.jenis_limbah)}</td>
      <td>${escapeHtml(row.kategori_limbah)}</td>
      <td>${escapeHtml(row.operator)}</td>
      <td>${escapeHtml(row.divisi)}</td>
      <td>${escapeHtml(row.berat)}</td>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.time)}</td>
    </tr>`,
		)
		.join('');
	updateSelectedWeighingCount();
}

function updateSelectedWeighingCount() {
	const checkboxes = [...document.querySelectorAll('#weighingManageBody [data-weighing-id]')];
	const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
	const selectAll = document.getElementById('weighingSelectAll');
	selectAll.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
	selectAll.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;

	const deleteButton = document.getElementById('deleteSelectedWeighingBtn');
	deleteButton.disabled = selectedCount === 0;
	deleteButton.textContent = `Hapus Dipilih (${selectedCount})`;
}

async function deleteSelectedWeighing() {
	const selectedIds = [...document.querySelectorAll('#weighingManageBody [data-weighing-id]:checked')].map((checkbox) => Number(checkbox.dataset.weighingId));
	if (!selectedIds.length) return;
	if (!confirm(`Hapus ${selectedIds.length} data penimbangan yang dipilih? Penghapusan tidak dapat dibatalkan.`)) return;

	try {
		const result = await masterRequest('/api/weighing', { method: 'DELETE', body: JSON.stringify({ ids: selectedIds }) });
		alert(`${result.deleted} data penimbangan berhasil dihapus.`);
		await loadManageWeighingData();
	} catch (error) {
		alert(`Gagal menghapus data penimbangan: ${error.message}`);
	}
}

async function loadMasterData() {
	try {
		const [wasteResult, sourceResult, divisionResult, operatorResult] = await Promise.all([
			masterRequest('/api/limbah'),
			masterRequest('/api/sumber'),
			masterRequest('/api/divisi'),
			masterRequest('/api/operator'),
		]);
		renderMasterRows('wasteMasterBody', wasteResult.data, ['kode_limbah', 'kategori_limbah', 'jenis_limbah'], 'limbah', 'kode_limbah', 'kode_limbah');
		renderMasterRows('sourceMasterBody', sourceResult.data, ['id_sumber', 'sumber_limbah'], 'sumber', 'id_sumber', 'id_sumber');
		renderMasterRows('divisionMasterBody', divisionResult.data, ['divisi'], 'divisi', 'divisi');
		renderMasterRows('operatorMasterBody', operatorResult.data, ['operator', 'nik', 'divisi'], 'operator', 'nik', 'nik');

		const divisionSelect = document.getElementById('operatorDivision');
		const selectedDivision = divisionSelect.value;
		divisionSelect.replaceChildren(new Option('Pilih Departemen/Section', ''));
		divisionResult.data.forEach(({ divisi }) => {
			divisionSelect.add(new Option(divisi, divisi));
		});
		divisionSelect.value = selectedDivision;
	} catch (error) {
		console.error('Gagal memuat data master:', error);
		alert(`Gagal memuat data master: ${error.message}`);
	}
}

function renderMasterRows(bodyId, rows, columns, endpoint, key, codeKey = null) {
	const tbody = document.getElementById(bodyId);
	if (!rows.length) {
		tbody.innerHTML = `<tr><td colspan="${columns.length + 1}" class="manage-empty">Belum ada data</td></tr>`;
		return;
	}
	tbody.innerHTML = rows
		.map(
			(row) => `
    <tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}
      <td>
        ${
					codeKey
						? `
          <button type="button" class="btn btn-secondary btn-small" data-download-code="${escapeHtml(row[codeKey])}" data-code-type="barcode">Download 1D JPEG</button>
          <button type="button" class="btn btn-secondary btn-small" data-download-code="${escapeHtml(row[codeKey])}" data-code-type="qrcode">Download 2D JPEG</button>
        `
						: ''
				}
        <button type="button" class="btn btn-danger btn-small" data-delete-master="${escapeHtml(row[key])}">Hapus</button>
      </td>
    </tr>`,
		)
		.join('');
	tbody.querySelectorAll('[data-delete-master]').forEach((button) => {
		button.addEventListener('click', () => deleteMaster(endpoint, key, button.dataset.deleteMaster));
	});
}

function downloadMasterCode(value, type) {
	if (!value) {
		alert('ID untuk membuat kode tidak tersedia.');
		return;
	}

	try {
		const canvas = document.createElement('canvas');
		if (type === 'barcode') {
			if (typeof JsBarcode !== 'function') {
				throw new Error('Library barcode belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
			}
			JsBarcode(canvas, value, {
				format: 'CODE128',
				displayValue: true,
				font: 'Arial',
				fontSize: 18,
				height: 90,
				margin: 16,
				background: '#ffffff',
				lineColor: '#000000',
			});
		} else if (type === 'qrcode') {
			if (typeof QRCode !== 'function') {
				throw new Error('Library QR code belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
			}
			const container = document.createElement('div');
			new QRCode(container, { text: value, width: 320, height: 320, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
			const qrCanvas = container.querySelector('canvas');
			if (!qrCanvas) throw new Error('Gagal membuat gambar QR code.');
			canvas.width = qrCanvas.width;
			canvas.height = qrCanvas.height;
			canvas.getContext('2d').drawImage(qrCanvas, 0, 0);
		} else {
			throw new Error('Jenis kode tidak dikenal.');
		}

		const jpegCanvas = document.createElement('canvas');
		jpegCanvas.width = canvas.width;
		jpegCanvas.height = canvas.height;
		const context = jpegCanvas.getContext('2d');
		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
		context.drawImage(canvas, 0, 0);

		const safeValue = value.replace(/[^a-z0-9_-]/gi, '_');
		const codeName = type === 'barcode' ? 'barcode-1d' : 'qrcode-2d';
		const link = document.createElement('a');
		link.href = jpegCanvas.toDataURL('image/jpeg', 0.95);
		link.download = `${codeName}-${safeValue}.jpeg`;
		link.click();
	} catch (error) {
		console.error('Gagal membuat kode ID:', error);
		alert(`Gagal membuat JPEG: ${error.message}`);
	}
}

async function saveMasterForm(event, endpoint, getBody, formId) {
	event.preventDefault();
	const form = document.getElementById(formId);
	try {
		await masterRequest(endpoint, { method: 'POST', body: JSON.stringify(getBody()) });
		form.reset();
		await loadMasterData();
	} catch (error) {
		alert(`Gagal menyimpan data: ${error.message}`);
	}
}

function saveWaste(event) {
	return saveMasterForm(
		event,
		'/api/limbah',
		() => ({
			kategori_limbah: document.getElementById('wasteCategory').value.trim(),
			jenis_limbah: document.getElementById('wasteName').value.trim(),
			kode_limbah: document.getElementById('wasteCode').value.trim(),
		}),
		'wasteForm',
	);
}

function saveSource(event) {
	return saveMasterForm(
		event,
		'/api/sumber',
		() => ({ id_sumber: document.getElementById('sourceId').value.trim(), sumber_limbah: document.getElementById('sourceName').value.trim() }),
		'sourceForm',
	);
}

function saveDivision(event) {
	return saveMasterForm(event, '/api/divisi', () => ({ divisi: document.getElementById('divisionName').value.trim() }), 'divisionForm');
}

function saveOperator(event) {
	return saveMasterForm(
		event,
		'/api/operator',
		() => ({
			operator: document.getElementById('operatorName').value.trim(),
			nik: document.getElementById('operatorNik').value.trim(),
			divisi: document.getElementById('operatorDivision').value,
		}),
		'operatorForm',
	);
}

async function deleteMaster(endpoint, key, value) {
	if (!confirm(`Hapus data "${value}"? Jika masih digunakan transaksi, server akan menolak penghapusan.`)) return;
	try {
		await masterRequest(`/api/${endpoint}`, { method: 'DELETE', body: JSON.stringify({ [key]: value }) });
		await loadMasterData();
	} catch (error) {
		alert(`Gagal menghapus data: ${error.message}`);
	}
}

// ============ TOOL ============

function downloadXlsx(rows, filename, sheetName = 'Data') {
	const worksheet = XLSX.utils.json_to_sheet(rows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

	const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

	const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
}

function sanitizeFilename(value) {
	return (
		String(value)
			.replace(/[\\/:*?"<>|]/g, '')
			.trim()
			.replace(/\s+/g, '_') || 'export'
	);
}

async function exportData() {
	const startDate = document.getElementById('startDate').value;
	const endDate = document.getElementById('endDate').value;

	try {
		const response = await fetch(`/api/weighing?startDate=${startDate}&endDate=${endDate}&export=true`);
		const data = await response.json();

		const rows = data.map(mapWeighingExportRow);

		downloadXlsx(rows, `${sanitizeFilename(`summary_${startDate}_to_${endDate}`)}.xlsx`, 'Summary');
	} catch (error) {
		console.error('Error exporting summary data:', error);
		alert('Gagal mengekspor data');
	}
}

async function exportSumberLimbahData() {
	const startDate = document.getElementById('sumberLimbahStartDate').value;
	const endDate = document.getElementById('sumberLimbahEndDate').value;
	try {
		// const url =     `/api/sumber-limbah/${currentSumberLimbah}?startDate=${startDate}&endDate=${endDate}&export=true`;
		const params = new URLSearchParams({ startDate, endDate, sumber_limbah: currentSumberLimbah, export: 'true' });
		const url = `/api/weighing?${params}`;
		const response = await fetch(url);
		const data = await response.json();

		const rows = data.map(mapWeighingExportRow);

		downloadXlsx(rows, `${sanitizeFilename(`${currentSumberLimbah}_${startDate}_${endDate}`)}.xlsx`, 'SumberLimbah Detail');
	} catch (error) {
		console.error('Gagal mengekspor data sumber limbah:', error);
		alert('Gagal mengekspor data');
	}
}

async function exportJenisLimbahData() {
	const startDate = document.getElementById('jenisLimbahStartDate').value;
	const endDate = document.getElementById('jenisLimbahEndDate').value;

	try {
		const params = new URLSearchParams({ startDate, endDate, jenis_limbah: currentJenisLimbah, export: 'true' });
		const url = `/api/weighing?${params}`;
		const response = await fetch(url);
		const data = await response.json();

		if (data.length === 0) {
			alert('Tidak ada data untuk diekspor');
			return;
		}

		const rows = data.map(mapWeighingExportRow);

		downloadXlsx(rows, `${sanitizeFilename(`${currentJenisLimbah}_${startDate}_${endDate}`)}.xlsx`, 'Detail Jenis Limbah');
	} catch (error) {
		console.error('Error exporting jenis limbah data:', error);
		alert('Gagal mengekspor data');
	}
}

function exportHistoryData() {
	const startDate = document.getElementById('historyStartDate').value;
	const endDate = document.getElementById('historyEndDate').value;
	const sumberLimbah = document.getElementById('historySumberLimbahFilter').value;
	const jenisLimbah = document.getElementById('historyJenisLimbahFilter').value;
	const kategori = document.getElementById('historyKategoriFilter').value;

	const rows = tableData.map(mapWeighingExportRow);

	const filename = `${sanitizeFilename(`history_${startDate || 'all'}_${endDate || 'all'}_${sumberLimbah || 'all'}_${jenisLimbah || 'all'}_${kategori || 'all'}`)}.xlsx`;
	downloadXlsx(rows, filename, 'History');
}

function formatWeight_onCard(weight) {
	return `${weight.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} ${unit} (${(weight / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ton)`;
}

function createCards(item, page) {
	let container;
	if (page === 'sumberLimbahPage') {
		container = document.getElementById('sumberLimbahContainer');
		container.innerHTML = '';
		if (item.length === 0) {
			container.innerHTML = '<div class="empty-state"><p>Tidak ada data sumber limbah</p></div>';
			return;
		}
	} else if (page === 'jenisLimbahPage') {
		container = document.getElementById('jenisLimbahContainer');
		container.innerHTML = '';
		if (item.length === 0) {
			container.innerHTML = '<div class="empty-state"><p>Tidak ada data jenis limbah</p></div>';
			return;
		}
	}
	item.forEach((item) => {
		const card = document.createElement('div');
		let cardHeaderText;
		let totalCount;
		let totalItem;
		let totalWeight;
		let avgWeight;
		let lastUpdateDate;
		let titleClass;
		if (page === 'sumberLimbahPage') {
			card.className = 'sumberLimbah-card';
			cardHeaderText = item.sumber_limbah;
			totalCount = item.count;
			titleClass = 'Jenis Limbah';
			totalItem = item.count_jenis_limbah;
			totalWeight = formatWeight_onCard(item.total_weight);
			avgWeight = formatWeight_onCard(item.avg_weight);
			lastUpdateDate = new Date(item.last_update).toLocaleDateString('id-ID', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		} else if (page === 'jenisLimbahPage') {
			card.className = 'jenisLimbah-card';
			cardHeaderText = item.jenis_limbah;
			totalCount = item.count;
			titleClass = 'Sumber Limbah';
			totalItem = item.count_sumber_limbah;
			totalWeight = formatWeight_onCard(item.total_weight);
			avgWeight = formatWeight_onCard(item.avg_weight);
			lastUpdateDate = new Date(item.last_update).toLocaleDateString('id-ID', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		}
		card.innerHTML = `
      <div class="card-header">${escapeHtml(cardHeaderText)}</div>
      <div class="card-body">
        <div class="card-stat">
          <span class="card-stat-label">Total Penimbangan</span>
          <span class="card-stat-value">${totalCount}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">${titleClass}</span>
          <span class="card-stat-value">${totalItem}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Total Berat</span>
          <span class="card-stat-value">${totalWeight}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Rata-rata</span>
          <span class="card-stat-value">${avgWeight}</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-label">Terakhir Update</span>
          <span class="card-stat-value">${escapeHtml(lastUpdateDate)}</span>
        </div>
      </div>
      <div class="sumberLimbah-card-overlay">
        LIHAT DETAIL
      </div>
    `;

		if (page === 'sumberLimbahPage') {
			card.addEventListener('click', () => showSumberLimbahDetails(item.sumber_limbah));
		} else if (page === 'jenisLimbahPage') {
			card.addEventListener('click', () => showJenisLimbahDetails(item.jenis_limbah));
		}
		container.appendChild(card);
	});
}

// setInterval(() => {
//   const activeMenu = document.querySelector(".menu-section.active");

//   if (activeMenu && activeMenu.id === "sumberLimbah" && currentSumberLimbah === null) {
//     // Optional: refresh sumberLimbah data silently
//     loadSumberLimbah();
//     // showSumberLimbahDetails(currentSumberLimbah);
//   } else if (
//     activeMenu &&
//     activeMenu.id === "sumberLimbah" &&
//     currentSumberLimbah !== null
//   ) {
//     showSumberLimbahDetails(currentSumberLimbah);
//     // loadStreamingData();
//   } else if (
//     activeMenu &&
//     activeMenu.id === "jenisLimbah" &&
//     currentJenisLimbah === null
//   ) {
//     loadJenisLimbah();
//   } else if (
//     activeMenu &&
//     activeMenu.id === "jenisLimbah" &&
//     currentJenisLimbah !== null
//   ) {
//     loadJenisLimbahDetails();
//   } else if (activeMenu && activeMenu.id === "summary") {
//     loadSummaryData();
//   }
// }, 3000);
