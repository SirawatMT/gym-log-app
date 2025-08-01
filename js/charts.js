// js/charts.js
// รวม Logic ทั้งหมดที่เกี่ยวข้องกับการสร้างและจัดการกราฟด้วย Chart.js

import { DOM } from './dom.js';
import { state } from './state.js';
import { getWeekNumber, getMuscleGroup } from './utils.js';
import { showAlert } from './modal.js';
import { bodyStatMetrics, muscleGroups } from './config.js';

// --- REFACTORED: Import from new UI modules ---
import { getThemeColors } from './ui-core.js';
// --- DEFINITIVE FIX: ลบ import ที่เป็นสาเหตุของ Circular Dependency ---
// import { populateAllExerciseSelects, renderBodyStatsPage } from './ui-shared.js';


export function updateChartDefaults() {
    if (typeof Chart === 'undefined') return;
    const themeColors = getThemeColors();
    Chart.defaults.color = themeColors.textSecondaryColor;
    Chart.defaults.borderColor = themeColors.borderColor;
    Chart.defaults.scale.title.color = themeColors.textColor;
}

export function createChartGradient(ctx, colorVar) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    const colorVal = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
    if (colorVal.startsWith('#')) {
        const r = parseInt(colorVal.slice(1, 3), 16);
        const g = parseInt(colorVal.slice(3, 5), 16);
        const b = parseInt(colorVal.slice(5, 7), 16);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    } else {
        // Fallback
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    }
    return gradient;
}

function destroyChart(chartName) {
    if (state.charts[chartName]) {
        state.charts[chartName].destroy();
        delete state.charts[chartName];
    }
}

// --- DEFINITIVE FIX: ลบฟังก์ชันที่ไม่ได้ใช้งานและเป็นสาเหตุของ Circular Dependency ---
/*
export function renderAnalysisPage() {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js is not loaded. Skipping chart rendering.");
        const analysisContainer = document.getElementById('analysis-overview');
        if(analysisContainer) {
            analysisContainer.innerHTML = '<p style="text-align:center; padding: 20px;">ไม่สามารถโหลดไลบรารีกราฟได้<br/>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p>';
        }
        return;
    }
    populateAllExerciseSelects();
    generateMuscleBalanceChart();
    generateWeeklyVolumeChart();
    generateFatigueAnalysisChart();
    generateExerciseCharts(DOM.exerciseSelect.value);
    
    const oldChart = document.getElementById('comparisonChart');
    if (oldChart) {
        const parent = oldChart.parentElement;
        if (parent) {
            parent.innerHTML = ''; // Clear the container
            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'comparisonChart';
            parent.appendChild(newCanvas);
        }
    }
    destroyChart('comparisonChart');
}
*/

/**
 * --- BUG FIX ---
 * สร้างฟังก์ชันนี้ขึ้นมาใหม่เพื่อรวบรวมการวาดกราฟทั้งหมดในหน้า "ภาพรวม"
 * แก้ไขปัญหาที่ `handlers.js` เรียกใช้ฟังก์ชันที่ไม่มีอยู่จริง
 */
export function generateOverviewCharts() {
    if (typeof Chart === 'undefined') return;
    generateMuscleBalanceChart();
    generateWeeklyVolumeChart();
    generateFatigueAnalysisChart();
}


export function generateWeeklyVolumeChart() {
    if (typeof Chart === 'undefined') return;
    destroyChart('weeklyVolumeChart');
    const history = state.history;
    const weeklyData = history.reduce((acc, entry) => {
        const week = getWeekNumber(new Date(entry.isoDate));
        if (!acc[week]) acc[week] = 0;
        acc[week] += entry.totalVolume;
        return acc;
    }, {});
    const labels = Object.keys(weeklyData).sort().slice(-12);
    const data = labels.map(label => weeklyData[label]);
    const ctx = document.getElementById('weeklyVolumeChart').getContext('2d');
    const themeColors = getThemeColors();
    state.charts.weeklyVolumeChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Total Volume (kg)', data, backgroundColor: themeColors.successColor, borderColor: themeColors.successColor, borderWidth: 1 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'kg' } } } }
    });
}

