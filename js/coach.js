// js/coach.js
// รวม Logic ทั้งหมดที่เกี่ยวข้องกับระบบแนะนำอัตโนมัติ (Coach's Corner)

import { state } from './state.js';

// --- Exported Functions ---

/**
 * สร้างคำแนะนำทั้งหมดสำหรับเซสชันปัจจุบัน
 */
export function generateCoachSuggestions() {
    state.coachSuggestions = [];

    const deloadSuggestion = checkForDeloadSuggestion();
    if (deloadSuggestion) {
        state.coachSuggestions.push(deloadSuggestion);
    }

    const inactivityInfo = checkForInactivity();
    if (inactivityInfo) {
        state.coachSuggestions.push(inactivityInfo);
        return; 
    }

    const skippedDayInfo = checkForSkippedWorkouts();
    if (skippedDayInfo) {
        state.coachSuggestions.push(skippedDayInfo);
    }
}

/**
 * ตรวจสอบว่าผู้ใช้ข้ามวันฝึกไปหรือไม่
 * @returns {object|null} - อ็อบเจกต์ข้อมูลคำแนะนำ หรือ null
 */
export function checkForSkippedWorkouts() {
    const history = state.history;
    if (history.length === 0) return null;
    
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
            const skippedDay = state.workoutPlans[state.activePlanIndex].days[skippedDayIndex];
            if (skippedDay && skippedDay.exercises.length > 0) {
                return {
                    type: 'skipped',
                    data: {
                        skippedDayIndex: skippedDayIndex,
                        skippedDayName: skippedDay.name,
                        lastDayName: state.workoutPlans[state.activePlanIndex].days[lastDayIndex].name
                    }
                };
            }
        }
    }
    return null; 
}

/**
 * ตรวจสอบว่าผู้ใช้ไม่ได้ฝึกมานานเกินไปหรือไม่
 * @returns {object|null} - อ็อบเจกต์ข้อมูลคำแนะนำ หรือ null
 */
export function checkForInactivity() {
    const history = state.history;
    if (history.length === 0) return null;
    
    const lastEntry = history[0];
    const lastDate = new Date(lastEntry.isoDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 3) {
        return {
            type: 'inactivity',
            data: { days: diffDays }
        };
    }
    return null;
}

/**
 * ตรวจสอบว่าถึงเวลา Deload (พัก) หรือยัง
 * @returns {object|null} - อ็อบเจกต์ข้อมูลคำแนะนำ หรือ null
 */
export function checkForDeloadSuggestion() {
    const history = state.history;
    if (history.length < 12) return null;
    
    const mainLifts = new Set(state.workoutPlans[state.activePlanIndex].days.map(d => d.exercises[0]?.name).filter(Boolean));
    if (mainLifts.size === 0) return null;
    
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

    if (stallCount >= (mainLifts.size / 2)) {
        return { type: 'deload' };
    }
    return null;
}

/**
 * สร้างคำแนะนำสำหรับน้ำหนักที่ควรใช้ในท่าถัดไป
 * @param {string} exerciseName - ชื่อท่าออกกำลังกาย
 * @returns {object|null} - อ็อบเจกต์ข้อมูลคำแนะนำ หรือ null
 */
export function getProgressionSuggestion(exerciseName) {
    const history = state.history;
    const lastEntry = history.find(entry => entry.exercises.some(ex => ex.name === exerciseName));
    
    if (lastEntry) {
        const lastEx = lastEntry.exercises.find(ex => ex.name === exerciseName);
        if (lastEx && lastEx.sets.length > 0) {
            const topSet = lastEx.sets.reduce((a, b) => (a.weight >= b.weight ? a : b));

            const parsedRpe = parseInt(topSet.rpe);
            if (!isNaN(parsedRpe)) {
                if (topSet.reps >= 12 && parsedRpe <= 8) return { suggestedWeight: topSet.weight + 2.5 };
                if (topSet.reps < 8 && parsedRpe > 8) return { suggestedWeight: topSet.weight - 2.5 };
            }
            
            return { suggestedWeight: topSet.weight };
        }
    }
    return null;
}
