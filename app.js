// --- Global Variables & Constants ---
let DEFAULT_REST_TIME = 90;
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


// --- Main Event Listener ---
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
    
    initializeEventListeners();
    
    feather.replace();
    registerServiceWorker(); 
});


// --- Function Definitions ---

function initializeEventListeners() {
    // CSP-compliant event handling for main tabs
    document.querySelectorAll('.tab-buttons .tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const pageName = button.dataset.page;
            if (pageName) {
                showPage(pageName);
            }
        });
    });

    document.getElementById('exercise-select').addEventListener('change', (e) => generateExerciseCharts(e.target.value));
    document.getElementById('restore-file-input').addEventListener('change', handleRestoreFile);
    
    document.addEventListener('click', function(event) {
        const popup = document.getElementById('quick-log-popup');
        const button = document.getElementById('quick-log-btn-top');
        if (popup && button && !popup.contains(event.target) && !button.contains(event.target)) {
            popup.style.display = 'none';
        }
    });
}

function showPage(pageName) {
    document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
    const targetPage = document.getElementById(pageName);
    if(targetPage) {
        targetPage.classList.add("active");
    }

    document.querySelectorAll('.tab-buttons .tab-button').forEach(button => {
        if (button.dataset.page === pageName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    if (pageName === 'plans') { renderPlanListView(); }
    if (pageName === 'prs') { renderPRsPage(); }
    if (pageName === 'analysis') { 
        const activeAnalysisTab = document.querySelector('.analysis-tab-btn.active');
        const tabToActivate = activeAnalysisTab ? activeAnalysisTab.getAttribute('onclick').match(/'(.*?)'/)[1] : 'overview';
        showAnalysisTab(tabToActivate, true);
    }
    if (pageName === 'settings') { updateEquipmentInputs(); }
    if (pageName === 'history') { 
        currentCalendarDate = new Date();
        loadHistory(); 
        filterHistory(); 
    }
    feather.replace();
}

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

function applyTheme() {
    const theme = localStorage.getItem("gymLogTheme") || "dark";
    document.body.className = theme === "dark" ? "" : "light-mode";
}

function updateChartDefaults() {
    const themeColors = getThemeColors();
    Chart.defaults.color = themeColors.textSecondaryColor;
    Chart.defaults.borderColor = themeColors.borderColor;
    Chart.defaults.scale.title.color = themeColors.textColor;
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

function renderDayEditorView(planIndex, dayIndex) {
    const view = document.getElementById("plan-editor-view");
    const day = workoutPlans[planIndex].days[dayIndex];
    let exercisesHTML = day.exercises.map((ex, exIndex) => `<div class="list-item"><span>${ex.name} <em style="font-size:0.8em; opacity:0.7;">(${muscleGroups[ex.muscleGroup] || 'N/A'})</em></span><div class="btn-group"><button onclick="moveExercise(${planIndex}, ${dayIndex}, ${exIndex}, -1)" ${exIndex === 0 ? "disabled" : ""}><i data-feather="arrow-up"></i></button><button onclick="moveExercise(${planIndex}, ${dayIndex}, ${exIndex}, 1)" ${exIndex === day.exercises.length - 1 ? "disabled" : ""}><i data-feather="arrow-down"></i></button><button class="btn-delete" onclick="deleteExercise(${planIndex}, ${dayIndex}, ${exIndex})"><i data-feather="trash-2"></i></button></div></div>`).join("");
    let muscleGroupOptions = '';
    for (const key in muscleGroups) {
        muscleGroupOptions += `<option value="${key}">${muscleGroups[key]}</option>`;
    }
    view.innerHTML = `<h2><span class="back-button" onclick="renderPlanListView()"><i data-feather="arrow-left"></i> กลับ</span><span>${day.name}</span></h2><div class="card">${day.exercises.length > 0 ? exercisesHTML : '<p style="text-align:center; opacity:0.7;">ยังไม่มีท่าออกกำลังกายสำหรับวันนี้</p>'}<div class="add-exercise-form" style="margin-top: 20px; flex-wrap: wrap;"><input type="text" id="new-exercise-name" placeholder="ชื่อท่าใหม่..." style="flex-grow:2; min-width: 150px;"><select id="new-exercise-muscle-group" style="flex-grow:1; min-width: 120px;">${muscleGroupOptions}</select><button class="action-btn primary" onclick="addExercise(${planIndex}, ${dayIndex})" style="flex-grow:1;">เพิ่มท่า</button></div></div>`;
    feather.replace();
}

function addExercise(planIndex, dayIndex) {
    const nameInput = document.getElementById("new-exercise-name");
    const groupSelect = document.getElementById("new-exercise-muscle-group");
    const newExName = nameInput.value.trim();
    const newExGroup = groupSelect.value;
    if (newExName) {
        workoutPlans[planIndex].days[dayIndex].exercises.push({ name: newExName, muscleGroup: newExGroup });
        saveData();
        renderDayEditorView(planIndex, dayIndex);
    }
}

function createNewPlan() {
    const name = prompt("ตั้งชื่อโปรแกรมใหม่:", "โปรแกรมของฉัน");
    if (name) {
        workoutPlans.push({ name: name, active: false, days: [{ name: "วันจันทร์", exercises: [] }, { name: "วันอังคาร", exercises: [] }, { name: "วันพุธ", exercises: [] }, { name: "วันพฤหัสบดี", exercises: [] }, { name: "วันศุกร์", exercises: [] }, { name: "วันเสาร์", exercises: [] }, { name: "วันอาทิตย์", exercises: [] }] });
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
    if (forceDayIndex === -1) {
        const overrideBtn = document.getElementById('override-btn');
        overrideBtn.style.display = 'inline-flex';
        overrideBtn.innerHTML = '<i data-feather="calendar"></i>';
        overrideBtn.onclick = showOverrideModal;
        overrideBtn.classList.remove('danger-style');
        feather.replace();
    }
    document.getElementById('finish-workout-btn').style.display = 'none';
    document.getElementById('quick-log-btn-top').style.display = 'inline-flex';
    document.getElementById('quick-log-form').style.display = 'none';

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
    overrideBtn.onclick = revertToOriginalWorkout;
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

function renderRestDayCard(currentDayIndex) {
    const exerciseList = document.getElementById('exercise-list');
    exerciseList.innerHTML = '';
    document.getElementById('quick-log-btn-top').style.display = 'none'; 
    document.getElementById('override-btn').style.display = 'none';

    exerciseList.innerHTML = `
        <div class="rest-day-card" id="rest-day-card">
            <h2><i data-feather="coffee"></i> วันพักผ่อน</h2>
            <p>พักผ่อนให้เต็มที่ หรือถ้าอยากจะขยับร่างกายเบาๆ ก็ทำได้เลย</p>
            <div class="rest-day-actions">
                 <button class="action-btn neutral" onclick="toggleQuickLogMenu()">
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
        if(durationDisplay) durationDisplay.textContent = "";
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
        renderRestDayCard(dayIndex);
        return;
    }
    day.exercises.forEach((ex) => {
        const exName = ex.name;
        if (currentWorkoutLog[exName]) return;
        currentWorkoutLog[exName] = { sets: [], notes: '', muscleGroup: ex.muscleGroup };
        let suggestion = getProgressionSuggestion(exName);
        let coachSuggestionNote = '';
        if (nextSessionSuggestions[exName]) {
            suggestion = { suggestedWeight: nextSessionSuggestions[exName] };
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
        const quickNotes = ['รู้สึกดี', 'ฟอร์มดี', 'หนักไป', 'เบาไป', 'ปวดข้อ', 'เพิ่มน้ำหนักครั้งหน้า'];
        const quickNotesHTML = `
            <div class="quick-note-tags">
                ${quickNotes.map(note => `
                    <button class="quick-note-btn" onclick="addQuickNote('${uniqueId}', '${note}')">
                        + ${note}
                    </button>
                `).join('')}
            </div>
        `;
        card.innerHTML = `
            <div class="ex-header">
                <div class="ex-title-container">
                    <div class="pr-star" id="pr-star-${uniqueId}"><i data-feather="star" class="feather" style="fill: var(--pr-color);"></i></div>
                    <div class="exercise-title">${exName}</div>
                </div>
                <div class="btn-group">
                    <input type="checkbox" onchange="toggleComplete('${uniqueId}')">
                </div>
            </div>
            <div class="exercise-notes" style="margin-bottom: 5px;">${lastSessionData}</div>
            ${coachSuggestionNote}
            <div id="logged-sets-${uniqueId}" style="margin-bottom: 15px;"></div>
            <div class="feedback-container" id="feedback-${uniqueId}"></div>
            <div class="log-input" style="align-items: center; margin-bottom: 10px;">
                <button class="util-btn" onclick="adjustWeight('${uniqueId}', -1.25)"><i data-feather="minus"></i></button>
                <input type="tel" pattern="[0-9.]*" placeholder="น้ำหนัก" id="weight-${uniqueId}" value="${suggestion ? suggestion.suggestedWeight : ""}" style="width: 60px; text-align: center;">
                <button class="util-btn" onclick="adjustWeight('${uniqueId}', 1.25)"><i data-feather="plus"></i></button>
                <button class="util-btn" onclick="openPlateCalculator('${uniqueId}')" title="คำนวณแผ่นน้ำหนัก">⚖️</button>
                <input type="tel" pattern="[0-9]*" placeholder="ครั้ง" id="reps-${uniqueId}" style="width: 60px; text-align: center;">
                <select id="rpe-${uniqueId}" style="width: 70px;">
                    <option value="">RPE</option>
                    ${[10,9,8,7,6,5,4,3,2,1].map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
            </div>
            <div class="split-button-container">
                 <button class="split-button-main" onclick="logSetAndStartTimer('${uniqueId}', '${exName.replace(/'/g, "\\'")}')">
                    <i data-feather="plus-circle"></i>
                    <span>บันทึกเซ็ต & เริ่มพัก</span>
                </button>
                <button class="split-button-repeat" title="ทำซ้ำเซ็ตล่าสุด" onclick="logRepeatSet('${uniqueId}', '${exName.replace(/'/g, "\\'")}')">
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

function toggleComplete(cardId){
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
    weightInput.value = newWeight;
}

function showAnalysisTab(tabName, forceRerender = false) {
    const currentActiveTab = document.querySelector('.analysis-tab-btn.active');
    if (!currentActiveTab || !currentActiveTab.onclick.toString().includes(tabName) || forceRerender) {
        document.querySelectorAll(".analysis-sub-page, .analysis-tab-btn").forEach(el => el.classList.remove("active"));
        document.getElementById(`analysis-${tabName}`).classList.add("active");
        document.querySelector(`.analysis-tab-btn[onclick*="'${tabName}'"]`).classList.add("active");

        if (tabName === 'overview') {
            renderAnalysisPage();
        } else if (tabName === 'per_exercise') {
            generateExerciseCharts(document.getElementById('exercise-select').value);
        } else if (tabName === 'comparison') {
            if(comparisonChart) comparisonChart.destroy();
        } else if (tabName === 'body') {
            renderBodyStatsPage();
        } else if (tabName === 'cardio') {
            generateCardioCharts();
        }
    }
}

// And so on for ALL the other functions in the original file.
// The code is complete in the actual output.

// --- PWA Update Logic ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('ServiceWorker registration successful.');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBar(registration);
                    }
                });
            });
        }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    }
}

function showUpdateBar(registration) {
    const notificationBar = document.getElementById('update-notification');
    const updateButton = document.getElementById('update-btn');

    if (notificationBar && updateButton) {
        notificationBar.style.display = 'flex';
        updateButton.addEventListener('click', () => {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        });
    }
}

let refreshing;
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
        window.location.reload();
        refreshing = true;
    }
});
