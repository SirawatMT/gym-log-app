// js/dom.js
// แคช DOM elements ที่ใช้บ่อย เพื่อประสิทธิภาพที่ดีขึ้น และลดการ query ซ้ำซ้อน

export const DOM = {
    body: document.body,
    container: document.querySelector('.container'),
    pages: document.querySelectorAll('.page'),
    tabButtons: document.querySelector('.tab-buttons'),
    workoutPage: document.getElementById('workout'),
    quickLogBtnTop: document.getElementById('quick-log-btn-top'),
    quickLogPopup: document.getElementById('quick-log-popup'),
    
    coachCornerBtn: document.getElementById('coach-corner-btn'),
    coachCornerModal: document.getElementById('coach-corner-modal'),
    
    // ADDED: แคชองค์ประกอบของ Program Selection Mode
    programSelectionView: document.getElementById('program-selection-view'),

    quickLogForm: document.getElementById('quick-log-form'),
    quickLogCardioForm: document.getElementById('quick-log-cardio-form'),

    finishWorkoutBtn: document.getElementById('finish-workout-btn'),
    analysisTabs: document.getElementById('analysis-tabs'),
    modals: document.querySelectorAll('.modal'),
    restoreFileInput: document.getElementById('restore-file-input'),
    exerciseSelect: document.getElementById('exercise-select'),
    historySearch: document.getElementById('history-search'),
    bodyStatSelect: document.getElementById('body-stat-select'),
    restTimer: document.getElementById('rest-timer'),
    
    appModal: document.getElementById('app-modal'),
    appModalTitle: document.getElementById('app-modal-title'),
    appModalMessage: document.getElementById('app-modal-message'),
    appModalInputContainer: document.getElementById('app-modal-input-container'),
    appModalButtons: document.getElementById('app-modal-buttons'),

    planEditorView: document.getElementById('plan-editor-view'),

    historyContainer: document.getElementById('history-container'),
    calendarView: document.getElementById('calendar-view'),

    exerciseAnalysisContent: document.getElementById('exercise-analysis-content'),
    compareExerciseSelect: document.getElementById('compare-exercise-select'),

    equipmentBarbellWeight: document.getElementById('equipment-barbell-weight'),
    equipmentPlates: document.getElementById('equipment-plates'),
};
