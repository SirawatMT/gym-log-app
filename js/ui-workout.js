// js/ui-workout.js
// Manages all UI rendering for the main Workout page.

import { DOM } from './dom.js';
import { state } from './state.js';
import { createElement } from './ui-core.js';
import * as coach from './coach.js';
import { createExerciseCard } from './components/ExerciseCard.js';

/**
 * อัปเดต Badge แจ้งเตือนของ Coach's Corner
 */
function updateCoachNotificationBadge() {
    const badge = document.getElementById('coach-notification-badge');
    if (badge) {
        badge.classList.toggle('hidden', state.coachSuggestions.length === 0);
    }
}

function createSuggestionHTML(suggestion) {
    const { type, data } = suggestion;
    let title = "โค้ชสายโหด";
    let content = "";
    let buttons = "";

    switch (type) {
        case 'skipped':
            const todayDayIndex = (new Date().getDay() === 0) ? 6 : new Date().getDay() - 1;
            const todayDayName = state.workoutPlans[state.activePlanIndex].days[todayDayIndex].name;
            title = "โดดฝึกเหรอ?!";
            content = `<p>คุณโดดการฝึก '${data.skippedDayName}' มานะ! อย่าหาข้ออ้าง ลุกไปเล่นเซสชันที่ข้ามไป หรือจะเล่นโปรแกรมของวันนี้ก็ได้</p>`;
            buttons = `
                <button class="action-btn primary" data-action="play-skipped" data-day-index="${data.skippedDayIndex}">เล่นเซสชันที่ข้ามไป</button>
                <button class="action-btn secondary" data-action="play-today" data-day-index="${todayDayIndex}">ทำโปรแกรมวันนี้ (${todayDayName})</button>
            `;
            break;
        case 'inactivity':
            title = "หายไปไหนมา?!";
            content = `<p>นี่หายไปไหนมา ${data.days} วันแล้ว?! เหล็กที่บ้านคงคิดถึงคุณแล้วนะ ลุกไปซ้อมได้แล้ว!</p>`;
            break;
        case 'deload':
            title = "ถึงเวลาพักแล้วมั้ง?";
            content = `<p>Volume ตกมาต่อเนื่องแล้วนะ! ถ้าไม่ไหวก็พัก (Deload) หรือลองเปลี่ยนไปเล่นหนักขึ้นในจำนวนครั้งที่น้อยลงดู (เช่น 4-6 reps) เพื่อกระตุ้นร่างกาย</p>`;
            break;
    }

    return `
        <div class="suggestion-card danger">
            <h3><i data-feather="alert-triangle"></i> ${title}</h3>
            ${content}
            <div class="d-flex flex-column-gap-10 mt-15">${buttons}</div>
        </div>
    `;
}


/**
 * ตั้งค่าหน้า Workout สำหรับวันปัจจุบัน
 * @param {number} [forceDayIndex=-1] - บังคับให้แสดงผลสำหรับ day index ที่กำหนด
 */
