// js/logic.js
// รวม Logic หลักของแอปพลิเคชัน เช่น การคำนวณ, การจัดการข้อมูลเชิงลึก, และการบันทึก

import { DOM } from './dom.js';
import { state } from './state.js';
import { saveData, loadData } from './storage.js';
import { showAlert, showConfirm } from './modal.js';
import { calculate1RM, getMuscleGroup, vibrate } from './utils.js';
import { DEFAULT_REST_TIME, bodyStatMetrics } from './config.js';

// --- REFACTORED: Import specific functions from new UI modules ---
import { 
    renderLoggedSets, 
    appendNewSetToDOM, 
    displayRpeFeedback, 
    renderCardioLogInPage, 
    renderQuickWeightLogInPage, 
    toggleQuickLogPanel,
    setupTodayWorkout,
    renderWorkoutForDay,
    setOverrideButtonState,
    exitProgramSelectionMode,
    enterProgramSelectionMode
} from './ui-workout.js';
// --- BUG FIX: ลบการ import ที่ไม่จำเป็นและสร้างปัญหา ---
// import { renderPRsPage, renderBodyStatsPage } from './ui-shared.js'; 
import { loadHistory } from './ui-history.js';


// --- Data Migration ---
export function runDataMigrations(force = false) {
    let history = loadData('gymLogHistory_v2', []);
    let historyWasModified = false;
    
    if (history.length > 0) {
        history.forEach(entry => {
            if (!entry.isoDate && entry.id) {
                entry.isoDate = new Date(entry.id).toISOString();
                historyWasModified = true;
            }
            if (entry.exercises && !Array.isArray(entry.exercises)) {
                entry.exercises = Object.entries(entry.exercises).map(([name, data]) => ({ name, ...data }));
                historyWasModified = true;
            }
            
            let calculatedTotalVolume = 0;
            let needsVolumeRecalc = !entry.hasOwnProperty('totalVolume');

            if (entry.exercises && Array.isArray(entry.exercises)) {
                entry.exercises.forEach(ex => {
                    if (ex.type !== 'cardio' && ex.sets && Array.isArray(ex.sets)) {
                        const calculatedExVolume = ex.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);
                        if (ex.volume !== calculatedExVolume) {
                            ex.volume = calculatedExVolume;
                            historyWasModified = true;
                        }
                        calculatedTotalVolume += ex.volume;

                        ex.sets.forEach(set => {
                            if (!set.hasOwnProperty('e1rm')) {
                                set.e1rm = calculate1RM(set.weight, set.reps);
                                historyWasModified = true;
                            }
                        });
                    }
                });
            }
            
            if (needsVolumeRecalc || entry.totalVolume !== calculatedTotalVolume) {
                entry.totalVolume = calculatedTotalVolume;
                historyWasModified = true;
            }
        });

        if (historyWasModified || force) {
            saveData('gymLogHistory_v2', history);
        }
    }

    const v4PrMigration = loadData('gymPrMigrationComplete_v4', false);
    if (!v4PrMigration || force) {
        const freshHistory = loadData('gymLogHistory_v2', []); 
        const newPRs = {};
        freshHistory.forEach(entry => {
            if (!entry.exercises || !Array.isArray(entry.exercises)) return;
            entry.exercises.forEach(ex => {
                if (ex.type === 'cardio' || !ex.sets || !Array.isArray(ex.sets)) return;
                ex.sets.forEach(set => {
                    const { name } = ex;
                    const { weight, reps } = set;
                    if (!name || typeof weight === 'undefined' || typeof reps === 'undefined') return;
                    
                    if (!newPRs[name]) {
                        newPRs[name] = { maxWeight: 0, repPRs: {} };
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
        saveData('gymLogPRs_v4', newPRs);
        saveData('gymPrMigrationComplete_v4', true);
        localStorage.removeItem('gymLogPRs');
    }
}

// --- Workout Logic ---
export function overrideWorkout(dayIndex) {
    exitProgramSelectionMode();
    
    state.isWorkoutOverridden = true;
    renderWorkoutForDay(dayIndex, true);
    setOverrideButtonState(true);
}

export async function revertToOriginalWorkout() {
    const hasLoggedData = Object.values(state.currentWorkoutLog).some(ex => ex.sets.length > 0);
    if (hasLoggedData) {
        const confirmed = await showConfirm("การกลับไปจะลบข้อมูลที่บันทึกไว้ในโปรแกรมปัจจุบัน คุณแน่ใจหรือไม่?");
        if (confirmed) {
            enterProgramSelectionMode();
        }
    } else {
        enterProgramSelectionMode();
    }
}

export function saveCardioLog() {
    const type = document.getElementById('quick-log-cardio-type').value;
    const distance = parseFloat(document.getElementById('quick-log-cardio-distance').value);
    const duration = parseInt(document.getElementById('quick-log-cardio-duration').value);
    const notes = document.getElementById('quick-log-cardio-notes').value.trim();

    if (isNaN(distance) || isNaN(duration) || distance <= 0 || duration <= 0) {
        showAlert("กรุณากรอกระยะทางและเวลาให้เป็นตัวเลขที่ถูกต้อง", "ข้อมูลไม่ครบถ้วน");
        return;
    }
    
    const activityName = type === 'อื่นๆ' ? 'Cardio' : type;
    const cardioData = { name: activityName, type: 'cardio', distance, duration, notes, muscleGroup: 'Cardio', sets: [] };
    state.currentWorkoutLog[`Cardio-${Date.now()}`] = cardioData;
    
    saveWorkoutToHistory();
    renderCardioLogInPage(cardioData);
    
    document.getElementById('quick-log-cardio-distance').value = '';
    document.getElementById('quick-log-cardio-duration').value = '';
    document.getElementById('quick-log-cardio-notes').value = '';
    toggleQuickLogPanel('quick-log-cardio-form');
}

export function saveQuickLog() {
    const exerciseName = document.getElementById('quick-log-exercise').value.trim();
    const muscleGroup = document.getElementById('quick-log-muscle-group').value;
    const weight = parseFloat(document.getElementById('quick-log-weight').value);
    const reps = parseInt(document.getElementById('quick-log-reps').value);

    if (!exerciseName || isNaN(weight) || isNaN(reps)) {
        showAlert("กรุณากรอกข้อมูลให้ครบและถูกต้อง", "ข้อมูลไม่ครบถ้วน");
        return;
    }

    const logKey = `freestyle|${exerciseName}|${Date.now()}`;
    const newSet = { weight, reps, rpe: "-", e1rm: calculate1RM(weight, reps) };

    state.currentWorkoutLog[logKey] = {
        name: exerciseName, 
        sets: [newSet],
        notes: '',
        muscleGroup: muscleGroup
    };
    
    checkAndSavePR(exerciseName, weight, reps);
    
    saveWorkoutToHistory();
    renderQuickWeightLogInPage(exerciseName, newSet);
    
    document.getElementById('quick-log-exercise').value = '';
    document.getElementById('quick-log-weight').value = '';
    document.getElementById('quick-log-reps').value = '';
    toggleQuickLogPanel('quick-log-form');
}

export function adjustWeight(cardId, amount) {
    const weightInput = document.getElementById(`weight-${cardId}`);
    let currentWeight = parseFloat(weightInput.value) || 0;
    let newWeight = currentWeight + amount;
    weightInput.value = newWeight.toFixed(2).replace(/\.00$/, '').replace(/\.([1-9])0$/, '.$1');
}

export function adjustReps(cardId, amount) {
    const repsInput = document.getElementById(`reps-${cardId}`);
    let currentReps = parseInt(repsInput.value) || 0;
    let newReps = currentReps + amount;
    if (newReps < 0) newReps = 0;
    repsInput.value = newReps;
}

export async function deleteSet(logKey, cardId, setIndex) {
    const exerciseName = state.currentWorkoutLog[logKey]?.name || logKey;
    const confirmed = await showConfirm(`คุณแน่ใจหรือไม่ว่าจะลบ Set ${setIndex + 1} ของท่า ${exerciseName}?`);
    if (confirmed) {
        if (state.currentWorkoutLog[logKey]) {
            state.currentWorkoutLog[logKey].sets.splice(setIndex, 1);
            
            if (state.currentWorkoutLog[logKey].sets.length === 0) {
                delete state.currentWorkoutLog[logKey];
                const cardToRemove = document.getElementById(cardId);
                if (cardToRemove) cardToRemove.remove();
            }

            saveWorkoutToHistory();
            renderLoggedSets(logKey, cardId); 
            recalculatePRs(exerciseName);

            const totalSets = Object.values(state.currentWorkoutLog).reduce((sum, ex) => sum + ex.sets.length, 0);
            if (totalSets === 0) {
                DOM.finishWorkoutBtn.classList.add('hidden');
            }
        }
    }
}

export function logRepeatSet(cardId, logKey, exerciseName) {
    if (!state.currentWorkoutLog[logKey] || state.currentWorkoutLog[logKey].sets.length === 0) {
        showAlert("ยังไม่มีเซ็ตล่าสุดให้ทำซ้ำ กรุณาบันทึกเซ็ตแรกก่อน", "ข้อมูลไม่พบ");
        return;
    }
    startWorkoutTimer();
    
    const lastSet = state.currentWorkoutLog[logKey].sets.slice(-1)[0];
    const { weight, reps, rpe } = lastSet;
    
    document.getElementById(`weight-${cardId}`).value = weight;
    document.getElementById(`reps-${cardId}`).value = reps;
    document.getElementById(`rpe-${cardId}`).value = rpe;
    
    logSet(cardId, logKey, exerciseName, weight, reps, rpe, true).then(success => {
        if (success) {
            startTimer();
        }
    });
}

export async function logSet(cardId, logKey, exerciseName, weight, reps, rpe, fromRepeat = false) {
    if (DOM.finishWorkoutBtn.classList.contains('hidden')) {
        DOM.finishWorkoutBtn.classList.remove('hidden');
        DOM.finishWorkoutBtn.style.animation = 'fadeIn 0.5s';
    }

    const isBodyweight = state.currentWorkoutLog[logKey]?.isBodyweight || false;

    if (isBodyweight && isNaN(weight)) {
        weight = 0;
    }

    if (!fromRepeat && !isBodyweight) {
        const prData = state.personalRecords[exerciseName];
        if (prData && prData.maxWeight > 0 && weight > prData.maxWeight * 1.20) {
            const confirmed = await showConfirm(`น้ำหนัก ${weight}kg สูงกว่าสถิติเดิม (${prData.maxWeight}kg) มาก คุณแน่ใจหรือไม่?`, "สถิติใหม่?");
            if (!confirmed) return false;
        } else if ((!prData || prData.maxWeight === 0) && weight > 100) { 
            const confirmed = await showConfirm(`คุณกำลังจะบันทึกน้ำหนัก ${weight}kg สำหรับท่าใหม่นี้ คุณแน่ใจหรือไม่?`, "ยืนยันน้ำหนัก");
            if (!confirmed) return false;
        }
    }

    const prMessages = checkAndSavePR(exerciseName, weight, reps);
    if (prMessages) {
        displayRpeFeedback(cardId, prMessages);
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#bb86fc', '#03dac6', '#FFD700'] });
        }
        vibrate(100);
    }

    const logData = { weight, reps, rpe: rpe || "-", e1rm: calculate1RM(weight, reps) };
    if (!state.currentWorkoutLog[logKey]) {
        const card = document.getElementById(cardId);
        const muscleGroup = card ? getMuscleGroup(card.dataset.exerciseName) : 'Other';
        state.currentWorkoutLog[logKey] = { name: exerciseName, sets: [], notes: '', muscleGroup, isBodyweight };
    }
    state.currentWorkoutLog[logKey].sets.push(logData);
    
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.remove('flash-success');
        void card.offsetWidth; 
        card.classList.add('flash-success');
    }

    appendNewSetToDOM(cardId, logKey, state.currentWorkoutLog[logKey].sets.length - 1);
    
    document.getElementById(`reps-${cardId}`).value = reps;
    document.getElementById(`rpe-${cardId}`).value = "";
    document.getElementById(`reps-${cardId}`).focus();
    
    saveWorkoutToHistory();
    return true;
}

export function logSetAndStartTimer(cardId, logKey, exerciseName) {
    startWorkoutTimer();
    
    let weight = parseFloat(document.getElementById(`weight-${cardId}`).value);
    const reps = parseInt(document.getElementById(`reps-${cardId}`).value);
    const rpe = document.getElementById(`rpe-${cardId}`).value;
    
    const isBodyweight = state.currentWorkoutLog[logKey]?.isBodyweight || false;

    if (isNaN(reps) || !Number.isInteger(reps) || reps <= 0) {
        showAlert("กรุณาใส่จำนวนครั้งให้เป็นเลขจำนวนเต็มบวก", "ข้อมูลไม่ถูกต้อง");
        document.getElementById(`reps-${cardId}`).focus();
        return;
    }
    
    if (!isBodyweight && (isNaN(weight) || weight < 0)) {
        showAlert("กรุณากรอกน้ำหนักให้เป็นตัวเลขที่ถูกต้อง (ไม่ติดลบ)", "ข้อมูลไม่ถูกต้อง");
        document.getElementById(`weight-${cardId}`).focus();
        return;
    }

    logSet(cardId, logKey, exerciseName, weight, reps, rpe).then(success => {
        if (success) {
            startTimer();
        }
    });
}


// --- History Management ---
export function saveWorkoutToHistory() {
    let history = [...state.history];
    const today = new Date();
    
    const todayId = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    
    let totalVolume = 0;
    const exercisesData = [];

    Object.keys(state.currentWorkoutLog).forEach((exKey) => {
        const exLog = state.currentWorkoutLog[exKey];
        if (exLog && ((exLog.sets && exLog.sets.length > 0) || exLog.type === 'cardio')) {
            const card = Array.from(document.querySelectorAll('.exercise-card')).find(c => c.dataset.logKey === exKey || c.dataset.exerciseName === exKey);
            const notes = card ? card.querySelector('.notes-input')?.value : (exLog.notes || "");
            
            let exerciseVolume = 0;
            if (exLog.type !== 'cardio' && exLog.sets?.length > 0) {
                exerciseVolume = exLog.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
                totalVolume += exerciseVolume;
            }
            exercisesData.push({ ...exLog, name: exLog.name || exKey, volume: exerciseVolume, notes });
        }
    });

    if (exercisesData.length === 0) {
        const todayIndex = history.findIndex(entry => entry.id === todayId);
        if (todayIndex > -1) {
            history.splice(todayIndex, 1);
            saveData("gymLogHistory_v2", history);
            state.history = history;
        }
        return;
    }

    let durationStr = "00:00:00";
    if (state.workoutStartTime) {
        const elapsed = Math.floor((Date.now() - state.workoutStartTime) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor(elapsed % 3600 / 60).toString().padStart(2, '0');
        const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
        durationStr = `${h}:${m}:${s}`;
    }

    const newEntry = {
        id: todayId,
        isoDate: today.toISOString(),
        dayName: document.getElementById('workout-day-title').textContent,
        totalVolume,
        duration: state.settings.useTotalDurationTimer ? durationStr : "N/A",
        exercises: exercisesData,
        prsAchieved: state.currentSessionPRs
    };

    const todayIndex = history.findIndex(entry => entry.id === todayId);
    if (todayIndex > -1) {
        history[todayIndex] = newEntry;
    } else {
        history.unshift(newEntry);
    }
    saveData("gymLogHistory_v2", history);
    state.history = history;
}

export async function deleteHistoryEntry(index) {
    const confirmed = await showConfirm("คุณแน่ใจหรือไม่ที่จะลบรายการของทั้งวันนี้? การกระทำนี้ไม่สามารถย้อนกลับได้");
    if (confirmed) {
        let history = [...state.history];
        if (index >= 0 && index < history.length) {
            const exercisesToRecalc = history[index].exercises.filter(ex => ex.type !== 'cardio');
            history.splice(index, 1);
            saveData("gymLogHistory_v2", history);
            state.history = history;
            exercisesToRecalc.forEach(ex => recalculatePRs(ex.name));
            loadHistory();
            setupTodayWorkout();
            showAlert("ลบรายการสำเร็จ");
        }
    }
}

export async function deleteExerciseFromHistory(historyIndex, exerciseIndex) {
    let history = [...state.history];
    const entry = history[historyIndex];
    const exerciseToDelete = entry.exercises[exerciseIndex];
    const confirmed = await showConfirm(`คุณแน่ใจหรือไม่ที่จะลบข้อมูลท่า "${exerciseToDelete.name || 'Cardio'}" ทั้งหมดออกจากประวัติวันนี้?`);
    
    if (confirmed) {
        const deletedVolume = exerciseToDelete.volume || 0;
        entry.exercises.splice(exerciseIndex, 1);
        entry.totalVolume -= deletedVolume;
        
        if (entry.exercises.length === 0) {
            history.splice(historyIndex, 1);
        }
        saveData("gymLogHistory_v2", history);
        state.history = history;
        
        if (exerciseToDelete.type !== 'cardio') {
            recalculatePRs(exerciseToDelete.name);
        }
        loadHistory();
        setupTodayWorkout();
    }
}

export async function deleteSetFromHistory(historyIndex, exerciseIndex, setIndex) {
    let history = [...state.history];
    const entry = history[historyIndex];
    const exercise = entry.exercises[exerciseIndex];
    const setToDelete = exercise.sets[setIndex];
    const confirmed = await showConfirm(`คุณแน่ใจหรือไม่ที่จะลบ Set ${setIndex + 1} (${setToDelete.weight}kg x ${setToDelete.reps} reps) ออกจากท่า ${exercise.name}?`);
    
    if (confirmed) {
        const deletedSetVolume = setToDelete.weight * setToDelete.reps;
        exercise.volume -= deletedSetVolume;
        entry.totalVolume -= deletedSetVolume;
        exercise.sets.splice(setIndex, 1);
        
        if (exercise.sets.length === 0) entry.exercises.splice(exerciseIndex, 1);
        if (entry.exercises.length === 0) {
            history.splice(historyIndex, 1);
        }
        
        saveData("gymLogHistory_v2", history);
        state.history = history;
        recalculatePRs(exercise.name);
        
        loadHistory();
    }
}


// --- PR Management ---
export function checkAndSavePR(exerciseName, weight, reps) {
    if (!state.personalRecords[exerciseName]) {
        state.personalRecords[exerciseName] = { maxWeight: 0, repPRs: {} };
    }
    const prData = state.personalRecords[exerciseName];
    let message = '';
    let newWeightPR = false, newRepPR = false;

    if (weight > prData.maxWeight) {
        newWeightPR = true;
        prData.maxWeight = weight;
        message += `⭐ น้ำหนักสูงสุดใหม่: ${weight}kg! `;
        state.currentSessionPRs.push({ type: 'weight', exercise: exerciseName, weight });
    }
    if (!prData.repPRs[weight] || reps > prData.repPRs[weight]) {
        newRepPR = true;
        prData.repPRs[weight] = reps;
        message += `⭐ สถิติใหม่ที่ ${weight}kg: ${reps} ครั้ง!`;
        state.currentSessionPRs.push({ type: 'reps', exercise: exerciseName, weight, reps });
    }

    if (newWeightPR || newRepPR) {
        saveData("gymLogPRs_v4", state.personalRecords);
        // --- BUG FIX: ลบการเรียกใช้ renderPRsPage() ---
    }
    return message || null;
}

export function recalculatePRs(exerciseName) {
    const history = state.history;
    const newPRData = { maxWeight: 0, repPRs: {} };
    
    history.forEach(entry => {
        entry.exercises.forEach(ex => {
            if (ex.name === exerciseName && ex.type !== 'cardio') {
                ex.sets.forEach(set => {
                    if (set.weight > newPRData.maxWeight) newPRData.maxWeight = set.weight;
                    if (!newPRData.repPRs[set.weight] || set.reps > newPRData.repPRs[set.weight]) {
                        newPRData.repPRs[set.weight] = set.reps;
                    }
                });
            }
        });
    });

    if (newPRData.maxWeight > 0 || Object.keys(newPRData.repPRs).length > 0) {
        state.personalRecords[exerciseName] = newPRData;
    } else {
        delete state.personalRecords[exerciseName];
    }
    saveData("gymLogPRs_v4", state.personalRecords);
}


// --- Timers ---
export function startWorkoutTimer() {
    if (!state.settings.useTotalDurationTimer) return;
    if (state.workoutStartTime) return;

    state.workoutStartTime = Date.now();
    const display = document.getElementById("total-duration-display");
    if (!display) return;
    
    display.style.display = 'inline-block';
    state.workoutTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.workoutStartTime) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor(elapsed % 3600 / 60).toString().padStart(2, '0');
        const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
        display.textContent = `${h}:${m}:${s}`;
    }, 1000);
}

export function stopWorkoutTimer() {
    clearInterval(state.workoutTimerInterval);
    state.workoutStartTime = null;
    const display = document.getElementById("total-duration-display");
    if (display) {
        display.textContent = "";
        display.style.display = 'none';
    }
}

export function startTimer() {
    if (!state.settings.useRestTimer) return;

    if (state.audioContext && state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    vibrate();
    clearInterval(state.timerInterval);
    state.timeRemaining = DEFAULT_REST_TIME;
    DOM.restTimer.classList.remove('hidden');
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        if (state.timeRemaining <= 0) {
            stopTimer();
            playBeep();
        }
    }, 1000);
}

export function stopTimer() {
    clearInterval(state.timerInterval);
    DOM.restTimer.classList.add('hidden');
}

export function adjustTimer(seconds) {
    state.timeRemaining += seconds;
    if (state.timeRemaining < 0) state.timeRemaining = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    document.getElementById("timer-display").textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function playBeep() {
    if (!state.audioContext) return;
    const oscillator = state.audioContext.createOscillator();
    const gainNode = state.audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(state.audioContext.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, state.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.5, state.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 1);
    oscillator.start(state.audioContext.currentTime);
    oscillator.stop(state.audioContext.currentTime + 0.5);
}


// --- Settings & Body Stats ---
export function saveEquipmentSettings() {
    const barbellWeight = parseFloat(DOM.equipmentBarbellWeight.value);
    const plates = DOM.equipmentPlates.value.split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n) && n > 0)
        .sort((a, b) => b - a);

    if (isNaN(barbellWeight) || barbellWeight < 0) {
        showAlert("กรุณากรอกน้ำหนักแกนให้ถูกต้อง", "ข้อมูลไม่ถูกต้อง");
        return;
    }
    if (plates.length === 0) {
        showAlert("กรุณากรอกแผ่นน้ำหนักอย่างน้อย 1 ขนาด", "ข้อมูลไม่ถูกต้อง");
        return;
    }
    state.userEquipment = { barbellWeight, availablePlates: plates };
    saveData('gymUserEquipment', state.userEquipment);
    showAlert('บันทึกข้อมูลอุปกรณ์สำเร็จ!');
}

