const DEFAULT_REST_TIME = 90;
let workoutStartTime = null, workoutTimerInterval = null;
let currentWorkoutLog = {}, personalRecords = {}, bodyStats = [], nextSessionSuggestions = {};
let currentSessionPRs = [];
let timerInterval, timeRemaining, audioContext, chartVolume, chartStrength, bodyStatChart, muscleBalanceChart, weeklyVolumeChart, fatigueAnalysisChart, comparisonChart;
let cardioDistanceChart, cardioPaceChart, cardioWeeklySummaryChart;
let workoutPlans = [], activePlanIndex = 0;
let userEquipment = { barbellWeight: 20, availablePlates: [20, 15, 10, 5, 2.5, 1.25] };
const defaultPlan = [{ name: "โปรแกรมเริ่มต้น 4 วัน/สัปดาห์", active: true, days: [ { name: "Upper A (จันทร์)", exercises: [{name: "Incline Dumbbell Press", muscleGroup: "Chest"}, {name: "One-arm Dumbbell Row", muscleGroup: "Back"}, {name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders"}, {name: "Dumbbell Curl", muscleGroup: "Arms"}, {name: "Overhead Triceps Extension", muscleGroup: "Arms"}] }, { name: "Lower A (อังคาร)", exercises: [{name: "Goblet Squat", muscleGroup: "Legs"}, {name: "Dumbbell Romanian Deadlift (RDL)", muscleGroup: "Legs"}, {name: "Hip Thrust", muscleGroup: "Legs"}, {name: "Calf Raise", muscleGroup: "Legs"}] }, { name: "พัก (พุธ)", exercises: [] }, { name: "Upper B (พฤหัสฯ)", exercises: [{name: "Flat Dumbbell Press", muscleGroup: "Chest"}, {name: "Pull-up / Band Pull-down", muscleGroup: "Back"}, {name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders"}, {name: "Dumbbell Hammer Curl", muscleGroup: "Arms"}, {name: "Bench Dips", muscleGroup: "Arms"}] }, { name: "Lower B (ศุกร์)", exercises: [{name: "Bulgarian Split Squat", muscleGroup: "Legs"}, {name: "Sumo Goblet Squat", muscleGroup: "Legs"}, {name: "Dumbbell Step-up", muscleGroup: "Legs"}, {name: "Standing Calf Raise", muscleGroup: "Legs"}] }, { name: "พัก (เสาร์)", exercises: [] }, { name: "พัก (อาทิตย์)", exercises: [] } ] }];
const muscleGroups = { 'Chest': 'อก', 'Back': 'หลัง', 'Legs': 'ขา', 'Shoulders': 'ไหล่', 'Arms': 'แขน', 'Core': 'แกนกลางลำตัว', 'Other': 'อื่นๆ', 'Cardio': 'คาร์ดิโอ' };
const muscleGroupColors = { 'Chest': '#f44336', 'Back': '#2196F3', 'Legs': '#4CAF50', 'Shoulders': '#FFC107', 'Arms': '#9C27B0', 'Core': '#FF9800', 'Other': '#9E9E9E', 'Cardio': '#03dac6'};
let currentCalendarDate = new Date();

function vibrate(duration = 50) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(duration); } catch (e) { console.warn("Could not vibrate:", e); }
    }
}

