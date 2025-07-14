// Wrap the entire application in a DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', () => {

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js').then(registration => {
                console.log('ServiceWorker registration successful');
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    // --- App State and Constants ---
    const DEFAULT_REST_TIME = 90;
    let workoutStartTime = null,
        workoutTimerInterval = null;
    let currentWorkoutLog = {},
        personalRecords = {},
        bodyStats = [],
        nextSessionSuggestions = {};
    let currentSessionPRs = [];
    let timerInterval, timeRemaining, audioContext;
    let chartVolume, chartStrength, bodyStatChart, muscleBalanceChart, weeklyVolumeChart, fatigueAnalysisChart, comparisonChart;
    let cardioDistanceChart, cardioPaceChart, cardioWeeklySummaryChart;
    let workoutPlans = [],
        activePlanIndex = 0;
    let userEquipment = {
        barbellWeight: 20,
        availablePlates: [20, 15, 10, 5, 2.5, 1.25]
    };
    const defaultPlan = [{
        name: "โปรแกรมเริ่มต้น 4 วัน/สัปดาห์",
        active: true,
        days: [{
            name: "Upper A (จันทร์)",
            exercises: [{
                name: "Incline Dumbbell Press",
                muscleGroup: "Chest"
            }, {
                name: "One-arm Dumbbell Row",
                muscleGroup: "Back"
            }, {
                name: "Dumbbell Lateral Raise",
                muscleGroup: "Shoulders"
            }, {
                name: "Dumbbell Curl",
                muscleGroup: "Arms"
            }, {
                name: "Overhead Triceps Extension",
                muscleGroup: "Arms"
            }]
        }, {
            name: "Lower A (อังคาร)",
            exercises: [{
                name: "Goblet Squat",
                muscleGroup: "Legs"
            }, {
                name: "Dumbbell Romanian Deadlift (RDL)",
                muscleGroup: "Legs"
            }, {
                name: "Hip Thrust",
                muscleGroup: "Legs"
            }, {
                name: "Calf Raise",
                muscleGroup: "Legs"
            }]
        }, {
            name: "พัก (พุธ)",
            exercises: []
        }, {
            name: "Upper B (พฤหัสฯ)",
            exercises: [{
                name: "Flat Dumbbell Press",
                muscleGroup: "Chest"
            }, {
                name: "Pull-up / Band Pull-down",
                muscleGroup: "Back"
            }, {
                name: "Dumbbell Shoulder Press",
                muscleGroup: "Shoulders"
            }, {
                name: "Dumbbell Hammer Curl",
                muscleGroup: "Arms"
            }, {
                name: "Bench Dips",
                muscleGroup: "Arms"
            }]
        }, {
            name: "Lower B (ศุกร์)",
            exercises: [{
                name: "Bulgarian Split Squat",
                muscleGroup: "Legs"
            }, {
                name: "Sumo Goblet Squat",
                muscleGroup: "Legs"
            }, {
                name: "Dumbbell Step-up",
                muscleGroup: "Legs"
            }, {
                name: "Standing Calf Raise",
                muscleGroup: "Legs"
            }]
        }, {
            name: "พัก (เสาร์)",
            exercises: []
        }, {
            name: "พัก (อาทิตย์)",
            exercises: []
        }]
    }];
    const muscleGroups = {
        'Chest': 'อก',
        'Back': 'หลัง',
        'Legs': 'ขา',
        'Shoulders': 'ไหล่',
        'Arms': 'แขน',
        'Core': 'แกนกลางลำตัว',
        'Other': 'อื่นๆ',
        'Cardio': 'คาร์ดิโอ'
    };
    const muscleGroupColors = {
        'Chest': '#f44336',
        'Back': '#2196F3',
        'Legs': '#4CAF50',
        'Shoulders': '#FFC107',
        'Arms': '#9C27B0',
        'Core': '#FF9800',
        'Other': '#9E9E9E',
        'Cardio': '#03dac6'
    };
    let currentCalendarDate = new Date();

    // --- DOM Element Cache ---
    // Caching frequently accessed elements to avoid repeated DOM queries.
    const DOM = {
        body: document.body,
        container: document.querySelector('.container'),
        pages: document.querySelectorAll('.page'),
        tabButtons: document.querySelector('.tab-buttons'),
        workoutPage: document.getElementById('workout'),
        quickLogBtnTop: document.getElementById('quick-log-btn-top'),
        quickLogPopup: document.getElementById('quick-log-popup'),
        quickLogForm: document.getElementById('quick-log-form'),
        finishWorkoutBtn: document.getElementById('finish-workout-btn'),
        analysisTabs: document.getElementById('analysis-tabs'),
        modals: document.querySelectorAll('.modal'),
        restoreFileInput: document.getElementById('restore-file-input'),
        exerciseSelect: document.getElementById('exercise-select'),
        historySearch: document.getElementById('history-search'),
        bodyStatSelect: document.getElementById('body-stat-select'),
        restTimer: document.getElementById('rest-timer'),
    };

    // --- Utility Functions ---
    function vibrate(duration = 50) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(duration);
            } catch (e) {
                console.warn("Could not vibrate:", e);
            }
        }
    }

    function getMuscleGroup(exerciseName) {
        const lowerExName = exerciseName.toLowerCase();
        if (lowerExName.includes('run') || lowerExName.includes('walk') || lowerExName.includes('cycle') || lowerExName.includes('cardio')) return 'Cardio';
        const keywordMap = {
            'press': 'Chest',
            'push-up': 'Chest',
            'fly': 'Chest',
            'dips': 'Chest',
            'row': 'Back',
            'pull-up': 'Back',
            'pull-down': 'Back',
            'deadlift': 'Back',
            'squat': 'Legs',
            'lunge': 'Legs',
            'step-up': 'Legs',
            'thrust': 'Legs',
            'calf raise': 'Legs',
            'shoulder press': 'Shoulders',
            'lateral raise': 'Shoulders',
            'front raise': 'Shoulders',
            'curl': 'Arms',
            'triceps extension': 'Arms',
            'hammer curl': 'Arms',
            'crunch': 'Core',
            'plank': 'Core',
            'leg raise': 'Core'
        };
        for (const keyword in keywordMap) {
            if (lowerExName.includes(keyword)) return keywordMap[keyword];
        }
        return 'Other';
    }

    // --- Main App Initialization ---
    function initialize() {
        try {
            audioContext = new(window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API not supported");
        }
        runDataMigrations();
        loadAllData();
        renderPlanListView();
        setupTodayWorkout();
        applyTheme();
        updateChartDefaults();
        populateMuscleGroupSelects();
        feather.replace();
        setupEventListeners();
    }


    // --- Event Handling ---
    function setupEventListeners() {
        // Main Tab Navigation
        DOM.tabButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.tab-button');
            if (button) {
                showPage(button.dataset.page);
            }
        });
        
        // Analysis Sub-Tab Navigation
        DOM.analysisTabs.addEventListener('click', (e) => {
            const button = e.target.closest('.analysis-tab-btn');
            if(button) {
                showAnalysisTab(button.dataset.tab, true);
            }
        });

        // "Today" Page Actions
        DOM.quickLogBtnTop.addEventListener('click', toggleQuickLogMenu);
        DOM.finishWorkoutBtn.addEventListener('click', showWorkoutSummary);
        DOM.quickLogPopup.addEventListener('click', (e) => {
            const item = e.target.closest('.popup-menu-item');
            if (item) {
                const action = item.dataset.action;
                if (action === 'openQuickLogForm') openQuickLogForm();
                if (action === 'openCardioLogForm') openCardioLogForm();
            }
        });
        
        DOM.quickLogForm.querySelector('.quick-log-cancel').addEventListener('click', hideQuickLogForm);
        document.getElementById('save-quick-log-btn').addEventListener('click', saveQuickLog);
        document.getElementById('override-btn').addEventListener('click', () => {
             // This button's function changes, so we check its class
            if(document.getElementById('override-btn').classList.contains('danger-style')){
                revertToOriginalWorkout();
            } else {
                showOverrideModal();
            }
        });

        // Delegated listener for dynamic content on the workout page
        document.getElementById('exercise-list').addEventListener('click', handleWorkoutPageClicks);

        // Analysis Page
        DOM.exerciseSelect.addEventListener('change', (e) => generateExerciseCharts(e.target.value));
        document.getElementById('generate-comparison-chart-btn').addEventListener('click', generateComparisonChart);
        document.getElementById('save-body-stats-btn').addEventListener('click', saveBodyStats);
        DOM.bodyStatSelect.addEventListener('change', (e) => renderBodyStatChart(e.target.value));

        // Settings Page
        document.getElementById('toggle-theme-btn').addEventListener('click', toggleTheme);
        document.getElementById('save-equipment-btn').addEventListener('click', saveEquipmentSettings);
        document.getElementById('backup-data-btn').addEventListener('click', backupDataToFile);
        document.getElementById('restore-data-btn').addEventListener('click', () => DOM.restoreFileInput.click());
        DOM.restoreFileInput.addEventListener('change', handleRestoreFile);

        // History Page
        DOM.historySearch.addEventListener('keyup', filterHistory);
        document.getElementById('history-container').addEventListener('click', handleHistoryPageClicks);
        document.getElementById('calendar-view').addEventListener('click', handleCalendarClicks);

        // Plans Page
        document.getElementById('plan-editor-view').addEventListener('click', handlePlanPageClicks);

        // Modals
        document.addEventListener('click', handleModalClicks);
        
        // Cardio Log Modal
        document.getElementById('save-cardio-log-btn').addEventListener('click', saveCardioLog);

        // Rest Timer
        DOM.restTimer.addEventListener('click', (e) => {
            if (e.target.dataset.timerAdjust) adjustTimer(parseInt(e.target.dataset.timerAdjust));
            if (e.target.id === 'stop-timer-btn') stopTimer();
        });

        // Global click listener to hide popups
        document.addEventListener('click', (e) => {
            if (!DOM.quickLogPopup.classList.contains('hidden') && !DOM.quickLogPopup.contains(e.target) && !DOM.quickLogBtnTop.contains(e.target)) {
                hideQuickLogMenu();
            }
        });
    }

    function handleWorkoutPageClicks(e) {
        const target = e.target;
        const card = target.closest('.exercise-card');
        if (!card) return;
        const uniqueId = card.id;

        // Checkbox to mark complete
        if (target.matches('input[type="checkbox"]')) {
            toggleComplete(uniqueId);
            return;
        }

        // Adjust weight buttons
        const adjustBtn = target.closest('.util-btn[data-adjust]');
        if (adjustBtn) {
            adjustWeight(uniqueId, parseFloat(adjustBtn.dataset.adjust));
            return;
        }

        // Plate calculator
        if (target.closest('.util-btn[data-action="plate-calculator"]')) {
            openPlateCalculator(uniqueId);
            return;
        }
        
        // Log set & start timer
        if(target.closest('.split-button-main')) {
            const exerciseName = card.dataset.exerciseName;
            logSetAndStartTimer(uniqueId, exerciseName);
            return;
        }
        
        // Repeat set
        if(target.closest('.split-button-repeat')) {
            const exerciseName = card.dataset.exerciseName;
            logRepeatSet(uniqueId, exerciseName);
            return;
        }

        // Quick note tags
        const quickNoteBtn = target.closest('.quick-note-btn');
        if (quickNoteBtn) {
            addQuickNote(uniqueId, quickNoteBtn.dataset.note);
            return;
        }

        // Delete set button
        const deleteSetBtn = target.closest('.btn-delete[data-action="delete-set"]');
        if (deleteSetBtn) {
            const { exerciseName, setIndex } = deleteSetBtn.dataset;
            deleteSet(exerciseName, uniqueId, parseInt(setIndex));
            return;
        }
        
        // Rest day card quick log
        const restDayLogBtn = target.closest('.action-btn[data-action="rest-day-log"]');
        if (restDayLogBtn) {
            toggleQuickLogMenu();
        }
    }

    function handleHistoryPageClicks(e) {
        const target = e.target;
        
        // Delete entire entry
        const deleteEntryBtn = target.closest('.btn-delete[data-action="delete-entry"]');
        if (deleteEntryBtn) {
            deleteHistoryEntry(parseInt(deleteEntryBtn.dataset.index));
            return;
        }

        // View analysis for exercise
        const viewAnalysisBtn = target.closest('.history-exercise-title[data-exercise-name]');
        if (viewAnalysisBtn) {
            viewAnalysisFor(viewAnalysisBtn.dataset.exerciseName);
            return;
        }

        // Toggle set details
        const toggleDetailsBtn = target.closest('.btn-delete[data-action="toggle-sets"]');
        if (toggleDetailsBtn) {
            toggleSetDetails(parseInt(toggleDetailsBtn.dataset.historyIndex), parseInt(toggleDetailsBtn.dataset.exIndex));
            return;
        }

        // Delete entire exercise from entry
        const deleteExBtn = target.closest('.action-btn[data-action="delete-exercise"]');
        if(deleteExBtn) {
            deleteExerciseFromHistory(parseInt(deleteExBtn.dataset.historyIndex), parseInt(deleteExBtn.dataset.exIndex));
            return;
        }

        // Delete a single set from history
        const deleteSetBtn = target.closest('.btn-delete[data-action="delete-set"]');
        if (deleteSetBtn) {
            deleteSetFromHistory(parseInt(deleteSetBtn.dataset.historyIndex), parseInt(deleteSetBtn.dataset.exIndex), parseInt(deleteSetBtn.dataset.setIndex));
            return;
        }
    }
    
    function handlePlanPageClicks(e) {
        const target = e.target;
        const action = target.dataset.action;
        if (!action) return;

        const planIndex = parseInt(target.dataset.planIndex);
        const dayIndex = parseInt(target.dataset.dayIndex);
        const exIndex = parseInt(target.dataset.exIndex);

        switch (action) {
            case 'create-plan':
                createNewPlan();
                break;
            case 'edit-day':
                renderDayEditorView(planIndex, dayIndex);
                break;
            case 'set-active-plan':
                setActivePlan(planIndex);
                break;
            case 'rename-plan':
                renamePlan(planIndex);
                break;
            case 'delete-plan':
                deletePlan(planIndex);
                break;
            case 'back-to-plans':
                renderPlanListView();
                break;
            case 'add-exercise':
                addExercise(planIndex, dayIndex);
                break;
            case 'move-exercise-up':
                moveExercise(planIndex, dayIndex, exIndex, -1);
                break;
            case 'move-exercise-down':
                moveExercise(planIndex, dayIndex, exIndex, 1);
                break;
            case 'delete-exercise':
                deleteExercise(planIndex, dayIndex, exIndex);
                break;
        }
    }

    function handleCalendarClicks(e){
        const target = e.target;
        const day = target.closest('.calendar-day[data-date]');
        if (day) {
            scrollToHistoryEntry(day.dataset.date);
            return;
        }
        const nav = target.closest('.calendar-nav[data-direction]');
        if (nav) {
            changeMonth(parseInt(nav.dataset.direction));
            return;
        }
    }
    
    function handleModalClicks(e) {
        const target = e.target;
        // Close modal via backdrop click
        if (target.classList.contains('modal')) {
            target.classList.add('hidden');
        }
        // Close modal via close button
        const closeBtn = target.closest('.close-button[data-modal]');
        if (closeBtn) {
            closeModal(closeBtn.dataset.modal);
        }
        const actionCloseBtn = target.closest('[data-modal-close]');
        if (actionCloseBtn) {
             closeModal(actionCloseBtn.dataset.modalClose);
        }

        // PR list item toggle
        const prItem = target.closest('.pr-item');
        if (prItem) {
            prItem.classList.toggle('open');
        }
        
        // Override workout button
        const overrideBtn = target.closest('button[data-override-day-index]');
        if(overrideBtn){
            overrideWorkout(parseInt(overrideBtn.dataset.overrideDayIndex));
        }
    }


    // --- Core Application Logic (Functions from original script.js) ---
    // NOTE: All functions from the original script are pasted here, with modifications
    // to use classList for visibility toggles instead of inline styles.

    function applyTheme() {
        const theme = localStorage.getItem("gymLogTheme") || "dark";
        DOM.body.className = theme === "dark" ? "" : "light-mode";
    }

    function toggleTheme() {
        const newTheme = DOM.body.classList.contains("light-mode") ? "dark" : "light";
        DOM.body.className = newTheme === "dark" ? "" : "light-mode";
        localStorage.setItem("gymLogTheme", newTheme);
        updateChartDefaults();
        const activeAnalysisTab = document.querySelector('.analysis-tab-btn.active');
        if (activeAnalysisTab) {
            showAnalysisTab(activeAnalysisTab.dataset.tab, true);
        }
    }

    function loadAllData() {
        personalRecords = JSON.parse(localStorage.getItem('gymLogPRs_v4') || '{}');
        nextSessionSuggestions = JSON.parse(localStorage.getItem('gymLogSuggestions') || '{}');
        const storedPlans = localStorage.getItem('gymWorkoutPlans_v3');
        workoutPlans = storedPlans && JSON.parse(storedPlans).length > 0 ? JSON.parse(storedPlans) : defaultPlan;
        const storedEquipment = localStorage.getItem('gymUserEquipment');
        if (storedEquipment) userEquipment = JSON.parse(storedEquipment);
        bodyStats = JSON.parse(localStorage.getItem('gymBodyStats') || '[]');
        activePlanIndex = workoutPlans.findIndex(p => p.active);
        if (activePlanIndex === -1) {
            activePlanIndex = 0;
            if (workoutPlans.length > 0) workoutPlans[0].active = true;
        }
        loadHistory();
        populateAllExerciseSelects();
        renderBodyStatsPage();
        renderAnalysisPage();
        renderPRsPage();
        updateEquipmentInputs();
    }

    function saveData() {
        localStorage.setItem('gymWorkoutPlans_v3', JSON.stringify(workoutPlans));
    }

    function saveSuggestions() {
        localStorage.setItem('gymLogSuggestions', JSON.stringify(nextSessionSuggestions));
    }

    function backupDataToFile() {
        const backupObj = {
            version: 4,
            history: JSON.parse(localStorage.getItem('gymLogHistory_v2') || '[]'),
            prs: JSON.parse(localStorage.getItem('gymLogPRs_v4') || '{}'),
            plans: JSON.parse(localStorage.getItem('gymWorkoutPlans_v3') || JSON.stringify(defaultPlan)),
            body: JSON.parse(localStorage.getItem('gymBodyStats') || '[]'),
            equipment: JSON.parse(localStorage.getItem('gymUserEquipment') || JSON.stringify(userEquipment)),
            suggestions: JSON.parse(localStorage.getItem('gymLogSuggestions') || '{}')
        };
        const jsonString = JSON.stringify(backupObj, null, 2);
        const blob = new Blob([jsonString], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `gym-log-backup-${today}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('กำลังดาวน์โหลดไฟล์สำรองข้อมูล...');
    }

    function handleRestoreFile(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const backupString = e.target.result;
            restoreData(backupString);
        };
        reader.onerror = function() {
            alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function restoreData(backupString) {
        if (!backupString) {
            alert('ไม่มีข้อมูลสำหรับนำเข้า');
            return;
        }
        if (!confirm("คุณแน่ใจหรือไม่ที่จะนำเข้าข้อมูล? ข้อมูลปัจจุบันทั้งหมดจะถูกเขียนทับ!")) return;
        try {
            const backupObj = JSON.parse(backupString);
            let restoredSomething = false;
            if (backupObj.history) {
                localStorage.setItem('gymLogHistory_v2', JSON.stringify(backupObj.history));
                restoredSomething = true;
            }
            if (backupObj.prs) {
                localStorage.setItem('gymLogPRs_v4', JSON.stringify(backupObj.prs));
                restoredSomething = true;
            }
            if (backupObj.plans) {
                localStorage.setItem('gymWorkoutPlans_v3', JSON.stringify(backupObj.plans));
                restoredSomething = true;
            }
            if (backupObj.body) {
                localStorage.setItem('gymBodyStats', JSON.stringify(backupObj.body));
                restoredSomething = true;
            }
            if (backupObj.equipment) {
                localStorage.setItem('gymUserEquipment', JSON.stringify(backupObj.equipment));
                restoredSomething = true;
            }
            if (backupObj.suggestions) {
                localStorage.setItem('gymLogSuggestions', JSON.stringify(backupObj.suggestions));
                restoredSomething = true;
            }
            if (restoredSomething) {
                runDataMigrations();
                loadAllData();
                renderPlanListView();
                setupTodayWorkout();
                alert('นำเข้าข้อมูลสำเร็จ!');
                showPage('settings');
            } else {
                alert('รูปแบบไฟล์สำรองไม่ถูกต้อง');
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล! ไฟล์อาจเสียหายหรือไม่ถูกต้อง');
            console.error("Restore error: ", e);
        }
    }

    function runDataMigrations() {
        const v4PrMigration = localStorage.getItem('gymPrMigrationComplete_v4');
        if (!v4PrMigration) {
            console.log("Migrating PR data to v4 structure...");
            const history = JSON.parse(localStorage.getItem('gymLogHistory_v2') || '[]')
            const newPRs = {};
            history.forEach(entry => {
                entry.exercises.forEach(ex => {
                    ex.sets.forEach(set => {
                        const {
                            name
                        } = ex;
                        const {
                            weight,
                            reps
                        } = set;
                        if (!newPRs[name]) {
                            newPRs[name] = {
                                maxWeight: 0,
                                repPRs: {}
                            };
                        }
                        if (weight > newPRs[name].maxWeight) {
                            newPRs[name].maxWeight = weight;
                        }
                        if (!newPRs[name].repPRs[weight] || reps > newPRs[name].repPRs[weight]) {
                            newPRs[name].repPRs[weight] = reps;
                        }
                    });
                });
            });
            localStorage.setItem('gymLogPRs_v4', JSON.stringify(newPRs));
            localStorage.setItem('gymPrMigrationComplete_v4', 'true');
            if (localStorage.getItem('gymLogPRs')) localStorage.removeItem('gymLogPRs');
            console.log("PR data migration to v4 complete.");
        }
    }

    function renderPlanListView() {
        const view = document.getElementById("plan-editor-view");
        view.innerHTML = `<h2>จัดการตารางฝึก</h2><div id="plan-list"></div><button class="action-btn secondary" data-action="create-plan"><i data-feather="plus-circle"></i>สร้างโปรแกรมใหม่</button>`;
        const planListDiv = document.getElementById("plan-list");
        workoutPlans.forEach((plan, planIndex) => {
            const card = document.createElement("div");
            card.className = "card";
            let daysHTML = plan.days.map((day, dayIndex) => `<div class="list-item"><span><strong>${day.name}</strong> (${day.exercises.length} ท่า)</span><div class="btn-group"><button data-action="edit-day" data-plan-index="${planIndex}" data-day-index="${dayIndex}"><i data-feather="edit-2"></i></button></div></div>`).join("");
            card.innerHTML = `<h3>${plan.name} ${plan.active ? "(ใช้งานอยู่)" : ""}</h3>${daysHTML}<div class="btn-group" style="margin-top: 15px; display:flex; gap: 10px;">${plan.active ? "" : `<button class="action-btn success" data-action="set-active-plan" data-plan-index="${planIndex}">เลือกใช้</button>`}<button class="action-btn neutral" data-action="rename-plan" data-plan-index="${planIndex}">เปลี่ยนชื่อ</button><button class="btn-delete" data-action="delete-plan" data-plan-index="${planIndex}"><i data-feather="trash-2"></i></button></div>`;
            planListDiv.appendChild(card);
        });
        feather.replace();
    }

    function renderDayEditorView(planIndex, dayIndex) {
        const view = document.getElementById("plan-editor-view");
        const day = workoutPlans[planIndex].days[dayIndex];
        let exercisesHTML = day.exercises.map((ex, exIndex) => `<div class="list-item"><span>${ex.name} <em style="font-size:0.8em; opacity:0.7;">(${muscleGroups[ex.muscleGroup] || 'N/A'})</em></span><div class="btn-group"><button data-action="move-exercise-up" data-plan-index="${planIndex}" data-day-index="${dayIndex}" data-ex-index="${exIndex}" ${exIndex === 0 ? "disabled" : ""}><i data-feather="arrow-up"></i></button><button data-action="move-exercise-down" data-plan-index="${planIndex}" data-day-index="${dayIndex}" data-ex-index="${exIndex}" ${exIndex === day.exercises.length - 1 ? "disabled" : ""}><i data-feather="arrow-down"></i></button><button class="btn-delete" data-action="delete-exercise" data-plan-index="${planIndex}" data-day-index="${dayIndex}" data-ex-index="${exIndex}"><i data-feather="trash-2"></i></button></div></div>`).join("");
        let muscleGroupOptions = '';
        for (const key in muscleGroups) {
            muscleGroupOptions += `<option value="${key}">${muscleGroups[key]}</option>`;
        }
        view.innerHTML = `<h2><span class="back-button" data-action="back-to-plans"><i data-feather="arrow-left"></i> กลับ</span><span>${day.name}</span></h2><div class="card">${day.exercises.length > 0 ? exercisesHTML : '<p style="text-align:center; opacity:0.7;">ยังไม่มีท่าออกกำลังกายสำหรับวันนี้</p>'}<div class="add-exercise-form" style="margin-top: 20px; flex-wrap: wrap;"><input type="text" id="new-exercise-name" placeholder="ชื่อท่าใหม่..." style="flex-grow:2; min-width: 150px;"><select id="new-exercise-muscle-group" style="flex-grow:1; min-width: 120px;">${muscleGroupOptions}</select><button class="action-btn primary" data-action="add-exercise" data-plan-index="${planIndex}" data-day-index="${dayIndex}" style="flex-grow:1;">เพิ่มท่า</button></div></div>`;
        feather.replace();
    }

    function addExercise(planIndex, dayIndex) {
        const nameInput = document.getElementById("new-exercise-name");
        const groupSelect = document.getElementById("new-exercise-muscle-group");
        const newExName = nameInput.value.trim();
        const newExGroup = groupSelect.value;
        if (newExName) {
            workoutPlans[planIndex].days[dayIndex].exercises.push({
                name: newExName,
                muscleGroup: newExGroup
            });
            saveData();
            renderDayEditorView(planIndex, dayIndex);
        }
    }

    function createNewPlan() {
        const name = prompt("ตั้งชื่อโปรแกรมใหม่:", "โปรแกรมของฉัน");
        if (name) {
            workoutPlans.push({
                name: name,
                active: false,
                days: [{
                    name: "วันจันทร์",
                    exercises: []
                }, {
                    name: "วันอังคาร",
                    exercises: []
                }, {
                    name: "วันพุธ",
                    exercises: []
                }, {
                    name: "วันพฤหัสบดี",
                    exercises: []
                }, {
                    name: "วันศุกร์",
                    exercises: []
                }, {
                    name: "วันเสาร์",
                    exercises: []
                }, {
                    name: "วันอาทิตย์",
                    exercises: []
                }]
            });
            saveData();
            renderPlanListView();
        }
    }

    function renamePlan(planIndex) {
        const newName = prompt("เปลี่ยนชื่อโปรแกรม:", workoutPlans[planIndex].name);
        if (newName) {
            workoutPlans[planIndex].name = newName;
            saveData();
            renderPlanListView();
        }
    }

    function deletePlan(planIndex) {
        if (workoutPlans.length > 1) {
            if (confirm(`คุณแน่ใจหรือไม่ที่จะลบโปรแกรม "${workoutPlans[planIndex].name}"?`)) {
                workoutPlans.splice(planIndex, 1);
                if (workoutPlans.findIndex(p => p.active) === -1) {
                    workoutPlans[0].active = true;
                    activePlanIndex = 0;
                }
                saveData();
                renderPlanListView();
                setupTodayWorkout();
            }
        } else {
            alert("ไม่สามารถลบได้ ต้องมีอย่างน้อย 1 โปรแกรม");
        }
    }

    function setActivePlan(planIndex) {
        workoutPlans.forEach((p, i) => p.active = i === planIndex);
        activePlanIndex = planIndex;
        saveData();
        renderPlanListView();
        setupTodayWorkout();
    }

    function deleteExercise(planIndex, dayIndex, exIndex) {
        const exName = workoutPlans[planIndex].days[dayIndex].exercises[exIndex].name;
        if (confirm(`คุณแน่ใจหรือไม่ที่จะลบท่า "${exName}" ออกจากโปรแกรม?`)) {
            workoutPlans[planIndex].days[dayIndex].exercises.splice(exIndex, 1);
            saveData();
            renderDayEditorView(planIndex, dayIndex);
        }
    }

    function moveExercise(planIndex, dayIndex, exIndex, direction) {
        const exercises = workoutPlans[planIndex].days[dayIndex].exercises;
        const newIndex = exIndex + direction;
        if (newIndex < 0 || newIndex >= exercises.length) return;
        [exercises[exIndex], exercises[newIndex]] = [exercises[newIndex], exercises[exIndex]];
        saveData();
        renderDayEditorView(planIndex, dayIndex);
    }

    function setupTodayWorkout(forceDayIndex = -1) {
        const overrideBtn = document.getElementById('override-btn');
        if (forceDayIndex === -1) {
            overrideBtn.classList.remove('hidden', 'danger-style');
            overrideBtn.innerHTML = '<i data-feather="calendar"></i>';
            feather.replace();
        }
        DOM.finishWorkoutBtn.classList.add('hidden');
        DOM.quickLogBtnTop.classList.remove('hidden');
        DOM.quickLogForm.classList.add('hidden');
        try {
            currentSessionPRs = [];
            const today = new Date();
            const smartAssistantBox = document.getElementById('smart-assistant-box');
            smartAssistantBox.innerHTML = '';
            const dayOfWeek = today.getDay();
            let dayIndex = (forceDayIndex > -1) ? forceDayIndex : (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
            if (forceDayIndex === -1) {
                if (checkForDeloadSuggestion()) {
                    renderDeloadSuggestion();
                }
                const inactivityInfo = checkForInactivity();
                if (inactivityInfo.inactive) {
                    renderInactiveSuggestion(inactivityInfo.days);
                } else {
                    const skippedDayInfo = checkForSkippedWorkouts();
                    if (skippedDayInfo && skippedDayInfo.skipped) {
                        renderSkippedDaySuggestion(skippedDayInfo.lastDayName, skippedDayInfo.skippedDayName, skippedDayInfo.skippedDayIndex);
                        return;
                    }
                }
            }
            renderWorkoutForDay(dayIndex);
        } catch (error) {
            console.error("Error in setupTodayWorkout:", error);
            const exerciseList = document.getElementById('exercise-list');
            exerciseList.innerHTML = '<p style="color:red;">เกิดข้อผิดพลาดในการโหลดโปรแกรมวันนี้ กรุณาลองรีเฟรชหน้าจอ</p>';
        }
    }

    function overrideWorkout(dayIndex) {
        closeModal('override-modal');
        document.getElementById('smart-assistant-box').innerHTML = '';
        renderWorkoutForDay(dayIndex, true);
        const overrideBtn = document.getElementById('override-btn');
        overrideBtn.innerHTML = '<i data-feather="x-circle"></i>';
        overrideBtn.classList.add('danger-style');
        feather.replace();
    }

    function revertToOriginalWorkout() {
        const hasLoggedData = Object.values(currentWorkoutLog).some(ex => ex.sets.length > 0);
        if (hasLoggedData) {
            if (confirm("การกลับไปโปรแกรมเดิมจะลบข้อมูลที่บันทึกไว้ในโปรแกรมปัจจุบัน คุณแน่ใจหรือไม่?")) {
                setupTodayWorkout();
            }
        } else {
            setupTodayWorkout();
        }
    }

    function renderRestDayCard() {
        const exerciseList = document.getElementById('exercise-list');
        exerciseList.innerHTML = '';
        DOM.quickLogBtnTop.classList.add('hidden');
        document.getElementById('override-btn').classList.add('hidden');

        exerciseList.innerHTML = `
        <div class="rest-day-card" id="rest-day-card">
            <h2><i data-feather="coffee"></i> วันพักผ่อน</h2>
            <p>พักผ่อนให้เต็มที่ หรือถ้าอยากจะขยับร่างกายเบาๆ ก็ทำได้เลย</p>
            <div class="rest-day-actions">
                 <button class="action-btn neutral" data-action="rest-day-log">
                    <i data-feather="zap"></i> บันทึกกิจกรรม
                 </button>
            </div>
        </div>`;
        feather.replace();
    }

    function renderWorkoutForDay(dayIndex, isOverride = false) {
        if (!isOverride) {
            workoutStartTime = null;
            clearInterval(workoutTimerInterval);
            const durationDisplay = document.getElementById("total-duration-display");
            if (durationDisplay) durationDisplay.textContent = "";
            currentWorkoutLog = {};
        }
        const currentPlan = workoutPlans[activePlanIndex];
        if (!currentPlan || !currentPlan.days || !currentPlan.days[dayIndex]) {
            document.getElementById('workout-day-title').textContent = "ไม่พบโปรแกรม";
            document.getElementById('exercise-list').innerHTML = '<p>กรุณาไปที่หน้า "ตารางฝึก" เพื่อสร้างหรือเลือกใช้โปรแกรม</p>';
            return;
        }
        const day = currentPlan.days[dayIndex];
        const exerciseList = document.getElementById('exercise-list');
        if (!isOverride) {
            document.getElementById('workout-day-title').textContent = day.name;
            exerciseList.innerHTML = '';
        } else {
            document.getElementById('workout-day-title').textContent = `${day.name} (Override)`;
        }
        if (day.exercises.length === 0 && !isOverride) {
            renderRestDayCard();
            return;
        }
        day.exercises.forEach((ex) => {
            const exName = ex.name;
            if (currentWorkoutLog[exName]) return;
            currentWorkoutLog[exName] = {
                sets: [],
                notes: '',
                muscleGroup: ex.muscleGroup
            };
            let suggestion = getProgressionSuggestion(exName);
            let coachSuggestionNote = '';
            if (nextSessionSuggestions[exName]) {
                suggestion = {
                    suggestedWeight: nextSessionSuggestions[exName]
                };
                coachSuggestionNote = `<span class="coach-suggestion-text">โค้ชแนะนำให้เริ่มที่ ${nextSessionSuggestions[exName]}kg!</span>`;
                delete nextSessionSuggestions[exName];
                saveSuggestions();
            }
            const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
            let lastSessionData = "ครั้งล่าสุด: -";
            const lastEntry = history.find(entry => entry.exercises.some(e => e.name === exName));
            if (lastEntry) {
                const lastEx = lastEntry.exercises.find(e => e.name === exName);
                if (lastEx && lastEx.sets.length > 0) {
                    const topSet = lastEx.sets.reduce((a, b) => (a.weight > b.weight ? a : b));
                    lastSessionData = `ครั้งล่าสุด: ${topSet.weight}kg x ${topSet.reps} reps`;
                }
            }
            const uniqueId = `card-${exName.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;
            const card = document.createElement('div');
            card.className = 'card exercise-card';
            card.id = uniqueId;
            card.dataset.exerciseName = exName;
            const quickNotes = ['รู้สึกดี', 'ฟอร์มดี', 'หนักไป', 'เบาไป', 'ปวดข้อ', 'เพิ่มน้ำหนักครั้งหน้า'];
            const quickNotesHTML = `
            <div class="quick-note-tags">
                ${quickNotes.map(note => `
                    <button class="quick-note-btn" data-note="${note}">
                        + ${note}
                    </button>
                `).join('')}
            </div>`;
            card.innerHTML = `
            <div class="ex-header">
                <div class="ex-title-container">
                    <div class="pr-star" id="pr-star-${uniqueId}"><i data-feather="star" class="feather" style="fill: var(--pr-color);"></i></div>
                    <div class="exercise-title">${exName}</div>
                 </div>
                <div class="btn-group">
                    <input type="checkbox">
                </div>
            </div>
               <div class="exercise-notes">${lastSessionData}</div>
            ${coachSuggestionNote}
            <div id="logged-sets-${uniqueId}" class="mb-15"></div>
            <div class="feedback-container" id="feedback-${uniqueId}"></div>
            <div class="log-input align-items-center mb-10">
                 <button class="util-btn" data-adjust="-1.25"><i data-feather="minus"></i></button>
                <input type="tel" pattern="[0-9.]*" placeholder="น้ำหนัก" id="weight-${uniqueId}" value="${suggestion ? suggestion.suggestedWeight : ""}" class="w-60 text-center">
                <button class="util-btn" data-adjust="1.25"><i data-feather="plus"></i></button>
                <button class="util-btn" data-action="plate-calculator" title="คำนวณแผ่นน้ำหนัก">⚖️</button>
                <input type="tel" pattern="[0-9]*" placeholder="ครั้ง" id="reps-${uniqueId}" class="w-60 text-center">
                <select id="rpe-${uniqueId}" class="w-70">
                    <option value="">RPE</option>
                    ${[10,9,8,7,6,5,4,3,2,1].map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
             </div>
            <div class="split-button-container">
                 <button class="split-button-main">
                    <i data-feather="plus-circle"></i>
                     <span>บันทึกเซ็ต & เริ่มพัก</span>
                </button>
                <button class="split-button-repeat" title="ทำซ้ำเซ็ตล่าสุด">
                    <i data-feather="repeat"></i>
                </button>
             </div>
            <textarea class="notes-input" id="notes-${uniqueId}" placeholder="จดบันทึกเกี่ยวกับท่านี้..."></textarea>
            ${quickNotesHTML}`;
            exerciseList.appendChild(card);
            if (personalRecords[exName] && personalRecords[exName].maxWeight > 0) {
                document.getElementById(`pr-star-${uniqueId}`).style.display = "inline";
            }
        });
        feather.replace();
    }

    function showOverrideModal() {
        const listContainer = document.getElementById('override-list');
        listContainer.innerHTML = '';
        const currentPlan = workoutPlans[activePlanIndex];
        currentPlan.days.forEach((day, index) => {
            const btn = document.createElement('button');
            btn.className = 'action-btn secondary';
            btn.textContent = day.name;
            btn.dataset.overrideDayIndex = index;
            listContainer.appendChild(btn);
        });
        document.getElementById('override-modal').classList.remove('hidden');
    }

    function checkForSkippedWorkouts() {
        const history = JSON.parse(localStorage.getItem('gymLogHistory_v2') || '[]');
        if (history.length === 0) return {
            skipped: false
        };
        const lastEntry = history[0];
        const lastDate = new Date(lastEntry.isoDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 1 && diffDays < 7) {
            const lastDayOfWeek = lastDate.getDay();
            const lastDayIndex = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
            for (let i = 1; i < diffDays; i++) {
                const skippedDayIndex = (lastDayIndex + i) % 7;
                const skippedDay = workoutPlans[activePlanIndex].days[skippedDayIndex];
                if (skippedDay && skippedDay.exercises.length > 0) {
                    return {
                        skipped: true,
                        skippedDayIndex: skippedDayIndex,
                        skippedDayName: skippedDay.name,
                        lastDayName: workoutPlans[activePlanIndex].days[lastDayIndex].name
                    };
                }
            }
        }
        return {
            skipped: false
        };
    }

    function renderSkippedDaySuggestion(lastDayName, skippedDayName, skippedDayIndex) {
        const todayDayIndex = (new Date().getDay() === 0) ? 6 : new Date().getDay() - 1;
        const todayDayName = workoutPlans[activePlanIndex].days[todayDayIndex].name;
        const box = document.getElementById('smart-assistant-box');
        box.innerHTML = `<div class="suggestion-card danger"><h3><i data-feather="alert-triangle"></i> โค้ชสายโหด</h3><p>คุณโดดการฝึก '${skippedDayName}' มานะ! อย่าหาข้ออ้าง ลุกไปเล่นเซสชันที่ข้ามไป หรือจะเล่นโปรแกรมของวันนี้ก็ได้</p><button class="action-btn primary" onclick="document.getElementById('smart-assistant-box').innerHTML = ''; renderWorkoutForDay(${skippedDayIndex});">เล่นเซสชันที่ข้ามไป</button><button class="action-btn secondary" onclick="document.getElementById('smart-assistant-box').innerHTML = ''; renderWorkoutForDay(${todayDayIndex});">ทำโปรแกรมวันนี้ (${todayDayName})</button></div>`;
        document.getElementById('exercise-list').innerHTML = '';
        feather.replace();
    }

    function checkForInactivity() {
        const history = JSON.parse(localStorage.getItem('gymLogHistory_v2') || '[]');
        if (history.length === 0) return {
            inactive: false
        };
        const lastEntry = history[0];
        const lastDate = new Date(lastEntry.isoDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) {
            return {
                inactive: true,
                days: diffDays
            };
        }
        return {
            inactive: false
        };
    }

    function renderInactiveSuggestion(days) {
        const box = document.getElementById('smart-assistant-box');
        box.innerHTML = `<div class="suggestion-card danger"><h3><i data-feather="alert-triangle"></i> โค้ชสายโหด</h3><p>นี่หายไปไหนมา ${days} วันแล้ว?! เหล็กที่บ้านคงคิดถึงคุณแล้วนะ ลุกไปซ้อมได้แล้ว!</p></div>`;
        feather.replace();
    }

    function checkForDeloadSuggestion() {
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        if (history.length < 12) return false;
        const mainLifts = new Set(workoutPlans[activePlanIndex].days.map(d => d.exercises[0]?.name).filter(Boolean));
        if (mainLifts.size === 0) return false;
        let stallCount = 0;
        mainLifts.forEach(lift => {
            const liftHistory = history.filter(h => h.exercises.some(ex => ex.name === lift)).slice(0, 3);
            if (liftHistory.length >= 3) {
                const vol1 = liftHistory[0].exercises.find(ex => ex.name === lift)?.volume || 0;
                const vol2 = liftHistory[1].exercises.find(ex => ex.name === lift)?.volume || 0;
                const vol3 = liftHistory[2].exercises.find(ex => ex.name === lift)?.volume || 0;
                if (vol1 <= vol2 && vol2 <= vol3 && vol1 > 0) {
                    stallCount++;
                }
            }
        });
        return stallCount >= (mainLifts.size / 2);
    }

    function renderDeloadSuggestion() {
        const box = document.getElementById('smart-assistant-box');
        box.innerHTML += `<div class="suggestion-card danger"><h3><i data-feather="alert-triangle"></i> โค้ชสายโหด</h3><p>Volume ตกมาต่อเนื่องแล้วนะ! ถ้าไม่ไหวก็พัก (Deload) หรือลองเปลี่ยนไปเล่นหนักขึ้นในจำนวนครั้งที่น้อยลงดู (เช่น 4-6 reps) เพื่อกระตุ้นร่างกาย</p></div>`;
        feather.replace();
    }

    function getProgressionSuggestion(exerciseName) {
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const lastEntry = history.find(entry => entry.exercises.some(ex => ex.name === exerciseName));
        if (lastEntry) {
            const lastEx = lastEntry.exercises.find(ex => ex.name === exerciseName);
            if (lastEx && lastEx.sets.length > 0) {
                const topSet = lastEx.sets.reduce((a, b) => (a.weight >= b.weight ? a : b));
                if (topSet.reps >= 12 && parseInt(topSet.rpe) <= 8) return {
                    suggestedWeight: topSet.weight + 2.5
                };
                if (topSet.reps < 8 && parseInt(topSet.rpe) > 8) return {
                    suggestedWeight: topSet.weight - 2.5
                };
                return {
                    suggestedWeight: topSet.weight
                };
            }
        }
        return null;
    }

    function toggleQuickLogMenu() {
        DOM.quickLogPopup.classList.toggle('hidden');
        if (!DOM.quickLogPopup.classList.contains('hidden')) {
            feather.replace();
        }
    }

    function hideQuickLogMenu() {
        DOM.quickLogPopup.classList.add('hidden');
    }

    function openQuickLogForm() {
        hideQuickLogMenu();
        DOM.quickLogForm.classList.remove('hidden');
    }

    function hideQuickLogForm() {
        DOM.quickLogForm.classList.add('hidden');
    }

    function openCardioLogForm() {
        hideQuickLogMenu();
        document.getElementById('cardio-log-modal').classList.remove('hidden');
    }

    function saveCardioLog() {
        const distanceInput = document.getElementById('cardio-distance');
        const durationInput = document.getElementById('cardio-duration');
        const notesInput = document.getElementById('cardio-notes');

        const distance = parseFloat(distanceInput.value);
        const duration = parseInt(durationInput.value);
        const notes = notesInput.value.trim();
        if (isNaN(distance) || isNaN(duration) || distance <= 0 || duration <= 0) {
            alert("กรุณากรอกระยะทางและเวลาให้เป็นตัวเลขที่ถูกต้อง");
            return;
        }

        const cardioData = {
            name: 'Cardio',
            type: 'cardio',
            distance: distance,
            duration: duration,
            notes: notes,
            muscleGroup: 'Cardio',
            sets: []
        };
        currentWorkoutLog['Cardio-' + Date.now()] = cardioData;
        saveWorkoutToHistory();
        renderCardioLogInPage(cardioData);

        distanceInput.value = '';
        durationInput.value = '';
        notesInput.value = '';
        closeModal('cardio-log-modal');
    }

    function renderCardioLogInPage(cardioData) {
        const exerciseList = document.getElementById('exercise-list');
        const card = document.createElement('div');
        card.className = 'card exercise-card cardio';
        card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--primary-color);">
                <i data-feather="trending-up"></i> 
                <span>${cardioData.name}: ${cardioData.distance} กม. ใน ${cardioData.duration} นาที</span>
            </div>
        </div>
        ${cardioData.notes ? `<p style="font-size: 0.9em; opacity: 0.8; margin-top: 10px; padding-left: 34px;">📝 ${cardioData.notes}</p>` : ''}`;
        exerciseList.insertBefore(card, exerciseList.firstChild);
        feather.replace();
    }

    function saveQuickLog() {
        const exerciseName = document.getElementById('quick-log-exercise').value.trim();
        const muscleGroup = document.getElementById('quick-log-muscle-group').value;
        const weightStr = document.getElementById('quick-log-weight').value;
        const repsStr = document.getElementById('quick-log-reps').value;
        if (!exerciseName || !weightStr || !repsStr) {
            alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
            return;
        }
        const weight = parseFloat(weightStr);
        const reps = parseInt(repsStr);
        if (isNaN(weight) || isNaN(reps)) {
            alert("กรุณากรอกน้ำหนักและจำนวนครั้งให้เป็นตัวเลข");
            return;
        }
        if (!currentWorkoutLog[exerciseName]) {
            currentWorkoutLog[exerciseName] = {
                sets: [],
                notes: '',
                muscleGroup: muscleGroup
            };
        }
        const estimated1RM = calculate1RM(weight, reps);
        const newSet = {
            weight: weight,
            reps: reps,
            rpe: "-",
            e1rm: estimated1RM
        };
        checkAndSavePR(exerciseName, weight, reps);
        currentWorkoutLog[exerciseName].sets.push(newSet);
        if (!workoutStartTime) {
            startWorkoutTimer();
        }
        saveWorkoutToHistory();
        renderFreestyleLog(exerciseName, newSet);
        document.getElementById('quick-log-exercise').value = '';
        document.getElementById('quick-log-weight').value = '';
        document.getElementById('quick-log-reps').value = '';
        hideQuickLogForm();
    }

    function showPage(pageName) {
        DOM.pages.forEach(p => p.classList.add('hidden'));
        document.querySelectorAll(".tab-button").forEach(el => el.classList.remove("active"));
        
        const pageToShow = document.getElementById(pageName);
        if (pageToShow) {
            pageToShow.classList.remove('hidden');
            pageToShow.classList.add('active'); // To keep original logic that might depend on .active
        }

        const buttonToActivate = document.querySelector(`.tab-button[data-page="${pageName}"]`);
        if (buttonToActivate) {
             buttonToActivate.classList.add("active");
        }

        // Page-specific render/load functions
        if (pageName === 'plans') {
            renderPlanListView();
        }
        if (pageName === 'prs') {
            renderPRsPage();
        }
        if (pageName === 'analysis') {
            showAnalysisTab('overview', true);
        }
        if (pageName === 'settings') {
            updateEquipmentInputs();
        }
        if (pageName === 'history') {
            currentCalendarDate = new Date();
            loadHistory();
            filterHistory();
        }
        feather.replace();
    }

    function toggleComplete(cardId) {
        document.getElementById(cardId).classList.toggle("completed")
    }

    function calculate1RM(weight, reps) {
        if (reps == 1) return weight;
        if (reps <= 0) return 0;
        return weight * (1 + (reps / 30));
    }

    function adjustWeight(cardId, amount) {
        const weightInput = document.getElementById(`weight-${cardId}`);
        let currentWeight = parseFloat(weightInput.value) || 0;
        let newWeight = currentWeight + amount;
        if (newWeight < 0) newWeight = 0;
        weightInput.value = newWeight.toFixed(2).replace(/\.00$/, '').replace(/\.([1-9])0$/, '.$1');;
    }

    function renderLoggedSets(exerciseName, cardId) {
        const loggedSetsContainer = document.getElementById(`logged-sets-${cardId}`);
        if (!loggedSetsContainer) return;
        loggedSetsContainer.innerHTML = '';
        if (!currentWorkoutLog[exerciseName] || !currentWorkoutLog[exerciseName].sets) return;
        currentWorkoutLog[exerciseName].sets.forEach((set, setIndex) => {
            const setItem = document.createElement("div");
            setItem.className = 'list-item history-set-item';
            setItem.innerHTML = `<span>Set ${setIndex + 1}: ${set.weight}kg x ${set.reps} reps @RPE ${set.rpe}</span><div class="set-item-details"><span class="estimated-1rm">1RM ≈ ${set.e1rm.toFixed(1)} kg</span><button class="btn-delete" data-action="delete-set" data-exercise-name="${exerciseName.replace(/"/g, '&quot;')}" data-set-index="${setIndex}"><i data-feather="trash-2"></i></button></div>`;
            loggedSetsContainer.appendChild(setItem);
        });
        feather.replace();
    }

    function appendNewSetToDOM(cardId, exerciseName, setIndex) {
        const loggedSetsContainer = document.getElementById(`logged-sets-${cardId}`);
        if (!loggedSetsContainer) return;
        const set = currentWorkoutLog[exerciseName].sets[setIndex];
        const setItem = document.createElement("div");
        setItem.className = 'list-item history-set-item animated';
        setItem.innerHTML = `<span>Set ${setIndex + 1}: ${set.weight}kg x ${set.reps} reps @RPE ${set.rpe}</span><div class="set-item-details"><span class="estimated-1rm">1RM ≈ ${set.e1rm.toFixed(1)} kg</span><button class="btn-delete" data-action="delete-set" data-exercise-name="${exerciseName.replace(/"/g, '&quot;')}" data-set-index="${setIndex}"><i data-feather="trash-2"></i></button></div>`;
        loggedSetsContainer.appendChild(setItem);
        feather.replace();
    }

    function deleteSet(exerciseName, cardId, setIndex) {
        if (confirm(`คุณแน่ใจหรือไม่ว่าจะลบ Set ${setIndex + 1} ของท่า ${exerciseName}?`)) {
            if (currentWorkoutLog[exerciseName]) {
                currentWorkoutLog[exerciseName].sets.splice(setIndex, 1);
                saveWorkoutToHistory();
                renderLoggedSets(exerciseName, cardId);
                recalculatePRs(exerciseName);
            }
        }
    }

    function displayRpeFeedback(cardId, message) {
        const feedbackContainer = document.getElementById(`feedback-${cardId}`);
        if (feedbackContainer) {
            feedbackContainer.innerHTML = `<p class="feedback-message">${message}</p>`;
            setTimeout(() => {
                feedbackContainer.innerHTML = '';
            }, 8000);
        }
    }

    function addQuickNote(cardId, noteText) {
        const notesInput = document.getElementById(`notes-${cardId}`);
        if (notesInput) {
            if (notesInput.value) {
                notesInput.value += ', ' + noteText;
            } else {
                notesInput.value = noteText;
            }
            notesInput.focus();
        }
    }

    function logRepeatSet(cardId, exerciseName) {
        if (!currentWorkoutLog[exerciseName] || currentWorkoutLog[exerciseName].sets.length === 0) {
            alert("ยังไม่มีเซ็ตล่าสุดให้ทำซ้ำ กรุณาบันทึกเซ็ตแรกก่อน");
            return;
        }

        if (!workoutStartTime) {
            startWorkoutTimer();
        }

        const lastSet = currentWorkoutLog[exerciseName].sets[currentWorkoutLog[exerciseName].sets.length - 1];
        const {
            weight,
            reps,
            rpe
        } = lastSet;

        const weightInput = document.getElementById(`weight-${cardId}`);
        const repsInput = document.getElementById(`reps-${cardId}`);
        const rpeInput = document.getElementById(`rpe-${cardId}`);
        weightInput.value = weight;
        repsInput.value = reps;
        rpeInput.value = rpe;

        logSet(cardId, exerciseName, weight, reps, rpe, true);
        startTimer();
    }

    function logSet(cardId, exerciseName, weight, reps, rpe, fromRepeat = false) {
        if (DOM.finishWorkoutBtn.classList.contains('hidden')) {
            DOM.finishWorkoutBtn.classList.remove('hidden');
            DOM.finishWorkoutBtn.style.animation = 'fadeIn 0.5s';
        }

        if (!fromRepeat) {
            const prData = personalRecords[exerciseName];
            if (prData && weight > prData.maxWeight * 1.20 && prData.maxWeight > 0) {
                if (!confirm(`ยืนยันสถิติใหม่!\n\nน้ำหนัก ${weight}kg ที่คุณกรอก สูงกว่าสถิติเดิม (${prData.maxWeight}kg) ของคุณมาก คุณแน่ใจหรือไม่ว่าข้อมูลนี้ถูกต้อง?`)) {
                    return false;
                }
            }
        }

        const prMessages = checkAndSavePR(exerciseName, weight, reps);
        if (prMessages) {
            displayRpeFeedback(cardId, prMessages);
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 90,
                    origin: {
                        y: 0.6
                    },
                    colors: ['#bb86fc', '#03dac6', '#FFD700']
                });
            }
            vibrate(100);
        }

        const estimated1RM = calculate1RM(weight, reps);
        const logData = {
            weight,
            reps,
            rpe: rpe || "-",
            e1rm: estimated1RM
        };
        if (!currentWorkoutLog[exerciseName]) {
            currentWorkoutLog[exerciseName] = {
                sets: [],
                notes: '',
                muscleGroup: 'Other'
            };
        }
        currentWorkoutLog[exerciseName].sets.push(logData);

        const newSetIndex = currentWorkoutLog[exerciseName].sets.length - 1;
        appendNewSetToDOM(cardId, exerciseName, newSetIndex);
        const repsInput = document.getElementById(`reps-${cardId}`);
        const rpeInput = document.getElementById(`rpe-${cardId}`);
        repsInput.value = "";
        rpeInput.value = "";
        repsInput.focus();

        saveWorkoutToHistory();
        return true;
    }

    function logSetAndStartTimer(cardId, exerciseName) {
        if (!workoutStartTime) {
            startWorkoutTimer();
        }

        const weightInput = document.getElementById(`weight-${cardId}`);
        const repsInput = document.getElementById(`reps-${cardId}`);
        const rpeInput = document.getElementById(`rpe-${cardId}`);
        const weight = parseFloat(weightInput.value) || 0;
        const reps = parseInt(repsInput.value);
        const rpe = rpeInput.value;
        if (!reps || isNaN(reps) || reps <= 0) {
            alert("กรุณาใส่จำนวนครั้งให้ถูกต้อง");
            repsInput.focus();
            return;
        }

        if (logSet(cardId, exerciseName, weight, reps, rpe)) {
            startTimer();
        }
    }

    function saveWorkoutToHistory() {
        let history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const today = new Date();
        const todayId = today.toISOString().slice(0, 10);
        let totalVolume = 0;
        const exercisesData = [];
        Object.keys(currentWorkoutLog).forEach((exKey) => {
            const exLog = currentWorkoutLog[exKey];
            if (exLog && ((exLog.sets && exLog.sets.length > 0) || exLog.type === 'cardio')) {
                const exCard = Array.from(document.querySelectorAll('.exercise-card')).find(card => card.querySelector('.exercise-title')?.textContent.startsWith(exLog.name || exKey));
                const notes = exCard ? exCard.querySelector('.notes-input')?.value : (exLog.notes || "");

                let exerciseVolume = 0;
                if (exLog.type !== 'cardio' && exLog.sets && exLog.sets.length > 0) {
                    exerciseVolume = exLog.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
                    totalVolume += exerciseVolume;
                }

                exercisesData.push({
                    name: exLog.name || exKey,
                    volume: exerciseVolume,
                    notes: notes,
                    sets: exLog.sets,
                    muscleGroup: exLog.muscleGroup,
                    type: exLog.type,
                    distance: exLog.distance,
                    duration: exLog.duration
                });
            }
        });
        if (exercisesData.length === 0) {
            const todayIndex = history.findIndex(entry => entry.id === todayId);
            if (todayIndex > -1) {
                history.splice(todayIndex, 1);
                localStorage.setItem("gymLogHistory_v2", JSON.stringify(history));
            }
            return;
        }
        let durationStr = "00:00:00";
        if (workoutStartTime) {
            const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
            const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
            const m = Math.floor(elapsed % 3600 / 60).toString().padStart(2, '0');
            const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
            durationStr = `${h}:${m}:${s}`;
        }
        const newEntry = {
            id: todayId,
            isoDate: today.toISOString(),
            dayName: document.getElementById('workout-day-title').textContent,
            totalVolume: totalVolume,
            duration: durationStr,
            exercises: exercisesData,
            prsAchieved: currentSessionPRs
        };
        const todayIndex = history.findIndex(entry => entry.id === todayId);
        if (todayIndex > -1) {
            history[todayIndex] = newEntry;
        } else {
            history.unshift(newEntry);
        }
        localStorage.setItem("gymLogHistory_v2", JSON.stringify(history));
    }


    function renderCalendar(year, month) {
        const calendarView = document.getElementById('calendar-view');
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");

        const historyByDate = history.reduce((acc, entry) => {
            const date = entry.isoDate.slice(0, 10);
            if (!acc[date]) {
                acc[date] = new Set();
            }
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
         <div class="calendar-grid">
            ${dayNames.map(day => `<div class="calendar-day-name">${day}</div>`).join('')}
    `;
        for (let i = 0; i < firstDay; i++) {
            calendarHTML += `<div class="calendar-day other-month"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const muscleGroupsOnDay = historyByDate[dateStr];
            let dotsHTML = '';
            let hasWorkoutClass = '';
            if (muscleGroupsOnDay) {
                hasWorkoutClass = 'has-workout';
                dotsHTML = `<div class="dots-container">${Array.from(muscleGroupsOnDay).map(mg => 
                `<div class="muscle-dot" style="background-color: ${muscleGroupColors[mg] || muscleGroupColors['Other']};"></div>`
            ).join('')}</div>`;
            }
            calendarHTML += `
            <div class="calendar-day ${hasWorkoutClass}" data-date="${dateStr}">
                <div class="day-number">${day}</div>
                ${dotsHTML}
            </div>`;
        }

        calendarHTML += '</div>';
        calendarView.innerHTML = calendarHTML;
        feather.replace();
    }

    function changeMonth(direction) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
        renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
    }

    function scrollToHistoryEntry(dateStr) {
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const entryIndex = history.findIndex(entry => entry.isoDate && entry.isoDate.startsWith(dateStr));
        if (entryIndex !== -1) {
            const cardId = `history-card-${entryIndex}`;
            const element = document.getElementById(cardId);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                element.style.transition = 'background-color 0.5s';
                element.style.backgroundColor = 'var(--border-color)';
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 1500);
            }
        }
    }


    function loadHistory() {
        const historyContainer = document.getElementById("history-container");
        historyContainer.innerHTML = "";
        renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        if (history.length === 0) {
            historyContainer.innerHTML = "<p>ยังไม่มีประวัติการฝึก</p>";
            return;
        }

        history.forEach((entry, index) => {
            const entryCard = document.createElement("div");
            entryCard.className = "card";
            entryCard.id = `history-card-${index}`;
            const date = new Date(entry.isoDate);
            const dateString = date.toLocaleDateString("th-TH", {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
            let exercisesHTML = entry.exercises.map((ex, exIndex) => {
                if (ex.type === 'cardio') {
                    return `<div id="history-ex-${index}-${exIndex}" style="padding: 10px 0;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--primary-color);">
                                    <i data-feather="trending-up"></i> 
                                    <span>${ex.name || 'Cardio'}: ${ex.distance} กม. ใน ${ex.duration} นาที</span>
                                </div>
                                <button class="btn-delete" data-action="delete-exercise" data-history-index="${index}" data-ex-index="${exIndex}"><i data-feather="trash-2"></i></button>
                             </div>
                            ${ex.notes ? `<p style="font-size: 0.9em; opacity: 0.8; margin-top: 5px; margin-left: 34px;">📝 ${ex.notes}</p>` : ''}
                       </div>`;
                }

                const safeExName = ex.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const maxWeightSet = ex.sets.reduce((max, set) => set.weight > max.weight ? set : max, {
                    weight: 0
                });
                const isWeightPR = (entry.prsAchieved || []).some(pr => pr.type === 'weight' && pr.exercise === ex.name && pr.weight === maxWeightSet.weight);

                return `<div id="history-ex-${index}-${exIndex}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                            <div class="history-exercise-title ${isWeightPR ? 'pr-highlight' : ''}" data-exercise-name="${safeExName}">▪️ ${ex.name} ${isWeightPR ? '⭐' : ''}</div>
                            <button class="btn-delete" data-action="toggle-sets" data-history-index="${index}" data-ex-index="${exIndex}"><i data-feather="menu"></i></button>
                        </div>
                         <div id="set-details-${index}-${exIndex}" class="hidden" style="margin-left: 15px; margin-top: 5px;">
                            ${ex.sets.map((set, setIndex) => {
                                const isRepPR = (entry.prsAchieved || []).some(pr => pr.type === 'reps' && pr.exercise === ex.name && pr.weight === set.weight && pr.reps === set.reps);
                                 return `<div class="history-set-item ${isRepPR ? 'pr-highlight' : ''}">
                                            <span>Set ${setIndex + 1}: ${set.weight}kg x ${set.reps} reps @${set.rpe} ${isRepPR ? '⭐' : ''}</span>
                                            <button class="btn-delete" data-action="delete-set" data-history-index="${index}" data-ex-index="${exIndex}" data-set-index="${setIndex}"><i data-feather="trash-2"></i></button>
                                         </div>`
                            }).join('')}
                            ${ex.notes ? `<p style="font-size: 0.9em; opacity: 0.8; margin-top: 5px;">📝 ${ex.notes}</p>` : ''}
                            <button class="action-btn danger" data-action="delete-exercise" data-history-index="${index}" data-ex-index="${exIndex}" style="width:100%; margin-top:10px; font-size: 0.9em; padding: 8px;"><i data-feather="trash"></i> ลบท่า ${ex.name} ทั้งหมด</button>
                        </div>
                    </div>`
            }).join('');
            entryCard.innerHTML = `<button class="btn-delete" data-action="delete-entry" data-index="${index}" style="position: absolute; top: 15px; right: 15px;"><i data-feather="x-circle" style="color:var(--danger-color);"></i></button><h4 style="color: var(--text-color); margin: 0 0 10px 0;">${dateString}</h4><div style="font-size: 0.9em; color: var(--text-secondary-color);">⏱️ ${entry.duration} &nbsp; 🔥 ${entry.totalVolume.toFixed(0)} kg</div><hr style="border-color: var(--border-color); opacity: 0.5; margin: 15px 0;">${exercisesHTML}`;
            historyContainer.appendChild(entryCard);
        });
        feather.replace();
    }

    function filterHistory() {
        const searchTerm = document.getElementById('history-search').value.toLowerCase();
        const historyContainer = document.getElementById('history-container');
        const entryCards = historyContainer.querySelectorAll('.card');
        entryCards.forEach(card => {
            const cardText = card.textContent.toLowerCase();
            if (cardText.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    function toggleSetDetails(historyIndex, exIndex) {
        const detailsDiv = document.getElementById(`set-details-${historyIndex}-${exIndex}`);
        detailsDiv.classList.toggle('hidden');
    }

    function deleteHistoryEntry(index) {
        if (confirm("คุณแน่ใจหรือไม่ที่จะลบรายการของทั้งวันนี้? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
            let history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
            if (index >= 0 && index < history.length) {
                const exercisesToRecalc = history[index].exercises.filter(ex => ex.type !== 'cardio');
                history.splice(index, 1);
                localStorage.setItem("gymLogHistory_v2", JSON.stringify(history));

                exercisesToRecalc.forEach(ex => recalculatePRs(ex.name));

                showPage('history');
                setupTodayWorkout();
                alert("ลบรายการสำเร็จ");
            }
        }
    }

    function deleteExerciseFromHistory(historyIndex, exerciseIndex) {
        let history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const entry = history[historyIndex];
        const exerciseToDelete = entry.exercises[exerciseIndex];
        if (confirm(`คุณแน่ใจหรือไม่ที่จะลบข้อมูลท่า "${exerciseToDelete.name || 'Cardio'}" ทั้งหมดออกจากประวัติวันนี้?`)) {
            const deletedVolume = exerciseToDelete.volume || 0;
            entry.exercises.splice(exerciseIndex, 1);
            entry.totalVolume -= deletedVolume;
            if (entry.exercises.length === 0) {
                history.splice(historyIndex, 1);
            } else {
                history[historyIndex] = entry;
            }
            localStorage.setItem("gymLogHistory_v2", JSON.stringify(history));
            if (exerciseToDelete.type !== 'cardio') {
                recalculatePRs(exerciseToDelete.name);
            }
            showPage('history');
            setupTodayWorkout();
        }
    }

    function deleteSetFromHistory(historyIndex, exerciseIndex, setIndex) {
        let history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const entry = history[historyIndex];
        const exercise = entry.exercises[exerciseIndex];
        const setToDelete = exercise.sets[setIndex];
        if (confirm(`คุณแน่ใจหรือไม่ที่จะลบ Set ${setIndex + 1} (${setToDelete.weight}kg x ${setToDelete.reps} reps) ออกจากท่า ${exercise.name}?`)) {
            const deletedSetVolume = setToDelete.weight * setToDelete.reps;
            exercise.volume -= deletedSetVolume;
            entry.totalVolume -= deletedSetVolume;
            exercise.sets.splice(setIndex, 1);
            if (exercise.sets.length === 0) {
                entry.exercises.splice(exerciseIndex, 1);
            }
            if (entry.exercises.length === 0) {
                history.splice(historyIndex, 1);
            } else {
                history[historyIndex] = entry;
            }
            localStorage.setItem("gymLogHistory_v2", JSON.stringify(history));
            recalculatePRs(exercise.name);
            loadAllData();
            showPage('history');
        }
    }

    function viewAnalysisFor(exerciseName) {
        showPage('analysis');
        showAnalysisTab('per_exercise');
        const select = document.getElementById('exercise-select');
        select.value = exerciseName;
        generateExerciseCharts(exerciseName);
    }

    function showWorkoutSummary() {
        saveWorkoutToHistory();
        vibrate(100);
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const todayId = new Date().toISOString().slice(0, 10);
        const todayEntry = history.find(entry => entry.id === todayId);
        if (!todayEntry) {
            alert("ไม่พบข้อมูลการฝึกของวันนี้ หรือยังไม่ได้บันทึกเซ็ตใดๆ");
            return;
        }
        const trophy = document.getElementById('summary-trophy');
        trophy.classList.remove('animate');
        void trophy.offsetWidth;
        trophy.classList.add('animate');
        document.getElementById('summary-volume').textContent = `${todayEntry.totalVolume.toFixed(0)} kg`;
        document.getElementById('summary-duration').textContent = todayEntry.duration;
        const totalSets = todayEntry.exercises.reduce((sum, ex) => sum + (ex.sets ? ex.sets.length : 0), 0);
        document.getElementById('summary-sets').textContent = totalSets;
        const prsContainer = document.getElementById('summary-prs-container');
        const prsList = document.getElementById('summary-prs-list');
        prsList.innerHTML = '';
        const newPRs = todayEntry.prsAchieved || [];
        if (newPRs.length > 0) {
            newPRs.forEach(pr => {
                const li = document.createElement('li');
                if (pr.type === 'weight') {
                    li.innerHTML = `<strong>${pr.exercise}</strong> - น้ำหนักสูงสุดใหม่ ${pr.weight} kg!`;
                } else {
                    li.innerHTML = `<strong>${pr.exercise}</strong> - สถิติใหม่ที่ ${pr.weight} kg (${pr.reps} ครั้ง)`;
                }
                prsList.appendChild(li);
            });
            prsContainer.classList.remove('hidden');
        } else {
            prsContainer.classList.add('hidden');
        }
        document.getElementById('summary-modal').classList.remove('hidden');
    }

    function renderPRsPage() {
        const container = document.getElementById('pr-list-container');
        container.innerHTML = '';
        if (Object.keys(personalRecords).length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 20px; opacity:0.7;">ยังไม่มีการบันทึกสถิติ<br/>เมื่อคุณทำลายสถิติใหม่ (PR) ข้อมูลจะมาแสดงที่นี่</p>';
            return;
        }
        const sortedPRs = Object.entries(personalRecords).sort((a, b) => a[0].localeCompare(b[0]));
        sortedPRs.forEach(([exerciseName, prData]) => {
            const prItem = document.createElement('div');
            prItem.className = 'pr-item';
            prItem.innerHTML = `<div class="pr-item-header"><span class="pr-exercise-name">${exerciseName}</span><span class="pr-weight">${prData.maxWeight} kg</span></div><div class="rep-pr-details"><table class="rep-pr-table"><thead><tr><th>น้ำหนัก (kg)</th><th>จำนวนครั้งสูงสุด</th></tr></thead><tbody>${Object.entries(prData.repPRs).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).map(([weight, reps]) => `<tr><td>${weight}</td><td>${reps}</td></tr>`).join('')}</tbody></table></div>`;
            container.appendChild(prItem);
        });
        feather.replace();
    }

    function renderFreestyleLog(exerciseName, setData) {
        const exerciseList = document.getElementById('exercise-list');
        const cardId = `card-freestyle-${exerciseName.replace(/[^a-zA-Z0-9]/g, "")}`;
        let card = document.getElementById(cardId);
        if (!card) {
            card = document.createElement('div');
            card.className = 'card exercise-card freestyle';
            card.id = cardId;
            card.innerHTML = `<div class="ex-header"><div class="ex-title-container"><div class="exercise-title">${exerciseName} (Freestyle)</div></div></div><div id="logged-sets-${cardId}" class="mb-15"></div>`;
            exerciseList.insertBefore(card, exerciseList.firstChild);
        }
        const loggedSetsContainer = document.getElementById(`logged-sets-${cardId}`);
        const setItem = document.createElement("div");
        setItem.className = 'list-item history-set-item';
        setItem.innerHTML = `<div class="set-item-details"><span>Set ${currentWorkoutLog[exerciseName].sets.length}: ${setData.weight}kg x ${setData.reps} reps</span><span class="estimated-1rm">1RM ≈ ${setData.e1rm.toFixed(1)} kg</span></div><button class="btn-delete" data-action="delete-set" data-exercise-name="${exerciseName.replace(/"/g, '&quot;')}" data-set-index="${currentWorkoutLog[exerciseName].sets.length - 1}"><i data-feather="trash-2"></i></button>`;
        loggedSetsContainer.appendChild(setItem);
        feather.replace();
    }

    function populateAllExerciseSelects() {
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const exerciseSet = new Set;
        history.forEach(entry => entry.exercises.forEach(ex => {
            if (ex.type !== 'cardio') {
                exerciseSet.add(ex.name)
            }
        }));
        const sortedExercises = Array.from(exerciseSet).sort();
        const selects = document.querySelectorAll("#exercise-select, #compare-exercise-select");
        selects.forEach(select => {
            let defaultOption = select.id === "compare-exercise-select" ? "" : '<option value="">-- เลือกท่า --</option>';
            select.innerHTML = defaultOption;
            sortedExercises.forEach(ex => {
                const option = document.createElement("option");
                option.value = ex;
                option.textContent = ex;
                select.appendChild(option);
            });
        });
    }

    function showAnalysisTab(tabName, forceRerender = false) {
        document.querySelectorAll(".analysis-sub-page, .analysis-tab-btn").forEach(el => el.classList.remove("active"));
        document.querySelectorAll(".analysis-sub-page").forEach(el => el.classList.add("hidden"));
        
        document.getElementById(`analysis-${tabName}`).classList.add("active");
        document.getElementById(`analysis-${tabName}`).classList.remove("hidden");
        document.querySelector(`.analysis-tab-btn[data-tab='${tabName}']`).classList.add("active");

        if (tabName === 'overview') {
            renderAnalysisPage();
        } else if (tabName === 'per_exercise') {
            generateExerciseCharts(document.getElementById('exercise-select').value);
        } else if (tabName === 'comparison') {
            if (comparisonChart) comparisonChart.destroy();
        } else if (tabName === 'body') {
            renderBodyStatsPage();
        } else if (tabName === 'cardio') {
            generateCardioCharts();
        }
    }

    function renderAnalysisPage() {
        populateAllExerciseSelects();
        generateMuscleBalanceChart();
        generateWeeklyVolumeChart();
        generateFatigueAnalysisChart();
        generateExerciseCharts(document.getElementById('exercise-select').value);
        if (comparisonChart) {
            comparisonChart.destroy();
        }
    }

    function generateCardioCharts() {
        if (cardioDistanceChart) cardioDistanceChart.destroy();
        if (cardioPaceChart) cardioPaceChart.destroy();
        if (cardioWeeklySummaryChart) cardioWeeklySummaryChart.destroy();

        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const cardioHistory = history
            .flatMap(entry => entry.exercises.filter(ex => ex.type === 'cardio').map(ex => ({ ...ex,
                date: new Date(entry.isoDate)
            })))
            .sort((a, b) => a.date - b.date);
        if (cardioHistory.length > 0) {
            const distanceData = {
                labels: cardioHistory.map(c => c.date.toLocaleDateString("th-TH", {
                    month: "short",
                    day: "numeric"
                })),
                datasets: [{
                    label: 'ระยะทาง (กม.)',
                    data: cardioHistory.map(c => c.distance),
                    borderColor: 'rgba(3, 218, 198, 1)',
                    backgroundColor: 'rgba(3, 218, 198, 0.5)',
                    yAxisID: 'yDistance',
                }, {
                    label: 'ระยะเวลา (นาที)',
                    data: cardioHistory.map(c => c.duration),
                    borderColor: 'rgba(187, 134, 252, 1)',
                    backgroundColor: 'rgba(187, 134, 252, 0.5)',
                    type: 'line',
                    yAxisID: 'yDuration',
                    fill: false
                }]
            };
            const ctxDistance = document.getElementById("cardioDistanceChart").getContext("2d");
            cardioDistanceChart = new Chart(ctxDistance, {
                type: 'bar',
                data: distanceData,
                options: {
                    scales: {
                        yDistance: {
                            position: 'left',
                            title: {
                                display: true,
                                text: 'กม.'
                            }
                        },
                        yDuration: {
                            position: 'right',
                            title: {
                                display: true,
                                text: 'นาที'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
            const paceData = {
                labels: cardioHistory.map(c => c.date.toLocaleDateString("th-TH", {
                    month: "short",
                    day: "numeric"
                })),
                datasets: [{
                    label: "Pace (นาที/กม.)",
                    data: cardioHistory.map(c => c.duration / c.distance),
                    borderColor: "rgba(255, 215, 0, 1)",
                    tension: .1,
                    fill: true,
                    backgroundColor: 'rgba(255, 215, 0, 0.2)'
                }]
            };
            const ctxPace = document.getElementById("cardioPaceChart").getContext("2d");
            cardioPaceChart = new Chart(ctxPace, {
                type: "line",
                data: paceData,
                options: {
                    scales: {
                        y: {
                            reverse: true,
                            title: {
                                display: true,
                                text: 'Pace (ยิ่งน้อยยิ่งดี)'
                            }
                        }
                    }
                }
            });
            const weeklyCardio = cardioHistory.reduce((acc, entry) => {
                const week = getWeekNumber(entry.date);
                if (!acc[week]) acc[week] = 0;
                acc[week] += entry.distance;
                return acc;
            }, {});
            const weeklyLabels = Object.keys(weeklyCardio).sort().slice(-12);
            const weeklyData = weeklyLabels.map(label => weeklyCardio[label]);
            const ctxWeekly = document.getElementById('cardioWeeklySummaryChart').getContext('2d');
            cardioWeeklySummaryChart = new Chart(ctxWeekly, {
                type: 'bar',
                data: {
                    labels: weeklyLabels,
                    datasets: [{
                        label: 'Total Distance (km)',
                        data: weeklyData,
                        backgroundColor: 'rgba(3, 218, 198, 0.5)',
                        borderColor: 'rgba(3, 218, 198, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'กม.'
                            }
                        }
                    }
                }
            });
        }
    }

    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return d.getUTCFullYear() + "-W" + weekNo.toString().padStart(2, '0');
    }

    function createChartGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        const colorVal = getComputedStyle(document.documentElement).getPropertyValue(color).trim();

        if (colorVal.startsWith('#')) {
            const r = parseInt(colorVal.slice(1, 3), 16);
            const g = parseInt(colorVal.slice(3, 5), 16);
            const b = parseInt(colorVal.slice(5, 7), 16);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        } else {
            gradient.addColorStop(0, 'rgba(187, 134, 252, 0.5)');
            gradient.addColorStop(1, 'rgba(187, 134, 252, 0)');
        }
        return gradient;
    }

    function generateWeeklyVolumeChart() {
        if (weeklyVolumeChart) weeklyVolumeChart.destroy();
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const weeklyData = history.reduce((acc, entry) => {
            const week = getWeekNumber(new Date(entry.isoDate));
            if (!acc[week]) acc[week] = 0;
            acc[week] += entry.totalVolume;
            return acc;
        }, {});
        const labels = Object.keys(weeklyData).sort().slice(-12);
        const data = labels.map(label => weeklyData[label]);
        const ctx = document.getElementById('weeklyVolumeChart').getContext('2d');
        weeklyVolumeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Total Volume (kg)',
                    data,
                    backgroundColor: 'rgba(3, 218, 198, 0.5)',
                    borderColor: 'rgba(3, 218, 198, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'kg'
                        }
                    }
                }
            }
        });
    }

    function generateFatigueAnalysisChart() {
        if (fatigueAnalysisChart) fatigueAnalysisChart.destroy();
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const weeklyData = history.reduce((acc, entry) => {
            const week = getWeekNumber(new Date(entry.isoDate));
            if (!acc[week]) acc[week] = {
                volume: 0,
                totalE1rm: 0,
                count: 0
            };
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
        fatigueAnalysisChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Weekly Volume',
                    data: volumeData,
                    yAxisID: 'yVolume',
                    backgroundColor: 'rgba(3, 218, 198, 0.5)'
                }, {
                    label: 'Avg Max e1RM',
                    data: avgE1rmData,
                    yAxisID: 'yE1rm',
                    type: 'line',
                    borderColor: 'rgba(187, 134, 252, 1)',
                    tension: 0.1,
                    fill: true,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {
                            ctx,
                            chartArea
                        } = chart;
                        if (!chartArea) return null;
                        return createChartGradient(ctx, '--secondary-color');
                    }
                }]
            },
            options: {
                scales: {
                    yVolume: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Volume (kg)'
                        }
                    },
                    yE1rm: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Avg e1RM (kg)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    function generateComparisonChart() {
        if (comparisonChart) comparisonChart.destroy();
        const select = document.getElementById('compare-exercise-select');
        const selectedExercises = Array.from(select.selectedOptions).map(option => option.value);
        if (selectedExercises.length < 2 || selectedExercises.length > 5) {
            alert("กรุณาเลือกท่าออกกำลังกายระหว่าง 2 ถึง 5 ท่าเพื่อเปรียบเทียบ");
            return;
        }

        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]").slice().reverse();
        const allLabelsSet = new Set();
        history.forEach(entry => allLabelsSet.add(new Date(entry.isoDate).toLocaleDateString("th-TH", {
            month: "short",
            day: "numeric"
        })));
        const allLabels = Array.from(allLabelsSet);
        const datasets = [];
        const colors = ['#03dac6', '#bb86fc', '#f44336', '#4caf50', '#ffeb3b'];
        selectedExercises.forEach((exName, index) => {
            const dataMap = new Map();
            history.forEach(entry => {
                const exData = entry.exercises.find(ex => ex.name === exName);
                if (exData && exData.type !== 'cardio') {
                    const dateLabel = new Date(entry.isoDate).toLocaleDateString("th-TH", {
                        month: "short",
                        day: "numeric"
                    });
                    const max1RM = Math.max(...exData.sets.map(s => s.e1rm), 0);
                    if (max1RM > 0) {
                        dataMap.set(dateLabel, max1RM);
                    }
                }
            });
            const color = colors[index % colors.length];
            datasets.push({
                label: exName,
                data: allLabels.map(label => dataMap.get(label) || null),
                borderColor: color,
                tension: 0.1,
                spanGaps: true,
                fill: true,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {
                        ctx,
                        chartArea
                    } = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
                    gradient.addColorStop(1, `rgba(${r},${g},${b},0.3)`);
                    return gradient;
                }
            });
        });
        const ctx = document.getElementById('comparisonChart').getContext('2d');
        comparisonChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Estimated 1RM (kg)'
                        }
                    }
                }
            }
        });
    }

    function generateMuscleBalanceChart() {
        if (muscleBalanceChart) {
            muscleBalanceChart.destroy();
        }
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const volumeByGroup = Object.keys(muscleGroups).reduce((acc, key) => ({ ...acc,
            [key]: 0
        }), {});
        history.filter(entry => new Date(entry.isoDate) > thirtyDaysAgo).forEach(entry => {
            entry.exercises.forEach(ex => {
                const group = ex.muscleGroup || getMuscleGroup(ex.name);
                if (volumeByGroup.hasOwnProperty(group)) {
                    if (ex.type !== 'cardio') {
                        volumeByGroup[group] += ex.volume;
                    }
                }
            });
        });
        const ctx = document.getElementById('muscleBalanceChart').getContext('2d');
        const labels = Object.keys(volumeByGroup);
        const data = Object.values(volumeByGroup);
        muscleBalanceChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels.map(l => muscleGroups[l] || l),
                datasets: [{
                    label: 'Volume Distribution',
                    data: data,
                    backgroundColor: 'rgba(187, 134, 252, 0.2)',
                    borderColor: 'rgba(187, 134, 252, 1)',
                    pointBackgroundColor: 'rgba(187, 134, 252, 1)',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    r: {
                        angleLines: {
                            color: getThemeColors().borderColor
                        },
                        grid: {
                            color: getThemeColors().borderColor
                        },
                        pointLabels: {
                            color: getThemeColors().textColor,
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    function populateMuscleGroupSelects() {
        const selects = document.querySelectorAll('#quick-log-muscle-group');
        let optionsHTML = '';
        for (const key in muscleGroups) {
            if (key !== 'Cardio') {
                optionsHTML += `<option value="${key}">${muscleGroups[key]}</option>`;
            }
        }
        selects.forEach(select => select.innerHTML = optionsHTML);
    }

    function generateExerciseCharts(exerciseName) {
        const container = document.getElementById('exercise-analysis-content');
        if (chartVolume) {
            chartVolume.destroy()
        }
        if (chartStrength) {
            chartStrength.destroy()
        }
        if (!exerciseName) {
            container.innerHTML = "";
            return;
        }
        container.innerHTML = `<div class="chart-container"><h3>Total Volume (kg)</h3><canvas id="chartVolume"></canvas></div><div class="chart-container"><h3>Estimated 1RM Progression (kg)</h3><canvas id="chartStrength"></canvas></div>`;
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const data = {
            labels: [],
            volumes: [],
            max1RMs: []
        };
        history.slice().reverse().forEach(entry => {
            const exData = entry.exercises.find(ex => ex.name === exerciseName);
            if (exData && exData.type !== 'cardio') {
                const date = new Date(entry.isoDate).toLocaleDateString("th-TH", {
                    month: "short",
                    day: "numeric"
                });
                const max1RM = Math.max(...exData.sets.map(s => s.e1rm), 0);
                data.labels.push(date);
                data.volumes.push(exData.volume);
                data.max1RMs.push(max1RM);
            }
        });
        const ctxVolume = document.getElementById("chartVolume").getContext("2d");
        chartVolume = new Chart(ctxVolume, {
            type: "bar",
            data: {
                labels: data.labels,
                datasets: [{
                    label: "Total Volume (kg)",
                    data: data.volumes,
                    backgroundColor: "rgba(3, 218, 198, 0.5)",
                    borderColor: "rgba(3, 218, 198, 1)",
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: !1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: !0
                    }
                }
            }
        });
        const ctxStrength = document.getElementById("chartStrength").getContext("2d");
        chartStrength = new Chart(ctxStrength, {
            type: "line",
            data: {
                labels: data.labels,
                datasets: [{
                    label: "Estimated 1RM (kg)",
                    data: data.max1RMs,
                    borderColor: "rgba(187, 134, 252, 1)",
                    tension: .1,
                    fill: true,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {
                            ctx,
                            chartArea
                        } = chart;
                        if (!chartArea) return null;
                        return createChartGradient(ctx, '--secondary-color');
                    }
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: !1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: !1
                    }
                }
            }
        });
    }

    function checkAndSavePR(exerciseName, weight, reps) {
        if (!personalRecords[exerciseName]) {
            personalRecords[exerciseName] = {
                maxWeight: 0,
                repPRs: {}
            };
        }
        const prData = personalRecords[exerciseName];
        let message = '';
        let newWeightPR = false;
        let newRepPR = false;
        if (weight > prData.maxWeight) {
            newWeightPR = true;
            prData.maxWeight = weight;
            message += `⭐ น้ำหนักสูงสุดใหม่: ${weight}kg! `;
            currentSessionPRs.push({
                type: 'weight',
                exercise: exerciseName,
                weight: weight
            });
        }
        if (!prData.repPRs[weight] || reps > prData.repPRs[weight]) {
            newRepPR = true;
            prData.repPRs[weight] = reps;
            message += `⭐ สถิติใหม่ที่ ${weight}kg: ${reps} ครั้ง!`;
            currentSessionPRs.push({
                type: 'reps',
                exercise: exerciseName,
                weight: weight,
                reps: reps
            });
        }
        if (newWeightPR || newRepPR) {
            localStorage.setItem("gymLogPRs_v4", JSON.stringify(personalRecords));
            renderPRsPage();
            const exCard = Array.from(document.querySelectorAll('.exercise-card')).find(card => card.querySelector('.exercise-title')?.textContent.startsWith(exerciseName));
            if (exCard) {
                const star = exCard.querySelector('.pr-star');
                if (star) star.style.display = 'inline';
            }
        }
        return message || null;
    }

    function recalculatePRs(exerciseName) {
        const history = JSON.parse(localStorage.getItem("gymLogHistory_v2") || "[]");
        const newPRData = {
            maxWeight: 0,
            repPRs: {}
        };
        history.forEach(entry => {
            entry.exercises.forEach(ex => {
                if (ex.name === exerciseName && ex.type !== 'cardio') {
                    ex.sets.forEach(set => {
                        if (set.weight > newPRData.maxWeight) {
                            newPRData.maxWeight = set.weight;
                        }
                        if (!newPRData.repPRs[set.weight] || set.reps > newPRData.repPRs[set.weight]) {
                            newPRData.repPRs[set.weight] = set.reps;
                        }
                    });
                }
            });
        });
        if (newPRData.maxWeight > 0 || Object.keys(newPRData.repPRs).length > 0) {
            personalRecords[exerciseName] = newPRData;
        } else {
            delete personalRecords[exerciseName];
        }
        localStorage.setItem("gymLogPRs_v4", JSON.stringify(personalRecords));
    }

    function startWorkoutTimer() {
        if (workoutStartTime) return;
        workoutStartTime = Date.now();
        const e = document.getElementById("total-duration-display");
        workoutTimerInterval = setInterval(() => {
            const t = Math.floor((Date.now() - workoutStartTime) / 1e3);
            const a = Math.floor(t / 3600);
            const n = Math.floor(t % 3600 / 60);
            const o = Math.floor(t % 60);
            e.textContent = `${a.toString().padStart(2,"0")}:${n.toString().padStart(2,"0")}:${o.toString().padStart(2,"0")}`
        }, 1e3)
    }

    function startTimer() {
        vibrate();
        clearInterval(timerInterval);
        timeRemaining = DEFAULT_REST_TIME;
        DOM.restTimer.classList.remove('hidden');
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) {
                stopTimer();
                playBeep()
            }
        }, 1e3)
    }


    function stopTimer() {
        clearInterval(timerInterval);
        DOM.restTimer.classList.add('hidden');
    }

    function adjustTimer(seconds) {
        timeRemaining += seconds;
        if (timeRemaining < 0) {
            timeRemaining = 0
        }
        updateTimerDisplay()
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        document.getElementById("timer-display").textContent = `${minutes}:${seconds.toString().padStart(2,"0")}`
    }

    function playBeep() {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + 1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + .5)
    }

    function getThemeColors() {
        const style = getComputedStyle(document.body);
        return {
            textColor: style.getPropertyValue('--text-color').trim(),
            textSecondaryColor: style.getPropertyValue('--text-secondary-color').trim(),
            borderColor: style.getPropertyValue('--border-color').trim(),
            primaryColor: style.getPropertyValue('--primary-color').trim(),
            secondaryColor: style.getPropertyValue('--secondary-color').trim()
        };
    }

    function updateChartDefaults() {
        if (typeof Chart === 'undefined') return;
        const themeColors = getThemeColors();
        Chart.defaults.color = themeColors.textSecondaryColor;
        Chart.defaults.borderColor = themeColors.borderColor;
        Chart.defaults.scale.title.color = themeColors.textColor;
    }

    const bodyStatMetrics = {
        weight: "น้ำหนักตัว (kg)",
        bf: "% ไขมัน",
        chest: "รอบอก (cm)",
        waist: "รอบเอว (cm)",
        arm: "รอบแขน (cm)"
    };

    function renderBodyStatsPage() {
        const select = document.getElementById("body-stat-select");
        if (!select) return;
        select.innerHTML = "";
        Object.keys(bodyStatMetrics).forEach(metric => {
            select.innerHTML += `<option value="${metric}">${bodyStatMetrics[metric]}</option>`
        });
        renderBodyStatChart(select.value);
    }

    function saveBodyStats() {
        const todayStr = new Date().toISOString().slice(0, 10);
        const newStat = {
            date: todayStr
        };
        let hasData = false;
        Object.keys(bodyStatMetrics).forEach(metric => {
            const input = document.getElementById(`stat-${metric}`);
            if (input.value) {
                newStat[metric] = parseFloat(input.value);
                hasData = true;
                input.value = "";
            }
        });
        if (hasData) {
            let existingIndex = bodyStats.findIndex(stat => stat.date === todayStr);
            if (existingIndex > -1) {
                bodyStats[existingIndex] = { ...bodyStats[existingIndex],
                    ...newStat
                };
            } else {
                bodyStats.push(newStat);
            }
            bodyStats.sort((a, b) => new Date(b.date) - new Date(a.date));
            localStorage.setItem("gymBodyStats", JSON.stringify(bodyStats));
            renderBodyStatsPage();
            alert("บันทึกข้อมูลร่างกายแล้ว!");
        } else {
            alert("กรุณากรอกข้อมูลอย่างน้อย 1 อย่าง");
        }
    }

    function renderBodyStatChart(metric) {
        if (bodyStatChart) bodyStatChart.destroy();
        const canvas = document.getElementById("bodyStatChart");
        if (!canvas || bodyStats.length === 0) return;

        const data = {
            labels: [],
            values: []
        };
        bodyStats.slice().reverse().forEach(stat => {
            if (stat[metric] !== undefined) {
                data.labels.push(new Date(stat.date).toLocaleDateString("th-TH", {
                    month: "short",
                    day: "numeric"
                }));
                data.values.push(stat[metric]);
            }
        });
        const ctx = canvas.getContext("2d");
        bodyStatChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: data.labels,
                datasets: [{
                    label: bodyStatMetrics[metric],
                    data: data.values,
                    borderColor: 'rgba(3, 218, 198, 1)',
                    tension: .1,
                    fill: true,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {
                            ctx,
                            chartArea
                        } = chart;
                        if (!chartArea) return null;
                        return createChartGradient(ctx, '--primary-color');
                    }
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    function openPlateCalculator(cardId) {
        const weightInput = document.getElementById(`weight-${cardId}`);
        const targetWeight = parseFloat(weightInput.value);
        const barbellWeight = userEquipment.barbellWeight;
        const plates = userEquipment.availablePlates;
        if (isNaN(targetWeight) || targetWeight < barbellWeight) {
            alert(`กรุณากรอกน้ำหนักเป้าหมายที่มากกว่าหรือเท่ากับ ${barbellWeight} kg (น้ำหนักแกนเปล่าของคุณ)`);
            return;
        }

        const weightPerSide = (targetWeight - barbellWeight) / 2;
        if (weightPerSide < 0) {
            alert("น้ำหนักเป้าหมายต้องมากกว่าน้ำหนักแกน");
            return;
        }

        let remainingWeight = weightPerSide;
        const platesResult = [];
        plates.forEach(plateWeight => {
            while (remainingWeight >= plateWeight) {
                platesResult.push(plateWeight);
                remainingWeight -= plateWeight;
            }
        });
        document.getElementById('calculator-target-weight').innerText = `${targetWeight} kg`;
        document.getElementById('plates-per-side-text').innerText = `แผ่นน้ำหนักต่อข้าง: ${platesResult.length > 0 ? platesResult.join(', ') : 'ไม่มี'}`;
        const vizContainer = document.getElementById('barbell-visualization');
        vizContainer.innerHTML = '';

        platesResult.slice().reverse().forEach(p => {
            const plateEl = document.createElement('div');
            plateEl.className = 'plate';
            plateEl.innerText = p;
            vizContainer.appendChild(plateEl);
        });
        vizContainer.innerHTML += '<div class="barbell-sleeve"></div>';

        platesResult.forEach(p => {
            const plateEl = document.createElement('div');
            plateEl.className = 'plate';
            plateEl.innerText = p;
            vizContainer.appendChild(plateEl);
        });
        document.getElementById('plate-calculator-modal').classList.remove('hidden');
    }

    function saveEquipmentSettings() {
        const barbellWeightInput = document.getElementById('equipment-barbell-weight');
        const platesInput = document.getElementById('equipment-plates');
        const barbellWeight = parseFloat(barbellWeightInput.value);
        const plates = platesInput.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0).sort((a, b) => b - a);
        if (isNaN(barbellWeight) || barbellWeight < 0) {
            alert("กรุณากรอกน้ำหนักแกนให้ถูกต้อง");
            return;
        }
        if (plates.length === 0) {
            alert("กรุณากรอกแผ่นน้ำหนักอย่างน้อย 1 ขนาด");
            return;
        }
        userEquipment = {
            barbellWeight,
            availablePlates: plates
        };
        localStorage.setItem('gymUserEquipment', JSON.stringify(userEquipment));
        alert('บันทึกข้อมูลอุปกรณ์สำเร็จ!');
    }

    function updateEquipmentInputs() {
        const barbellWeightInput = document.getElementById('equipment-barbell-weight');
        const platesInput = document.getElementById('equipment-plates');
        if (barbellWeightInput && platesInput) {
            barbellWeightInput.value = userEquipment.barbellWeight;
            platesInput.value = userEquipment.availablePlates.join(', ');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
             modal.classList.add('hidden');
        }
    }
    
    // --- Start the App ---
    initialize();

});