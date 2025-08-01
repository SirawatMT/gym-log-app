// js/handlers.js
// รวมฟังก์ชันสำหรับจัดการ Event ทั้งหมด (Event Handlers)

import { DOM } from './dom.js';
import * as logic from './logic.js';
import * as planLogic from './plan-logic.js';
import * as chartLogics from './charts.js';
import { closeModal } from './modal.js';
import { state } from './state.js';
import * as backup from './backup.js';
import { saveData } from './storage.js';

// --- REFACTORED: Import from new UI modules ---
import * as uiCore from './ui-core.js';
import * as uiWorkout from './ui-workout.js';
import * as uiHistory from './ui-history.js';
import * as uiPlans from './ui-plans.js';
import * as uiShared from './ui-shared.js';

// --- ฟังก์ชันสำหรับจัดการการตั้งค่าตัวจับเวลา ---
function updateTimerSettingsToggles() {
    const totalDurationToggle = document.getElementById('toggle-total-duration');
    const restTimerToggle = document.getElementById('toggle-rest-timer');

    if (totalDurationToggle) {
        totalDurationToggle.checked = state.settings.useTotalDurationTimer;
    }
    if (restTimerToggle) {
        restTimerToggle.checked = state.settings.useRestTimer;
    }
}

function handleTimerSettingToggle(event) {
    const toggleId = event.target.id;
    const isChecked = event.target.checked;

    if (toggleId === 'toggle-total-duration') {
        state.settings.useTotalDurationTimer = isChecked;
        if (!isChecked) {
            logic.stopWorkoutTimer();
        }
    } else if (toggleId === 'toggle-rest-timer') {
        state.settings.useRestTimer = isChecked;
    }

    saveData('gymAppSettings', state.settings);
}

function handleAnalysisPageClicks(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;

    if (action === 'delete-body-stat') {
        const dateToDelete = button.dataset.date;
        if (dateToDelete) {
            logic.deleteBodyStatEntry(dateToDelete).then(success => {
                if (success) {
                    uiShared.renderBodyStatsPage();
                    chartLogics.renderBodyStatChart(DOM.bodyStatSelect.value);
                }
            });
        }
    }
}

function handleThemeToggle() {
    uiCore.toggleTheme();
    chartLogics.updateChartDefaults();
    
    const analysisPage = document.getElementById('analysis');
    if (analysisPage.classList.contains('active')) {
        const activeAnalysisTab = document.querySelector('.analysis-tab-btn.active');
        if (activeAnalysisTab) {
            handleAnalysisTabNavigation({ target: activeAnalysisTab });
        }
    }
}