function getMuscleGroup(exerciseName) {
    const lowerExName = exerciseName.toLowerCase();
    if (lowerExName.includes('run') || lowerExName.includes('walk') || lowerExName.includes('cycle') || lowerExName.includes('cardio')) return 'Cardio';
    const keywordMap = { 'press': 'Chest', 'push-up': 'Chest', 'fly': 'Chest', 'dips': 'Chest', 'row': 'Back', 'pull-up': 'Back', 'pull-down': 'Back', 'deadlift': 'Back', 'squat': 'Legs', 'lunge': 'Legs', 'step-up': 'Legs', 'thrust': 'Legs', 'calf raise': 'Legs', 'shoulder press': 'Shoulders', 'lateral raise': 'Shoulders', 'front raise': 'Shoulders', 'curl': 'Arms', 'triceps extension': 'Arms', 'hammer curl': 'Arms', 'crunch': 'Core', 'plank': 'Core', 'leg raise': 'Core' };
    for (const keyword in keywordMap) {
        if (lowerExName.includes(keyword)) return keywordMap[keyword];
    }
    return 'Other';
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
        console.error("Web Audio API not supported");
    }
    runDataMigrations();
    loadAllData();
    renderPlanListView();
    setupTodayWorkout();
    applyTheme();
    updateChartDefaults();
    populateMuscleGroupSelects();
    document.getElementById('exercise-select').addEventListener('change', (e) => generateExerciseCharts(e.target.value));
    document.getElementById('restore-file-input').addEventListener('change', handleRestoreFile);
    feather.replace();
    document.addEventListener('click', function(event) {
        const popup = document.getElementById('quick-log-popup');
        const button = document.getElementById('quick-log-btn-top');
        if (popup && button && !popup.contains(event.target) && !button.contains(event.target)) {
            popup.style.display = 'none';
        }
    });
});

function applyTheme() {
    const theme = localStorage.getItem("gymLogTheme") || "dark";
    document.body.className = theme === "dark" ? "" : "light-mode";
}

function toggleTheme() {
    const newTheme = document.body.classList.contains("light-mode") ? "dark" : "light";
    document.body.className = newTheme === "dark" ? "" : "light-mode";
    localStorage.setItem("gymLogTheme", newTheme);
    updateChartDefaults();
    const activeAnalysisTab = document.querySelector('.analysis-tab-btn.active');
    if (activeAnalysisTab) {
        const tabName = activeAnalysisTab.getAttribute('onclick').match(/'(.*?)'/)[1];
        showAnalysisTab(tabName, true);
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
        if(workoutPlans.length > 0) workoutPlans[0].active = true;
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
    const blob = new Blob([jsonString], { type: 'application/json' });
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
    if (!file) { return; }
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
                    const { name } = ex;
                    const { weight, reps } = set;
                    if (!newPRs[name]) { newPRs[name] = { maxWeight: 0, repPRs: {} }; }
                    if (weight > newPRs[name].maxWeight) { newPRs[name].maxWeight = weight; }
                    if (!newPRs[name].repPRs[weight] || reps > newPRs[name].repPRs[weight]) { newPRs[name].repPRs[weight] = reps; }
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
    view.innerHTML = `<h2>จัดการตารางฝึก</h2><div id="plan-list"></div><button class="action-btn secondary" onclick="createNewPlan()"><i data-feather="plus-circle"></i>สร้างโปรแกรมใหม่</button>`;
    const planListDiv = document.getElementById("plan-list");
    workoutPlans.forEach((plan, planIndex) => {
        const card = document.createElement("div");
        card.className = "card";
        let daysHTML = plan.days.map((day, dayIndex) => `<div class="list-item"><span><strong>${day.name}</strong> (${day.exercises.length} ท่า)</span><div class="btn-group"><button onclick="renderDayEditorView(${planIndex}, ${dayIndex})"><i data-feather="edit-2"></i></button></div></div>`).join("");
        card.innerHTML = `<h3>${plan.name} ${plan.active ? "(ใช้งานอยู่)" : ""}</h3>${daysHTML}<div class="btn-group" style="margin-top: 15px; display:flex; gap: 10px;">${plan.active ? "" : `<button class="action-btn success" onclick="setActivePlan(${planIndex})">เลือกใช้</button>`}<button class="action-btn neutral" onclick="renamePlan(${planIndex})">เปลี่ยนชื่อ</button><button class="btn-delete" onclick="deletePlan(${planIndex})"><i data-feather="trash-2"></i></button></div>`;
        planListDiv.appendChild(card);
    });
    feather.replace();
}

// ... All other functions from original file are here ...
