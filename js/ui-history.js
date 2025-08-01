// js/ui-history.js
// Manages all UI rendering for the History page.

import { DOM } from './dom.js';
import { state } from './state.js';
import { muscleGroupColors } from './config.js';
import { getMuscleGroup } from './utils.js';
import { createElement, showPage, showAnalysisTab } from './ui-core.js';
import * as chartLogics from './charts.js';

/**
 * โหลดและแสดงผลหน้าประวัติทั้งหมด
 */
export function loadHistory() {
    DOM.historyContainer.innerHTML = "";
    renderCalendar(state.currentCalendarDate.getFullYear(), state.currentCalendarDate.getMonth());
    
    const history = state.history;
    if (history.length === 0) {
        DOM.historyContainer.innerHTML = "<p>ยังไม่มีประวัติการฝึก</p>";
        return;
    }

    history.forEach((entry, index) => {
        createHistoryEntryCard(entry, index);
    });

    filterHistory();
    if(window.feather) window.feather.replace();
}

/**
 * สร้าง Card สำหรับแต่ละวันในประวัติ
 * @param {object} entry - ข้อมูลประวัติ 1 วัน
 * @param {number} index - Index ของข้อมูลใน array
 */
function createHistoryEntryCard(entry, index) {
    const entryCard = document.createElement("div");
    entryCard.className = "card";
    entryCard.id = `history-card-${index}`;
    const date = new Date(entry.isoDate);
    const dateString = date.toLocaleDateString("th-TH", { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    const deleteButton = createElement('button', {
        classes: ['history-card-delete-btn', 'btn-delete'],
        datasets: { action: 'delete-entry', index },
        innerHTML: '<i data-feather="x-circle"></i>'
    });

    // --- BUG FIX: เปลี่ยน text เป็น textContent ---
    const title = createElement('h4', { textContent: dateString, classes:['history-card-title'] });
    const stats = createElement('div', { textContent: `⏱️ ${entry.duration}   🔥 ${entry.totalVolume.toFixed(0)} kg`, classes: ['history-card-stats'] });
    const hr = createElement('hr', { classes: ['history-card-divider'] });
    
    entryCard.append(deleteButton, title, stats, hr);
    entry.exercises.forEach((ex, exIndex) => {
        entryCard.appendChild(createHistoryExerciseHTML(ex, index, exIndex));
    });
    
    DOM.historyContainer.appendChild(entryCard);
}

/**
 * สร้าง HTML สำหรับแต่ละท่าในประวัติ
 * @param {object} ex - ข้อมูลท่าออกกำลังกาย
 * @param {number} historyIndex - Index ของวัน
 * @param {number} exIndex - Index ของท่า
 * @returns {HTMLElement}
 */
function createHistoryExerciseHTML(ex, historyIndex, exIndex) {
    if (ex.type === 'cardio') {
        return createElement('div', {
            id: `history-ex-${historyIndex}-${exIndex}`,
            classes: ['history-exercise-container'],
            children: [
                createElement('div', {
                    classes: ['history-exercise-header'],
                    children: [
                        createElement('div', {
                            classes: ['history-cardio-title'],
                            children: [
                                createElement('i', { datasets: { feather: 'trending-up' } }),
                                // --- BUG FIX: เปลี่ยน text เป็น textContent ---
                                createElement('span', { textContent: `${ex.name || 'Cardio'}: ${ex.distance} กม. ใน ${ex.duration} นาที` })
                            ]
                        }),
                        createElement('button', { classes: ['btn-delete'], datasets: { action: 'delete-exercise', historyIndex, exIndex }, innerHTML: '<i data-feather="trash-2"></i>' })
                    ]
                }),
                // --- BUG FIX: เปลี่ยน text เป็น textContent ---
                ...(ex.notes ? [createElement('p', { textContent: `📝 ${ex.notes}`, classes:['history-cardio-notes'] })] : [])
            ]
        });
    }

    const maxWeightSet = ex.sets.reduce((max, set) => set.weight > max.weight ? set : max, { weight: 0 });
    const isWeightPR = (state.history[historyIndex].prsAchieved || []).some(pr => pr.type === 'weight' && pr.exercise === ex.name && pr.weight === maxWeightSet.weight);
    
    const setElements = ex.sets.map((set, setIndex) => {
        const isRepPR = (state.history[historyIndex].prsAchieved || []).some(pr => pr.type === 'reps' && pr.exercise === ex.name && pr.weight === set.weight && pr.reps === set.reps);
        return createElement('div', {
            classes: ['history-set-item', ...(isRepPR ? ['pr-highlight'] : [])],
            children: [
                // --- BUG FIX: เปลี่ยน text เป็น textContent ---
                createElement('span', { textContent: `Set ${setIndex + 1}: ${set.weight}kg x ${set.reps} reps @${set.rpe} ${isRepPR ? '⭐' : ''}` }),
                createElement('button', {
                    classes: ['btn-delete'],
                    datasets: { action: 'delete-set', historyIndex, exIndex, setIndex },
                    innerHTML: '<i data-feather="trash-2"></i>'
                })
            ]
        });
    });

    const detailsDiv = createElement('div', {
        id: `set-details-${historyIndex}-${exIndex}`,
        classes: ['hidden', 'history-set-details-container'],
        children: [
            ...setElements,
            // --- BUG FIX: เปลี่ยน text เป็น textContent ---
            ...(ex.notes ? [createElement('p', { textContent: `📝 ${ex.notes}`, classes:['history-exercise-notes-p'] })] : []),
            createElement('button', {
                classes: ['action-btn', 'danger', 'history-delete-exercise-btn'],
                datasets: { action: 'delete-exercise', historyIndex, exIndex },
                innerHTML: `<i data-feather="trash"></i> ลบท่า ${ex.name} ทั้งหมด`
            })
        ]
    });

    return createElement('div', {
        id: `history-ex-${historyIndex}-${exIndex}`,
        classes: ['history-exercise-container'],
        children: [
            createElement('div', {
                classes: ['history-exercise-header'],
                children: [
                    createElement('div', {
                        classes: ['history-exercise-title', ...(isWeightPR ? ['pr-highlight'] : [])],
                        // --- BUG FIX: เปลี่ยน text เป็น textContent ---
                        textContent: `▪️ ${ex.name} ${isWeightPR ? '⭐' : ''}`,
                        datasets: { exerciseName: ex.name }
                    }),
                    createElement('button', { 
                        classes: ['history-menu-btn'], 
                        datasets: { action: 'toggle-sets' }, 
                        innerHTML: '<i data-feather="menu"></i>' 
                    })
                ]
            }),
            detailsDiv
        ]
    });
}


/**
 * แสดงผลปฏิทิน
 * @param {number} year 
 * @param {number} month 
 */
export function renderCalendar(year, month) {
    const historyByDate = state.history.reduce((acc, entry) => {
        const date = entry.isoDate.slice(0, 10);
        if (!acc[date]) acc[date] = new Set();
        entry.exercises.forEach(ex => acc[date].add(ex.muscleGroup || getMuscleGroup(ex.name)));
        return acc;
    }, {});
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const dayNames = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
    const firstDay = new Date(year, month).getDay();
    const daysInMonth = 32 - new Date(year, month, 32).getDate();
    
    let calendarHTML = `
    <div class="calendar-header">
        <button class="calendar-nav" data-direction="-1"><i data-feather="chevron-left"></i></button>
        <span id="calendar-month-year">${monthNames[month]} ${year + 543}</span>
        <button class="calendar-nav" data-direction="1"><i data-feather="chevron-right"></i></button>
    </div>
    <div class="calendar-grid">${dayNames.map(day => `<div class="calendar-day-name">${day}</div>`).join('')}`;
    for (let i = 0; i < firstDay; i++) calendarHTML += `<div class="calendar-day other-month"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const muscleGroupsOnDay = historyByDate[dateStr];
        let dotsHTML = '';
        let hasWorkoutClass = '';
        if (muscleGroupsOnDay) {
            hasWorkoutClass = 'has-workout';
            dotsHTML = `<div class="dots-container">${Array.from(muscleGroupsOnDay).map(mg => `<div class="muscle-dot" style="background-color: ${muscleGroupColors[mg] || muscleGroupColors['Other']};"></div>`).join('')}</div>`;
        }
        calendarHTML += `<div class="calendar-day ${hasWorkoutClass}" data-date="${dateStr}"><div class="day-number">${day}</div>${dotsHTML}</div>`;
    }
    calendarHTML += '</div>';
    DOM.calendarView.innerHTML = calendarHTML;
    if(window.feather) window.feather.replace();
}

/**
 * เปลี่ยนเดือนที่แสดงในปฏิทิน
 * @param {number} direction - 1 หรือ -1
 */
export function changeMonth(direction) {
    state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + direction);
    renderCalendar(state.currentCalendarDate.getFullYear(), state.currentCalendarDate.getMonth());
}

/**
 * เลื่อนไปยังรายการประวัติที่ตรงกับวันที่ที่เลือก
 * @param {string} dateStr - วันที่ (YYYY-MM-DD)
 */
export function scrollToHistoryEntry(dateStr) {
    const history = state.history;
    const entryIndex = history.findIndex(entry => entry.isoDate && entry.isoDate.startsWith(dateStr));
    if (entryIndex !== -1) {
        const cardId = `history-card-${entryIndex}`;
        const element = document.getElementById(cardId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.transition = 'background-color 0.5s';
            element.style.backgroundColor = 'var(--border-color)';
            setTimeout(() => { element.style.backgroundColor = ''; }, 1500);
        }
    }
}

/**
 * กรองรายการประวัติจากช่องค้นหา
 */
export function filterHistory() {
    const searchTerm = DOM.historySearch.value.toLowerCase();
    const entryCards = DOM.historyContainer.querySelectorAll('.card');
    entryCards.forEach(card => {
        const cardText = card.textContent.toLowerCase();
        card.style.display = cardText.includes(searchTerm) ? 'block' : 'none';
    });
}

/**
 * เปิด/ปิด รายละเอียดเซ็ตในหน้าประวัติ
 * @param {HTMLElement} buttonElement - ปุ่มที่ถูกกด
 */
export function toggleSetDetails(buttonElement) {
    const exerciseContainer = buttonElement.closest('.history-exercise-container');
    if (exerciseContainer) {
        const detailsContainer = exerciseContainer.querySelector('.history-set-details-container');
        if (detailsContainer) {
            detailsContainer.classList.toggle('hidden');
        } else {
            console.error("Could not find the details container for the clicked button.", buttonElement);
        }
    } else {
        console.error("Could not find the parent exercise container for the clicked button.", buttonElement);
    }
}

/**
 * นำทางไปยังหน้า Analysis สำหรับท่าที่เลือก
 * @param {string} exerciseName 
 */
export function viewAnalysisFor(exerciseName) {
    showPage('analysis');
    showAnalysisTab('per_exercise', true);
    DOM.exerciseSelect.value = exerciseName;
    chartLogics.generateExerciseCharts(exerciseName);
}
