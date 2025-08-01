// js/ui-shared.js
// รวบรวมฟังก์ชันสำหรับสร้างและจัดการ UI ที่ใช้ร่วมกันในหลายๆ หน้า
// เช่น หน้า PRs, หน้า Body Stats, และ Select Box ต่างๆ

import { DOM } from './dom.js';
import { state } from './state.js';
import { loadData } from './storage.js';
import { muscleGroups, bodyStatMetrics, cardioTypes } from './config.js';
import { createElement } from './ui-core.js';
import { stopWorkoutTimer } from './logic.js';

/**
 * แสดงผลหน้าสถิติส่วนตัว (Personal Records)
 */
export function renderPRsPage() {
    const prContainer = document.getElementById('pr-list-container');
    if (!prContainer) return;
    prContainer.innerHTML = '';

    const prs = state.personalRecords;
    const sortedExercises = Object.keys(prs).sort();

    if (sortedExercises.length === 0) {
        prContainer.innerHTML = '<p style="text-align:center; opacity:0.7;">ยังไม่มีสถิติส่วนตัว<br>บันทึกการฝึกเพื่อสร้างสถิติ!</p>';
        return;
    }

    sortedExercises.forEach(exName => {
        const prData = prs[exName];
        if (!prData || !prData.maxWeight) return;

        const repPRs = Object.entries(prData.repPRs || {})
            .sort((a, b) => b[0] - a[0]) // Sort by weight descending
            .map(([weight, reps]) => `<li>${weight} kg &times; ${reps} reps</li>`)
            .join('');

        const prItem = createElement('div', {
            classes: ['pr-item'],
            innerHTML: `
                <div class="pr-item-header">
                    <span class="pr-exercise-name">${exName}</span>
                    <span class="pr-weight">${prData.maxWeight} kg</span>
                </div>
                <div class="rep-pr-details">
                    <h4>สถิติจำนวนครั้ง (Rep PRs)</h4>
                    <ul>${repPRs || '<li>ไม่มีข้อมูล</li>'}</ul>
                </div>
            `
        });
        prContainer.appendChild(prItem);
    });
}


/**
 * แสดงผลหน้าข้อมูลร่างกาย (Body Stats) ในแท็บ Analysis
 */
export function renderBodyStatsPage() {
    const historyList = document.getElementById('body-stats-history-list');
    if (!historyList) return;

    // Populate select dropdown
    DOM.bodyStatSelect.innerHTML = Object.entries(bodyStatMetrics)
        .map(([key, value]) => `<option value="${key}">${value}</option>`)
        .join('');

    // Render history list
    historyList.innerHTML = '';
    if (state.bodyStats.length === 0) {
        historyList.innerHTML = '<p style="text-align:center; opacity:0.7;">ยังไม่มีการบันทึกข้อมูลร่างกาย</p>';
        return;
    }

    state.bodyStats.forEach(stat => {
        const date = new Date(stat.date);
        const dateString = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

        const detailsHTML = Object.keys(bodyStatMetrics)
            .map(metric => stat[metric] ? `<span>${bodyStatMetrics[metric]}: <strong>${stat[metric]}</strong></span>` : '')
            .filter(Boolean)
            .join('');

        const item = createElement('div', {
            classes: ['body-stat-item'],
            children: [
                createElement('div', {
                    classes: ['body-stat-details'],
                    innerHTML: `<span class="body-stat-date">${dateString}</span> ${detailsHTML}`
                }),
                createElement('button', {
                    classes: ['btn-delete'],
                    datasets: { action: 'delete-body-stat', date: stat.date },
                    innerHTML: '<i data-feather="trash-2"></i>'
                })
            ]
        });
        historyList.appendChild(item);
    });
    if (window.feather) window.feather.replace();
}

/**
 * แสดงผล Modal สรุปผลการฝึก
 */
export function showWorkoutSummary() {
    const summaryModal = document.getElementById('summary-modal');
    if (!summaryModal) return;

    const totalVolume = Object.values(state.currentWorkoutLog).reduce((sum, ex) => sum + (ex.volume || 0), 0);
    const totalSets = Object.values(state.currentWorkoutLog).reduce((sum, ex) => sum + (ex.sets ? ex.sets.length : 0), 0);

    let durationStr = "N/A";
    if (state.workoutStartTime) {
        const elapsed = Math.floor((Date.now() - state.workoutStartTime) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor(elapsed % 3600 / 60).toString().padStart(2, '0');
        const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
        durationStr = `${h}:${m}:${s}`;
    }

    document.getElementById('summary-volume').textContent = `${totalVolume.toLocaleString()} kg`;
    document.getElementById('summary-duration').textContent = durationStr;
    document.getElementById('summary-sets').textContent = totalSets;

    const prsContainer = document.getElementById('summary-prs-container');
    const prsList = document.getElementById('summary-prs-list');
    if (state.currentSessionPRs.length > 0) {
        prsContainer.classList.remove('hidden');
        prsList.innerHTML = state.currentSessionPRs.map(pr => {
            if (pr.type === 'weight') {
                return `<li><strong>${pr.exercise}</strong>: น้ำหนักสูงสุดใหม่ <strong>${pr.weight} kg</strong>!</li>`;
            } else {
                return `<li><strong>${pr.exercise}</strong>: สถิติใหม่ที่ <strong>${pr.weight} kg</strong> &times; <strong>${pr.reps}</strong> ครั้ง!</li>`;
            }
        }).join('');
        
        const trophy = document.getElementById('summary-trophy');
        if (trophy) {
            trophy.style.animation = 'none';
            trophy.offsetHeight; // Trigger reflow
            trophy.style.animation = 'celebrate-trophy 0.8s ease-out forwards';
        }
        if (typeof confetti === 'function') {
            confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
        }
    } else {
        prsContainer.classList.add('hidden');
        prsList.innerHTML = '';
    }

    summaryModal.classList.remove('hidden');
    stopWorkoutTimer();
}

/**
 * ใส่ข้อมูลท่าออกกำลังกายทั้งหมดลงใน Select Box
 */
export function populateAllExerciseSelects() {
    const historyExercises = new Set(state.history.flatMap(entry => entry.exercises.map(ex => ex.name)));
    const planExercises = new Set(state.workoutPlans.flatMap(plan => plan.days.flatMap(day => day.exercises.map(ex => ex.name))));
    const allExercises = [...new Set([...historyExercises, ...planExercises])].sort();

    const selects = [DOM.exerciseSelect, DOM.compareExerciseSelect];
    selects.forEach(select => {
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- เลือกท่า --</option>';
            allExercises.forEach(exName => {
                if (exName) { // Ensure name is not empty
                    select.add(new Option(exName, exName));
                }
            });
            select.value = currentValue;
        }
    });
}