export function setupTodayWorkout(forceDayIndex = -1) {
    state.isWorkoutOverridden = false;
    setOverrideButtonState(false);
    exitProgramSelectionMode();

    const completedControls = document.getElementById('completed-controls');
    if (completedControls) completedControls.classList.add('hidden');
    
    DOM.finishWorkoutBtn.classList.add('hidden');
    DOM.quickLogBtnTop.classList.remove('hidden');
    
    if (DOM.quickLogForm) DOM.quickLogForm.classList.remove('visible');
    if (DOM.quickLogCardioForm) DOM.quickLogCardioForm.classList.remove('visible');

    try {
        state.currentSessionPRs = [];
        
        coach.generateCoachSuggestions();
        updateCoachNotificationBadge();

        const today = new Date();
        const dayOfWeek = today.getDay();
        let dayIndex = (forceDayIndex > -1) ? forceDayIndex : (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        
        // --- DEFINITIVE FIX: แก้ไขตรรกะการแสดงผลหน้าจอให้ครอบคลุมทุกกรณี ---
        // หากโค้ชมีคำแนะนำใดๆ (ไม่ใช่แค่ 'skipped') และยังไม่มีการ override
        // ให้แสดงการ์ดวันพักอัจฉริยะ เพื่อป้องกันหน้าจอว่างและแอปค้าง
        if (state.coachSuggestions.length > 0 && forceDayIndex === -1) {
            renderSmartRestDayCard(); 
        } else {
            // ตรรกะเดิม: แสดงผลโปรแกรมของวันปัจจุบันหรือวันที่ถูกบังคับ
            renderWorkoutForDay(dayIndex);
        }
        
    } catch (error) {
        console.error("Error in setupTodayWorkout:", error);
        document.getElementById('exercise-list').innerHTML = '<p style="color:red;">เกิดข้อผิดพลาดร้ายแรงในการโหลดโปรแกรมวันนี้</p>';
    }
}

/**
 * แสดงผลรายการออกกำลังกายสำหรับวันที่กำหนด
 * @param {number} dayIndex - Index ของวันในสัปดาห์ (0-6)
 * @param {boolean} [isOverride=false] - เป็นการ override โปรแกรมปกติหรือไม่
 */
export function renderWorkoutForDay(dayIndex, isOverride = false) {
    const exerciseList = document.getElementById('exercise-list');
    
    exerciseList.innerHTML = '';

    if (!isOverride) {
        state.workoutStartTime = null;
        clearInterval(state.workoutTimerInterval);
        document.getElementById("total-duration-display").textContent = "";
        state.currentWorkoutLog = {};
    }

    const currentPlan = state.workoutPlans[state.activePlanIndex];
    if (!currentPlan || !currentPlan.days || !currentPlan.days[dayIndex]) {
        document.getElementById('workout-day-title').textContent = "ไม่พบโปรแกรม";
        exerciseList.innerHTML = '<p>กรุณาไปที่หน้า "ตารางฝึก" เพื่อสร้างหรือเลือกใช้โปรแกรม</p>';
        return;
    }
    const day = currentPlan.days[dayIndex];
    document.getElementById('workout-day-title').textContent = isOverride ? `${day.name} (Override)` : day.name;
    
    if (day.exercises.length === 0 && !isOverride) {
        renderSmartRestDayCard();
        return;
    }

    day.exercises.forEach((ex) => {
        const exName = ex.name;
        if (state.currentWorkoutLog[exName] && !isOverride) return;
        state.currentWorkoutLog[exName] = { 
            name: exName, 
            sets: [], 
            notes: '', 
            muscleGroup: ex.muscleGroup,
            isBodyweight: ex.isBodyweight || false 
        };
        
        const card = createExerciseCard(ex);
        exerciseList.appendChild(card);
    });
    if(window.feather) window.feather.replace();
}

/**
 * อัปเดตสถานะของปุ่ม Override
 * @param {boolean} isOverriding - กำลัง override อยู่หรือไม่
 */
export function setOverrideButtonState(isOverriding) {
    const overrideBtn = document.getElementById('override-btn');
    if (isOverriding) {
        overrideBtn.innerHTML = '<i data-feather="x-circle"></i>';
        overrideBtn.classList.add('danger-style');
    } else {
        overrideBtn.innerHTML = '<i data-feather="calendar"></i>';
        overrideBtn.classList.remove('danger-style');
    }
    if(window.feather) window.feather.replace();
}

/**
 * เข้าสู่โหมดเลือกโปรแกรมที่จะเล่น
 */
export function enterProgramSelectionMode() {
    const currentPlan = state.workoutPlans[state.activePlanIndex];
    if (!currentPlan) return;

    let buttonsHTML = currentPlan.days.map((day, index) => {
        return `<button class="action-btn secondary" data-override-day-index="${index}">${day.name}</button>`;
    }).join('');
    buttonsHTML += `<button class="action-btn neutral mt-15" data-action="cancel-override">ยกเลิก</button>`;

    DOM.programSelectionView.innerHTML = buttonsHTML;
    DOM.workoutPage.classList.add('selection-mode-active');
    DOM.programSelectionView.classList.remove('hidden');
    document.getElementById('workout-day-title').textContent = "เลือกโปรแกรมที่จะเล่นวันนี้";
}

/**
 * ออกจากโหมดเลือกโปรแกรม
 */
export function exitProgramSelectionMode() {
    DOM.workoutPage.classList.remove('selection-mode-active');
    DOM.programSelectionView.classList.add('hidden');
    DOM.programSelectionView.innerHTML = '';
}

/**
 * แสดง Modal ของ Coach's Corner
 */
export function showCoachCornerModal() {
    const listContainer = document.getElementById('coach-suggestions-list');
    if (!listContainer) return;

    if (state.coachSuggestions.length > 0) {
        listContainer.innerHTML = state.coachSuggestions.map(createSuggestionHTML).join('');
    } else {
        listContainer.innerHTML = '<p style="text-align:center; opacity:0.7;">ไม่มีคำแนะนำในขณะนี้</p>';
    }
    
    DOM.coachCornerModal.classList.remove('hidden');
    if (window.feather) window.feather.replace();

    state.coachSuggestions = [];
    updateCoachNotificationBadge();
}


/**
 * แสดงผล Smart Card สำหรับวันพัก
 */
export function renderSmartRestDayCard() {
    const exerciseList = document.getElementById('exercise-list');
    exerciseList.innerHTML = '';
    const stats = getWeeklySummaryStats();
    const tips = [
        "การพักผ่อนก็คือส่วนหนึ่งของการฝึกซ้อม",
        "อย่าลืมโปรตีนในวันพักเพื่อซ่อมแซมกล้ามเนื้อนะ",
        "การยืดเส้นยืดสายเบาๆ ช่วยลดอาการปวดเมื่อยได้",
        "การนอนให้พอสำคัญต่อการสร้างกล้ามเนื้อมาก!",
        "ลองวางแผนการฝึกของสัปดาห์หน้าในวันพักดูสิ"
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    const cardHTML = `
    <div class="card rest-day-card smart" id="rest-day-card">
        <h2 class="no-border"><i data-feather="coffee"></i> วันพักผ่อน</h2>
        <p>พักผ่อนให้เต็มที่เพื่อการฝึกที่แข็งแกร่งกว่าเดิม!</p>
        <div class="rest-day-section">
            <h4>ภาพรวมสัปดาห์นี้</h4>
            <p>💪 คุณฝึกไปแล้ว ${stats.workoutDays} วัน | 🔥 Volume รวม: ${stats.totalVolume.toLocaleString()} kg</p>
        </div>
        <div class="rest-day-section">
            <h4><i data-feather="sun"></i> เคล็ดลับวันนี้</h4>
            <p><em>${randomTip}</em></p>
        </div>
        <div class="rest-day-section">
            <h4>บันทึกกิจกรรมเพิ่มเติม</h4>
            <div class="d-flex gap-10">
                <button class="action-btn secondary" data-action="rest-day-cardio"><i data-feather="trending-up"></i> คาร์ดิโอ</button>
                <button class="action-btn secondary" data-action="rest-day-weight"><i data-feather="bar-chart-2"></i> เวทเทรนนิ่ง</button>
            </div>
        </div>
        <div class="rest-day-section">
            <h4>ทางลัด</h4>
            <div class="d-flex gap-10">
                <button class="action-btn neutral" data-action="go-to-history"><i data-feather="book-open"></i> ดูประวัติ</button>
                <button class="action-btn neutral" data-action="go-to-analysis"><i data-feather="pie-chart"></i> ดูสถิติ</button>
            </div>
        </div>
    </div>`;
    exerciseList.innerHTML = cardHTML;
    if(window.feather) window.feather.replace();
}

/**
 * คำนวณสถิติสรุปรายสัปดาห์
 * @returns {object} - สถิติสรุป
 */
export function getWeeklySummaryStats() {
    const history = state.history;
    const today = new Date();
    
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const recentWorkouts = history.filter(entry => new Date(entry.isoDate) >= startOfWeek);
    const workoutDays = new Set(recentWorkouts.map(entry => entry.id)).size;
    const totalVolume = recentWorkouts.reduce((sum, entry) => sum + entry.totalVolume, 0);
    return { workoutDays, totalVolume };
}

export function toggleQuickLogMenu() {
    DOM.quickLogPopup.classList.toggle('hidden');
    if (!DOM.quickLogPopup.classList.contains('hidden')) {
        if(window.feather) window.feather.replace();
    }
}

export function hideQuickLogMenu() {
    DOM.quickLogPopup.classList.add('hidden');
}

export function toggleQuickLogPanel(panelId) {
    hideQuickLogMenu();
    const targetPanel = document.getElementById(panelId);
    if (!targetPanel) return;

    const isAlreadyVisible = targetPanel.classList.contains('visible');

    document.querySelectorAll('.quick-log-panel.visible').forEach(panel => {
        panel.classList.remove('visible');
    });

    if (!isAlreadyVisible) {
        targetPanel.classList.add('visible');
    }
}

export function renderCardioLogInPage(cardioData) {
    const exerciseList = document.getElementById('exercise-list');
    const card = createElement('div', {
        classes: ['card', 'exercise-card', 'cardio'],
        children: [
            createElement('div', {
                classes: ['d-flex', 'justify-content-between', 'align-items-center'],
                children: [
                    createElement('div', {
                        classes: ['d-flex', 'align-items-center', 'gap-10', 'fw-bold', 'text-success'],
                        children: [
                            createElement('i', { datasets: { feather: 'trending-up' } }),
                            createElement('span', { textContent: `${cardioData.name}: ${cardioData.distance} กม. ใน ${cardioData.duration} นาที` })
                        ]
                    })
                ]
            }),
            ...(cardioData.notes ? [createElement('p', { textContent: `📝 ${cardioData.notes}`, classes:['fs-sm', 'opacity-8', 'mt-2', 'ps-4'] })] : [])
        ]
    });
    exerciseList.insertBefore(card, exerciseList.firstChild);
    if(window.feather) window.feather.replace();
}

export function renderQuickWeightLogInPage(exerciseName, setData) {
    const exerciseList = document.getElementById('exercise-list');
    const card = createElement('div', {
        classes: ['card', 'exercise-card', 'freestyle'],
        children: [
            createElement('div', {
                classes: ['d-flex', 'justify-content-between', 'align-items-center'],
                children: [
                    createElement('div', {
                        classes: ['d-flex', 'align-items-center', 'gap-10', 'fw-bold', 'text-success'],
                        children: [
                            createElement('i', { datasets: { feather: 'bar-chart-2' } }),
                            createElement('span', { textContent: `${exerciseName}: ${setData.weight} kg x ${setData.reps} reps` })
                        ]
                    })
                ]
            })
        ]
    });
    exerciseList.insertBefore(card, exerciseList.firstChild);
    if(window.feather) window.feather.replace();
}

export function toggleComplete(cardId, isChecked) {
    const card = document.getElementById(cardId);
    if (!card) return;

    if (card.dataset.hideTimeoutId) {
        clearTimeout(parseInt(card.dataset.hideTimeoutId));
        delete card.dataset.hideTimeoutId;
    }

    card.classList.toggle("completed", isChecked);

    if (isChecked) {
        const timeoutId = setTimeout(() => {
            card.classList.add('collapsible-hidden');
            updateCompletedControls();
            delete card.dataset.hideTimeoutId; 
        }, 300);
        card.dataset.hideTimeoutId = timeoutId;
    } else {
        card.classList.remove('collapsible-hidden');
        updateCompletedControls();
    }
}

export function updateCompletedControls() {
    const completedCount = document.querySelectorAll('.exercise-card.completed.collapsible-hidden').length;
    const totalCompleted = document.querySelectorAll('.exercise-card.completed').length;
    const controlsContainer = document.getElementById('completed-controls');
    const toggleBtn = document.getElementById('toggle-completed-visibility');
    if (totalCompleted > 0) {
        controlsContainer.classList.remove('hidden');
        if (completedCount > 0) {
            toggleBtn.textContent = `แสดงท่าที่ฝึกเสร็จแล้ว (${completedCount})`;
            toggleBtn.dataset.state = 'hidden';
        } else {
            toggleBtn.textContent = 'ซ่อนท่าที่ฝึกเสร็จแล้ว';
            toggleBtn.dataset.state = 'shown';
        }
    } else {
        controlsContainer.classList.add('hidden');
    }
}

export function toggleCompletedVisibility() {
    const btn = document.getElementById('toggle-completed-visibility');
    const currentState = btn.dataset.state;
    const completedCards = document.querySelectorAll('.exercise-card.completed');
    if (currentState === 'hidden') {
        completedCards.forEach(card => card.classList.remove('collapsible-hidden'));
    } else {
        completedCards.forEach(card => card.classList.add('collapsible-hidden'));
    }
    updateCompletedControls();
}

export function renderLoggedSets(logKey, cardId) {
    const loggedSetsContainer = document.getElementById(`logged-sets-${cardId}`);
    if (!loggedSetsContainer) return;
    loggedSetsContainer.innerHTML = '';
    const logData = state.currentWorkoutLog[logKey];
    if (!logData || !logData.sets) return;

    logData.sets.forEach((set, setIndex) => {
        const setItem = createSetItem(logKey, set, setIndex);
        loggedSetsContainer.appendChild(setItem);
    });
    if(window.feather) window.feather.replace();
}

export function appendNewSetToDOM(cardId, logKey, setIndex) {
    const loggedSetsContainer = document.getElementById(`logged-sets-${cardId}`);
    if (!loggedSetsContainer) return;
    const set = state.currentWorkoutLog[logKey].sets[setIndex];
    const setItem = createSetItem(logKey, set, setIndex);
    setItem.classList.add('animated');
    loggedSetsContainer.appendChild(setItem);
    if(window.feather) window.feather.replace();
}

function createSetItem(logKey, set, setIndex) {
    const isBodyweight = state.currentWorkoutLog[logKey]?.isBodyweight || false;
    let setDetailsText = '';
    if (isBodyweight) {
        setDetailsText = `Set ${setIndex + 1}: ${set.reps} reps ${set.weight !== 0 ? `(${set.weight > 0 ? '+' : ''}${set.weight}kg)` : ''} @RPE ${set.rpe}`;
    } else {
        setDetailsText = `Set ${setIndex + 1}: ${set.weight}kg x ${set.reps} reps @RPE ${set.rpe}`;
    }

    return createElement('div', {
        classes: ['list-item', 'history-set-item'],
        children: [
            createElement('span', { textContent: setDetailsText }),
            createElement('div', {
                classes: ['set-item-details'],
                children: [
                    createElement('span', { classes: ['estimated-1rm'], textContent: `1RM ≈ ${set.e1rm.toFixed(1)} kg` }),
                    createElement('button', {
                        classes: ['btn-delete'],
                        datasets: { action: 'delete-set', logKey, setIndex },
                        innerHTML: '<i data-feather="trash-2"></i>'
                    })
                ]
            })
        ]
    });
}

export function displayRpeFeedback(cardId, message) {
    const feedbackContainer = document.getElementById(`feedback-${cardId}`);
    if (feedbackContainer) {
        feedbackContainer.innerHTML = ''; // Clear old message
        feedbackContainer.appendChild(createElement('p', { classes: ['feedback-message'], textContent: message }));
        setTimeout(() => { feedbackContainer.innerHTML = ''; }, 8000);
    }
}

export function addQuickNote(cardId, noteText) {
    const notesInput = document.getElementById(`notes-${cardId}`);
    if (notesInput) {
        notesInput.value = notesInput.value ? `${notesInput.value}, ${noteText}` : noteText;
        notesInput.focus();
    }
}