export function saveBodyStats() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const newStat = { date: todayStr };
    let hasData = false;
    
    Object.keys(bodyStatMetrics).forEach(metric => {
        const input = document.getElementById(`stat-${metric}`);
        if (input.value) {
            const parsedValue = parseFloat(input.value);
            if (!isNaN(parsedValue)) {
                newStat[metric] = parsedValue;
                hasData = true;
                input.value = "";
            } else {
                showAlert(`ค่าสำหรับ "${bodyStatMetrics[metric]}" ไม่ถูกต้อง`, "ข้อมูลผิดพลาด");
                input.value = "";
            }
        }
    });

    if (hasData) {
        let existingIndex = state.bodyStats.findIndex(stat => stat.date === todayStr);
        if (existingIndex > -1) {
            state.bodyStats[existingIndex] = { ...state.bodyStats[existingIndex], ...newStat };
        } else {
            state.bodyStats.push(newStat);
        }
        state.bodyStats.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveData("gymBodyStats", state.bodyStats);
        // --- BUG FIX: ลบการเรียกใช้ renderBodyStatsPage() ---
        showAlert("บันทึกข้อมูลร่างกายแล้ว!");
        return true; // คืนค่า true เพื่อให้ handler รู้ว่าต้องวาดหน้าจอใหม่
    }
    return false;
}

export async function deleteBodyStatEntry(dateToDelete) {
    const date = new Date(dateToDelete);
    const dateString = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const confirmed = await showConfirm(`คุณแน่ใจหรือไม่ที่จะลบข้อมูลสถิติของวันที่ ${dateString}?`);
    
    if (confirmed) {
        state.bodyStats = state.bodyStats.filter(stat => stat.date !== dateToDelete);
        saveData("gymBodyStats", state.bodyStats);
        // --- BUG FIX: ลบการเรียกใช้ renderBodyStatsPage() ---
        return true; // คืนค่า true เพื่อให้ handler รู้ว่าต้องวาดหน้าจอใหม่
    }
    return false;
}
