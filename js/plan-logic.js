// js/plan-logic.js
// รวม Logic ที่เกี่ยวข้องกับการจัดการตารางฝึก (Workout Plans)

import { state } from './state.js';
import { saveData } from './storage.js';
import { showPrompt, showConfirm, showAlert } from './modal.js';

// --- REFACTORED: Import from new UI modules ---
import { renderPlanListView, renderDayEditorView } from './ui-plans.js';
import { setupTodayWorkout } from './ui-workout.js';


export async function createNewPlan() {
    const name = await showPrompt("ตั้งชื่อโปรแกรมใหม่:", "โปรแกรมของฉัน");
    if (name) {
        state.workoutPlans.push({
            name: name,
            active: false,
            days: [
                { name: "วันจันทร์", exercises: [] }, { name: "วันอังคาร", exercises: [] },
                { name: "วันพุธ", exercises: [] }, { name: "วันพฤหัสบดี", exercises: [] },
                { name: "วันศุกร์", exercises: [] }, { name: "วันเสาร์", exercises: [] },
                { name: "วันอาทิตย์", exercises: [] }
            ]
        });
        saveData('gymWorkoutPlans_v3', state.workoutPlans);
        renderPlanListView();
    }
}

export async function renamePlan(planIndex) {
    const newName = await showPrompt("เปลี่ยนชื่อโปรแกรม:", state.workoutPlans[planIndex].name);
    if (newName) {
        state.workoutPlans[planIndex].name = newName;
        saveData('gymWorkoutPlans_v3', state.workoutPlans);
        renderPlanListView();
    }
}

export async function deletePlan(planIndex) {
    if (state.workoutPlans.length <= 1) {
        showAlert("ไม่สามารถลบได้ ต้องมีอย่างน้อย 1 โปรแกรม", "ข้อผิดพลาด");
        return;
    }
    const confirmed = await showConfirm(`คุณแน่ใจหรือไม่ที่จะลบโปรแกรม "${state.workoutPlans[planIndex].name}"?`);
    if (confirmed) {
        const wasActive = state.workoutPlans[planIndex].active;
        state.workoutPlans.splice(planIndex, 1);
        
        if (wasActive || state.workoutPlans.findIndex(p => p.active) === -1) {
            state.workoutPlans[0].active = true;
            state.activePlanIndex = 0;
        }

        saveData('gymWorkoutPlans_v3', state.workoutPlans);
        renderPlanListView();

        if (wasActive) {
            setupTodayWorkout();
        }
    }
}

export function setActivePlan(planIndex) {
    state.workoutPlans.forEach((p, i) => p.active = i === planIndex);
    state.activePlanIndex = planIndex;
    saveData('gymWorkoutPlans_v3', state.workoutPlans);
    renderPlanListView();
    setupTodayWorkout();
}

// --- MODIFICATION: อัปเดตฟังก์ชันให้รองรับโหมดบอดี้เวท ---
export function addExercise(planIndex, dayIndex) {
    const nameInput = document.getElementById("new-exercise-name");
    const groupSelect = document.getElementById("new-exercise-muscle-group");
    const bodyweightToggle = document.getElementById("new-exercise-bodyweight-toggle"); // อ่านค่าจากสวิตช์
    
    const newExName = nameInput.value.trim();
    const newExGroup = groupSelect.value;
    const isBodyweight = bodyweightToggle.checked; // ตรวจสอบสถานะของสวิตช์

    if (newExName) {
        // สร้าง object ท่าออกกำลังกายใหม่พร้อมข้อมูล isBodyweight
        const newExercise = { 
            name: newExName, 
            muscleGroup: newExGroup,
            isBodyweight: isBodyweight 
        };
        
        state.workoutPlans[planIndex].days[dayIndex].exercises.push(newExercise);
        saveData('gymWorkoutPlans_v3', state.workoutPlans);
        renderDayEditorView(planIndex, dayIndex); // วาดหน้าจอใหม่
    }
}

export async function deleteExercise(planIndex, dayIndex, exIndex) {
    const exName = state.workoutPlans[planIndex].days[dayIndex].exercises[exIndex].name;
    const confirmed = await showConfirm(`คุณแน่ใจหรือไม่ที่จะลบท่า "${exName}" ออกจากโปรแกรม?`);
    if (confirmed) {
        state.workoutPlans[planIndex].days[dayIndex].exercises.splice(exIndex, 1);
        saveData('gymWorkoutPlans_v3', state.workoutPlans);
        renderDayEditorView(planIndex, dayIndex);
    }
}

export function moveExercise(planIndex, dayIndex, exIndex, direction) {
    const exercises = state.workoutPlans[planIndex].days[dayIndex].exercises;
    const newIndex = exIndex + direction;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    [exercises[exIndex], exercises[newIndex]] = [exercises[newIndex], exercises[exIndex]]; // Swap elements
    saveData('gymWorkoutPlans_v3', state.workoutPlans);
    renderDayEditorView(planIndex, dayIndex);
}