export function setupEventListeners() {
    DOM.tabButtons.addEventListener('click', handleTabNavigation);
    DOM.analysisTabs.addEventListener('click', handleAnalysisTabNavigation);
    DOM.workoutPage.addEventListener('click', handleWorkoutPageClicks);
    DOM.quickLogBtnTop.addEventListener('click', uiWorkout.toggleQuickLogMenu);
    DOM.finishWorkoutBtn.addEventListener('click', uiShared.showWorkoutSummary);
    DOM.quickLogPopup.addEventListener('click', handleQuickLogPopup);
    
    DOM.coachCornerBtn.addEventListener('click', uiWorkout.showCoachCornerModal);
    DOM.coachCornerModal.addEventListener('click', handleCoachCornerClicks);

    document.getElementById('override-btn').addEventListener('click', handleOverrideClick);
    DOM.exerciseSelect.addEventListener('change', (e) => chartLogics.generateExerciseCharts(e.target.value));
    document.getElementById('generate-comparison-chart-btn').addEventListener('click', chartLogics.generateComparisonChart);
    
    // --- BUG FIX: ย้ายความรับผิดชอบในการวาดหน้าจอมาไว้ที่นี่ ---
    document.getElementById('save-body-stats-btn').addEventListener('click', () => {
        if (logic.saveBodyStats()) {
            uiShared.renderBodyStatsPage();
            chartLogics.renderBodyStatChart(DOM.bodyStatSelect.value);
        }
    });

    DOM.bodyStatSelect.addEventListener('change', (e) => chartLogics.renderBodyStatChart(e.target.value));
    
    document.getElementById('toggle-theme-btn').addEventListener('click', handleThemeToggle);
    
    document.getElementById('save-equipment-btn').addEventListener('click', logic.saveEquipmentSettings);
    
    document.getElementById('backup-data-btn').addEventListener('click', backup.backupDataToFile);
    document.getElementById('restore-data-btn').addEventListener('click', () => DOM.restoreFileInput.click());
    DOM.restoreFileInput.addEventListener('change', backup.handleRestoreFile);
    
    DOM.historySearch.addEventListener('keyup', uiHistory.filterHistory);
    DOM.historyContainer.addEventListener('click', handleHistoryPageClicks);
    DOM.calendarView.addEventListener('click', handleCalendarClicks);
    DOM.planEditorView.addEventListener('click', handlePlanPageClicks);
    document.addEventListener('click', handleGenericClicks);
    DOM.restTimer.addEventListener('click', handleRestTimerClicks);

    const settingsPage = document.getElementById('settings');
    if (settingsPage) {
        settingsPage.addEventListener('click', handleSettingsPageClicks);
    }

    const totalDurationToggle = document.getElementById('toggle-total-duration');
    const restTimerToggle = document.getElementById('toggle-rest-timer');
    if (totalDurationToggle) {
        totalDurationToggle.addEventListener('change', handleTimerSettingToggle);
    }
    if (restTimerToggle) {
        restTimerToggle.addEventListener('change', handleTimerSettingToggle);
    }
    
    const analysisPage = document.getElementById('analysis');
    if (analysisPage) {
        analysisPage.addEventListener('click', handleAnalysisPageClicks);
    }
}

function handleTabNavigation(e) {
    const button = e.target.closest('.tab-button');
    if (!button) return;
    
    const pageName = button.dataset.page;
    uiCore.showPage(pageName);

    if (pageName === 'plans') uiPlans.renderPlanListView();
    if (pageName === 'prs') uiShared.renderPRsPage();
    
    if (pageName === 'analysis') {
        const overviewTabButton = DOM.analysisTabs.querySelector('[data-tab="overview"]');
        handleAnalysisTabNavigation({ target: overviewTabButton });
    }

    if (pageName === 'settings') {
        uiShared.updateEquipmentInputs();
        uiShared.renderAutoBackupList();
        updateTimerSettingsToggles();
    }
    if (pageName === 'history') {
        state.currentCalendarDate = new Date();
        uiHistory.loadHistory();
    }
    if (window.feather) window.feather.replace();
}


function handleAnalysisTabNavigation(e) {
    const button = e.target.closest('.analysis-tab-btn');
    if (!button) return;

    const tabName = button.dataset.tab;
    
    uiCore.showAnalysisTab(tabName);

    switch(tabName) {
        case 'overview':
            chartLogics.generateOverviewCharts();
            break;
        case 'per_exercise':
            uiShared.populateAllExerciseSelects();
            chartLogics.generateExerciseCharts(DOM.exerciseSelect.value);
            break;
        case 'comparison':
            uiShared.populateAllExerciseSelects();
            break;
        case 'body':
            uiShared.renderBodyStatsPage();
            chartLogics.renderBodyStatChart(DOM.bodyStatSelect.value);
            break;
        case 'cardio':
            chartLogics.generateCardioCharts();
            break;
    }
}