/**
 * ใส่ข้อมูลกลุ่มกล้ามเนื้อลงใน Select Box
 */
export function populateMuscleGroupSelects() {
    const selects = document.querySelectorAll('#quick-log-muscle-group, #new-exercise-muscle-group');
    selects.forEach(select => {
        if (select) {
            select.innerHTML = Object.entries(muscleGroups)
                .map(([key, value]) => `<option value="${key}">${value}</option>`)
                .join('');
        }
    });
    const cardioSelect = document.getElementById('quick-log-cardio-type');
    if (cardioSelect) {
        cardioSelect.innerHTML = cardioTypes.map(type => `<option value="${type}">${type}</option>`).join('');
    }
}

/**
 * แสดงรายการ Auto Backup ในหน้า Settings
 */
export function renderAutoBackupList() {
    const container = document.getElementById('auto-backup-list');
    if (!container) return;
    const backups = loadData('gymAutoBackups', []);

    if (backups.length === 0) {
        container.innerHTML = '<p style="text-align:center; opacity:0.7;">ยังไม่มีจุดสำรองข้อมูลอัตโนมัติ</p>';
        return;
    }

    container.innerHTML = backups.map(backup => {
        const date = new Date(backup.timestamp);
        const dateString = date.toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        return `
            <div class="list-item">
                <span>${dateString}</span>
                <div class="btn-group">
                    <button data-action="restore-auto-backup" data-timestamp="${backup.timestamp}" title="กู้คืน"><i data-feather="upload"></i></button>
                    <button class="btn-delete" data-action="delete-auto-backup" data-timestamp="${backup.timestamp}" title="ลบ"><i data-feather="trash-2"></i></button>
                </div>
            </div>
        `;
    }).join('');
    if (window.feather) window.feather.replace();
}

/**
 * อัปเดตค่าในช่องกรอกข้อมูลอุปกรณ์
 */
export function updateEquipmentInputs() {
    if (DOM.equipmentBarbellWeight) {
        DOM.equipmentBarbellWeight.value = state.userEquipment.barbellWeight || '';
    }
    if (DOM.equipmentPlates) {
        DOM.equipmentPlates.value = (state.userEquipment.availablePlates || []).join(', ');
    }
}

/**
 * เปิดและคำนวณ Plate Calculator
 * @param {string} cardId - ID ของการ์ดออกกำลังกาย
 */
export function openPlateCalculator(cardId) {
    const weightInput = document.getElementById(`weight-${cardId}`);
    const targetWeight = parseFloat(weightInput.value);

    if (isNaN(targetWeight) || targetWeight <= 0) {
        alert("กรุณากรอกน้ำหนักเป้าหมายก่อน");
        return;
    }

    const { barbellWeight, availablePlates } = state.userEquipment;
    const weightPerSide = (targetWeight - barbellWeight) / 2;

    if (weightPerSide < 0) {
        alert("น้ำหนักเป้าหมายต้องมากกว่าน้ำหนักแกน");
        return;
    }

    let remainingWeight = weightPerSide;
    const platesForSide = [];

    availablePlates.forEach(plateWeight => {
        while (remainingWeight >= plateWeight) {
            platesForSide.push(plateWeight);
            remainingWeight -= plateWeight;
        }
    });

    const visContainer = document.getElementById('barbell-visualization');
    visContainer.innerHTML = '';

    const createPlatesHTML = (plates) => plates.map(p => `<div class="plate" style="height:${20 + p * 2}px">${p}</div>`).join('');

    visContainer.innerHTML = `
        ${createPlatesHTML([...platesForSide].reverse())}
        <div class="barbell-sleeve"></div>
        <div class="barbell-sleeve"></div>
        ${createPlatesHTML(platesForSide)}
    `;

    document.getElementById('calculator-target-weight').textContent = `เป้าหมาย: ${targetWeight} kg`;
    document.getElementById('plates-per-side-text').textContent = `ใส่ข้างละ: ${platesForSide.join(', ') || 'ไม่ต้องใส่'} (เหลือ ${remainingWeight.toFixed(2)} kg)`;
    document.getElementById('plate-calculator-modal').classList.remove('hidden');
}