export function generateFatigueAnalysisChart() {
    if (typeof Chart === 'undefined') return;
    destroyChart('fatigueAnalysisChart');
    const history = state.history;
    const weeklyData = history.reduce((acc, entry) => {
        const week = getWeekNumber(new Date(entry.isoDate));
        if (!acc[week]) acc[week] = { volume: 0, totalE1rm: 0, count: 0 };
        acc[week].volume += entry.totalVolume;
        const maxE1rm = Math.max(...entry.exercises.map(ex => ex.type !== 'cardio' ? Math.max(...ex.sets.map(s => s.e1rm), 0) : 0), 0);
        if (maxE1rm > 0) {
            acc[week].totalE1rm += maxE1rm;
            acc[week].count++;
        }
        return acc;
    }, {});
    const labels = Object.keys(weeklyData).sort().slice(-12);
    const volumeData = labels.map(l => weeklyData[l].volume);
    const avgE1rmData = labels.map(l => weeklyData[l].count > 0 ? weeklyData[l].totalE1rm / weeklyData[l].count : 0);
    const ctx = document.getElementById('fatigueAnalysisChart').getContext('2d');
    const themeColors = getThemeColors();
    state.charts.fatigueAnalysisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Weekly Volume', data: volumeData, yAxisID: 'yVolume', backgroundColor: themeColors.successColor },
                { label: 'Avg Max e1RM', data: avgE1rmData, yAxisID: 'yE1rm', type: 'line', borderColor: themeColors.primaryColor, tension: 0.1, fill: true, backgroundColor: (context) => createChartGradient(context.chart.ctx, '--primary-color') }
            ]
        },
        options: {
            scales: {
                yVolume: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Volume (kg)' } },
                yE1rm: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Avg e1RM (kg)' }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

export function generateComparisonChart() {
    if (typeof Chart === 'undefined') return;
    destroyChart('comparisonChart');
    const selectedExercises = Array.from(DOM.compareExerciseSelect.selectedOptions).map(option => option.value);
    if (selectedExercises.length < 2 || selectedExercises.length > 5) {
        showAlert("กรุณาเลือกท่าออกกำลังกายระหว่าง 2 ถึง 5 ท่าเพื่อเปรียบเทียบ", "เลือกท่าไม่ถูกต้อง");
        return;
    }

    const history = [...state.history].slice().reverse();
    const allLabelsSet = new Set(history.map(entry => new Date(entry.isoDate).toLocaleDateString("th-TH", { month: "short", day: "numeric" })));
    const allLabels = Array.from(allLabelsSet).reverse();
    const datasets = [];
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']; // Blue, Green, Yellow, Red, Purple

    selectedExercises.forEach((exName, index) => {
        const dataMap = new Map();
        history.forEach(entry => {
            const exData = entry.exercises.find(ex => ex.name === exName);
            if (exData && exData.type !== 'cardio') {
                const dateLabel = new Date(entry.isoDate).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
                const max1RM = Math.max(...exData.sets.map(s => s.e1rm), 0);
                if (max1RM > 0) dataMap.set(dateLabel, max1RM);
            }
        });
        const color = colors[index % colors.length];
        datasets.push({
            label: exName,
            data: allLabels.map(label => dataMap.get(label) || null),
            borderColor: color,
            tension: 0.1,
            spanGaps: true,
            fill: false
        });
    });
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    state.charts.comparisonChart = new Chart(ctx, {
        type: 'line',
        data: { labels: allLabels, datasets },
        options: { responsive: true, scales: { y: { beginAtZero: false, title: { display: true, text: 'Estimated 1RM (kg)' } } } }
    });
}

export function generateMuscleBalanceChart() {
    if (typeof Chart === 'undefined') return;
    destroyChart('muscleBalanceChart');
    const history = state.history;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const volumeByGroup = Object.keys(muscleGroups).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    
    history.filter(entry => new Date(entry.isoDate) > thirtyDaysAgo).forEach(entry => {
        entry.exercises.forEach(ex => {
            const group = ex.muscleGroup || getMuscleGroup(ex.name);
            if (volumeByGroup.hasOwnProperty(group) && ex.type !== 'cardio') {
                volumeByGroup[group] += ex.volume;
            }
        });
    });
    
    const ctx = document.getElementById('muscleBalanceChart').getContext('2d');
    const labels = Object.keys(volumeByGroup).map(l => muscleGroups[l] || l);
    const data = Object.values(volumeByGroup);
    const themeColors = getThemeColors();

    state.charts.muscleBalanceChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{ 
                label: 'Volume Distribution', 
                data, 
                backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                borderColor: 'rgba(59, 130, 246, 1)', 
                pointBackgroundColor: 'rgba(59, 130, 246, 1)' 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            scales: { r: { angleLines: { color: themeColors.borderColor }, grid: { color: themeColors.borderColor }, pointLabels: { color: themeColors.textColor, font: { size: 12 } }, ticks: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });
}

export function generateExerciseCharts(exerciseName) {
    if (typeof Chart === 'undefined') return;
    destroyChart('chartVolume');
    destroyChart('chartStrength');
    
    if (!exerciseName) {
        DOM.exerciseAnalysisContent.innerHTML = "";
        return;
    }
    DOM.exerciseAnalysisContent.innerHTML = `<div class="chart-container"><h3>Total Volume (kg)</h3><canvas id="chartVolume"></canvas></div><div class="chart-container"><h3>Estimated 1RM Progression (kg)</h3><canvas id="chartStrength"></canvas></div>`;
    
    const history = state.history;
    const data = { labels: [], volumes: [], max1RMs: [] };
    
    history.slice().reverse().forEach(entry => {
        const exData = entry.exercises.find(ex => ex.name === exerciseName);
        if (exData && exData.type !== 'cardio') {
            const date = new Date(entry.isoDate).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
            const max1RM = Math.max(0, ...exData.sets.map(s => s.e1rm));
            data.labels.push(date);
            data.volumes.push(exData.volume);
            data.max1RMs.push(max1RM);
        }
    });
    
    const themeColors = getThemeColors();
    const ctxVolume = document.getElementById("chartVolume").getContext("2d");
    state.charts.chartVolume = new Chart(ctxVolume, {
        type: "bar",
        data: { labels: data.labels, datasets: [{ label: "Total Volume (kg)", data: data.volumes, backgroundColor: themeColors.successColor }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    const ctxStrength = document.getElementById("chartStrength").getContext("2d");
    state.charts.chartStrength = new Chart(ctxStrength, {
        type: "line",
        data: { labels: data.labels, datasets: [{ label: "Estimated 1RM (kg)", data: data.max1RMs, borderColor: themeColors.primaryColor, tension: 0.1, fill: true, backgroundColor: (context) => createChartGradient(context.chart.ctx, '--primary-color') }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
    });
}

export function renderBodyStatChart(metric) {
    if (typeof Chart === 'undefined') return;
    destroyChart('bodyStatChart');
    const canvas = document.getElementById("bodyStatChart");
    if (!canvas || state.bodyStats.length === 0) return;

    const data = { labels: [], values: [] };
    state.bodyStats.slice().reverse().forEach(stat => {
        if (stat[metric] !== undefined) {
            data.labels.push(new Date(stat.date).toLocaleDateString("th-TH", { month: "short", day: "numeric" }));
            data.values.push(stat[metric]);
        }
    });

    const ctx = canvas.getContext("2d");
    state.charts.bodyStatChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.labels,
            datasets: [{ label: bodyStatMetrics[metric], data: data.values, borderColor: getThemeColors().primaryColor, tension: 0.1, fill: true, backgroundColor: (context) => createChartGradient(context.chart.ctx, '--primary-color') }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
    });
}

export function generateCardioCharts() {
    if (typeof Chart === 'undefined') return;
    destroyChart('cardioDistanceChart');
    destroyChart('cardioPaceChart');
    destroyChart('cardioWeeklySummaryChart');

    const history = state.history;
    const cardioHistory = history.flatMap(entry => entry.exercises.filter(ex => ex.type === 'cardio').map(ex => ({ ...ex, date: new Date(entry.isoDate) }))).sort((a, b) => a.date - b.date);
    
    if (cardioHistory.length > 0) {
        const labels = cardioHistory.map(c => c.date.toLocaleDateString("th-TH", { month: "short", day: "numeric" }));
        const themeColors = getThemeColors();
        
        // Distance & Duration Chart
        const distanceData = {
            labels,
            datasets: [
                { label: 'ระยะทาง (กม.)', data: cardioHistory.map(c => c.distance), backgroundColor: themeColors.successColor, yAxisID: 'yDistance' },
                { label: 'ระยะเวลา (นาที)', data: cardioHistory.map(c => c.duration), type: 'line', yAxisID: 'yDuration', fill: false, borderColor: themeColors.primaryColor }
            ]
        };
        state.charts.cardioDistanceChart = new Chart(document.getElementById("cardioDistanceChart").getContext("2d"), {
            type: 'bar', data: distanceData,
            options: { scales: { yDistance: { position: 'left', title: { display: true, text: 'กม.' } }, yDuration: { position: 'right', title: { display: true, text: 'นาที' }, grid: { drawOnChartArea: false } } } }
        });

        // Pace Chart
        const paceValues = cardioHistory.map(c => c.distance > 0 ? c.duration / c.distance : null);
        const paceData = { labels, datasets: [{ label: "Pace (นาที/กม.)", data: paceValues, borderColor: themeColors.warningColor, tension: 0.1, fill: true, backgroundColor: 'rgba(245, 158, 11, 0.2)' }] };
        state.charts.cardioPaceChart = new Chart(document.getElementById("cardioPaceChart").getContext("2d"), {
            type: "line", data: paceData,
            options: { scales: { y: { reverse: true, title: { display: true, text: 'Pace (ยิ่งน้อยยิ่งดี)' } } } }
        });

        // Weekly Summary Chart
        const weeklyCardio = cardioHistory.reduce((acc, entry) => {
            const week = getWeekNumber(entry.date);
            if (!acc[week]) acc[week] = 0;
            acc[week] += entry.distance;
            return acc;
        }, {});
        const weeklyLabels = Object.keys(weeklyCardio).sort().slice(-12);
        const weeklyData = weeklyLabels.map(label => weeklyCardio[label]);
        state.charts.cardioWeeklySummaryChart = new Chart(document.getElementById('cardioWeeklySummaryChart').getContext('2d'), {
            type: 'bar',
            data: { labels: weeklyLabels, datasets: [{ label: 'Total Distance (km)', data: weeklyData, backgroundColor: themeColors.successColor }] },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'กม.' } } } }
        });
    }
}