function handleWorkoutPageClicks(e) {
    const target = e.target;
    
    const button = target.closest('button[data-action], button[data-override-day-index]');
    const action = button?.dataset.action;

    if (button?.dataset.overrideDayIndex) {
        logic.overrideWorkout(parseInt(button.dataset.overrideDayIndex));
        return;
    }

    if (action) {
        switch (action) {
            case 'cancel-override':
                uiWorkout.exitProgramSelectionMode();
                uiWorkout.setupTodayWorkout();
                return;
            case 'rest-day-cardio': uiWorkout.toggleQuickLogPanel('quick-log-cardio-form'); return;
            case 'rest-day-weight': uiWorkout.toggleQuickLogPanel('quick-log-form'); return;
            case 'go-to-history': handleTabNavigation({ target: document.querySelector('.tab-button[data-page="history"]') }); return;
            case 'go-to-analysis': handleTabNavigation({ target: document.querySelector('.tab-button[data-page="analysis"]') }); return;
        }
    }

    const cancelBtn = target.closest('.quick-log-cancel[data-panel-id]');
    if (cancelBtn) {
        uiWorkout.toggleQuickLogPanel(cancelBtn.dataset.panelId);
        return;
    }
    if (target.id === 'save-quick-log-btn') {
        logic.saveQuickLog();
        return;
    }
    if (target.id === 'save-quick-log-cardio-btn') {
        logic.saveCardioLog();
        return;
    }
    if (target.id === 'toggle-completed-visibility') {
        uiWorkout.toggleCompletedVisibility();
        return;
    }

    const card = target.closest('.exercise-card');
    if (!card) return;
    const uniqueId = card.id;

    const logKey = card.dataset.logKey || card.dataset.exerciseName;
    const exerciseName = card.dataset.exerciseName;

    if (target.matches('input[type="checkbox"]')) {
        uiWorkout.toggleComplete(uniqueId, target.checked);
        return;
    }
    const adjustBtn = target.closest('.util-btn[data-adjust]');
    if (adjustBtn) {
        logic.adjustWeight(uniqueId, parseFloat(adjustBtn.dataset.adjust));
        return;
    }
    
    const adjustRepsBtn = target.closest('.util-btn[data-adjust-reps]');
    if (adjustRepsBtn) {
        logic.adjustReps(uniqueId, parseInt(adjustRepsBtn.dataset.adjustReps));
        return;
    }

    if (target.closest('.util-btn[data-action="plate-calculator"]')) {
        uiShared.openPlateCalculator(uniqueId);
        return;
    }
    if (target.closest('.split-button-main')) {
        logic.logSetAndStartTimer(uniqueId, logKey, exerciseName);
        return;
    }
    if (target.closest('.split-button-repeat')) {
        logic.logRepeatSet(uniqueId, logKey, exerciseName);
        return;
    }
    const quickNoteBtn = target.closest('.quick-note-btn');
    if (quickNoteBtn) {
        uiWorkout.addQuickNote(uniqueId, quickNoteBtn.dataset.note);
        return;
    }
    const deleteSetBtn = target.closest('.btn-delete[data-action="delete-set"]');
    if (deleteSetBtn) {
        const { logKey, setIndex } = deleteSetBtn.dataset;
        logic.deleteSet(logKey, uniqueId, parseInt(setIndex));
        return;
    }
}

function handleCoachCornerClicks(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const dayIndex = parseInt(button.dataset.dayIndex);

    switch (action) {
        case 'play-skipped':
            logic.overrideWorkout(dayIndex);
            break;
        case 'play-today':
            uiWorkout.renderWorkoutForDay(dayIndex); 
            closeModal('coach-corner-modal');
            break;
    }
}

function handleHistoryPageClicks(e) {
    const target = e.target;
    const button = target.closest('[data-action]');
    const title = target.closest('.history-exercise-title[data-exercise-name]');

    if (title) {
        uiHistory.viewAnalysisFor(title.dataset.exerciseName);
        return;
    }

    if (!button) return;

    const action = button.dataset.action;
    const { historyIndex, exIndex, setIndex, index } = button.dataset;

    switch (action) {
        case 'delete-entry':
            logic.deleteHistoryEntry(parseInt(index));
            break;
        case 'toggle-sets':
            uiHistory.toggleSetDetails(button);
            break;
        case 'delete-exercise':
            logic.deleteExerciseFromHistory(parseInt(historyIndex), parseInt(exIndex));
            break;
        case 'delete-set':
            logic.deleteSetFromHistory(parseInt(historyIndex), parseInt(exIndex), parseInt(setIndex));
            break;
    }
}

function handlePlanPageClicks(e) {
    const button = e.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const { planIndex, dayIndex, exIndex } = button.dataset;

    if (action === 'add-exercise') {
        planLogic.addExercise(parseInt(planIndex), parseInt(dayIndex));
        return;
    }

    switch (action) {
        case 'create-plan': planLogic.createNewPlan(); break;
        case 'edit-day': uiPlans.renderDayEditorView(parseInt(planIndex), parseInt(dayIndex)); break;
        case 'set-active-plan': planLogic.setActivePlan(parseInt(planIndex)); break;
        case 'rename-plan': planLogic.renamePlan(parseInt(planIndex)); break;
        case 'delete-plan': planLogic.deletePlan(parseInt(planIndex)); break;
        case 'back-to-plans': uiPlans.renderPlanListView(); break;
        case 'move-exercise-up': planLogic.moveExercise(parseInt(planIndex), parseInt(dayIndex), parseInt(exIndex), -1); break;
        case 'move-exercise-down': planLogic.moveExercise(parseInt(planIndex), parseInt(dayIndex), parseInt(exIndex), 1); break;
        case 'delete-exercise': planLogic.deleteExercise(parseInt(planIndex), parseInt(dayIndex), parseInt(exIndex)); break;
    }
}

function handleCalendarClicks(e){
    const target = e.target;
    const day = target.closest('.calendar-day[data-date]');
    if (day) {
        uiHistory.scrollToHistoryEntry(day.dataset.date);
        return;
    }
    const nav = target.closest('.calendar-nav[data-direction]');
    if (nav) {
        uiHistory.changeMonth(parseInt(nav.dataset.direction));
        return;
    }
}

function handleGenericClicks(e) {
    const target = e.target;

    if (!DOM.quickLogPopup.classList.contains('hidden') && !DOM.quickLogPopup.contains(target) && !DOM.quickLogBtnTop.contains(target)) {
        uiWorkout.hideQuickLogMenu();
    }

    let modalIdToClose = null;
    if (target.classList.contains('modal')) {
        modalIdToClose = target.id;
    }
    const closeBtn = target.closest('.close-button[data-modal]');
    if (closeBtn) {
        modalIdToClose = closeBtn.dataset.modal;
    }
    const actionCloseBtn = target.closest('[data-modal-close]');
    if (actionCloseBtn) {
        modalIdToClose = actionCloseBtn.dataset.modalClose;
    }
    if (modalIdToClose) {
        closeModal(modalIdToClose);
        if (modalIdToClose === 'summary-modal') {
            uiWorkout.setupTodayWorkout();
        }
    }

    const prItem = target.closest('.pr-item');
    if (prItem) {
        prItem.classList.toggle('open');
    }
}

function handleSettingsPageClicks(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const timestamp = button.dataset.timestamp;

    switch (action) {
        case 'restore-auto-backup':
            backup.restoreFromAutoBackup(timestamp);
            break;
        case 'delete-auto-backup':
            backup.deleteAutoBackup(timestamp);
            break;
    }
}

function handleQuickLogPopup(e) {
    const item = e.target.closest('.popup-menu-item');
    if (item) {
        const action = item.dataset.action;
        if (action === 'openQuickLogForm') uiWorkout.toggleQuickLogPanel('quick-log-form');
        if (action === 'openCardioLogForm') uiWorkout.toggleQuickLogPanel('quick-log-cardio-form');
    }
}

function handleOverrideClick() {
    if (state.isWorkoutOverridden) {
        logic.revertToOriginalWorkout();
    } else {
        uiWorkout.enterProgramSelectionMode();
    }
}

function handleRestTimerClicks(e) {
    if (e.target.dataset.timerAdjust) logic.adjustTimer(parseInt(e.target.dataset.timerAdjust));
    if (e.target.id === 'stop-timer-btn') logic.stopTimer();
}
