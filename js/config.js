// js/config.js
// เก็บค่าคงที่และข้อมูลตั้งต้นทั้งหมดของแอป เพื่อให้จัดการง่ายในที่เดียว

export const DEFAULT_REST_TIME = 90;

export const muscleGroups = {
    'Chest': 'อก',
    'Back': 'หลัง',
    'Legs': 'ขา',
    'Shoulders': 'ไหล่',
    'Arms': 'แขน',
    'Core': 'แกนกลางลำตัว',
    'Other': 'อื่นๆ',
    'Cardio': 'คาร์ดิโอ'
};

// --- REVISED: Functional Muscle Group Colors ---
export const muscleGroupColors = {
    'Chest': '#ef4444',      // Red
    'Back': '#3b82f6',       // Blue
    'Legs': '#22c55e',       // Green
    'Shoulders': '#f97316',  // Orange
    'Arms': '#a855f7',       // Purple
    'Core': '#eab308',       // Yellow
    'Other': '#6b7280',      // Gray
    'Cardio': '#14b8a6'      // Teal
};

export const bodyStatMetrics = {
    weight: "น้ำหนักตัว (kg)",
    bf: "% ไขมัน",
    chest: "รอบอก (cm)",
    waist: "รอบเอว (cm)",
    arm: "รอบแขน (cm)"
};

export const cardioTypes = ['วิ่ง', 'เดินเร็ว', 'ปั่นจักรยาน', 'ว่ายน้ำ', 'Elliptical', 'Stair Climber', 'อื่นๆ'];

export const defaultPlan = [{
    name: "โปรแกรมเริ่มต้น 4 วัน/สัปดาห์",
    active: true,
    days: [{
        name: "Upper A (จันทร์)",
        exercises: [{ name: "Incline Dumbbell Press", muscleGroup: "Chest" }, { name: "One-arm Dumbbell Row", muscleGroup: "Back" }, { name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders" }, { name: "Dumbbell Curl", muscleGroup: "Arms" }, { name: "Overhead Triceps Extension", muscleGroup: "Arms" }]
    }, {
        name: "Lower A (อังคาร)",
        exercises: [{ name: "Goblet Squat", muscleGroup: "Legs" }, { name: "Dumbbell Romanian Deadlift (RDL)", muscleGroup: "Legs" }, { name: "Hip Thrust", muscleGroup: "Legs" }, { name: "Calf Raise", muscleGroup: "Legs" }]
    }, {
        name: "พัก (พุธ)",
        exercises: []
    }, {
        name: "Upper B (พฤหัสฯ)",
        exercises: [{ name: "Flat Dumbbell Press", muscleGroup: "Chest" }, { name: "Pull-up / Band Pull-down", muscleGroup: "Back" }, { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders" }, { name: "Dumbbell Hammer Curl", muscleGroup: "Arms" }, 
        // --- BUG FIX: เปลี่ยน muscleGroup ของ Bench Dips ให้ถูกต้อง ---
        { name: "Bench Dips", muscleGroup: "Chest" }]
    }, {
        name: "Lower B (ศุกร์)",
        exercises: [{ name: "Bulgarian Split Squat", muscleGroup: "Legs" }, { name: "Sumo Goblet Squat", muscleGroup: "Legs" }, { name: "Dumbbell Step-up", muscleGroup: "Legs" }, { name: "Standing Calf Raise", muscleGroup: "Legs" }]
    }, {
        name: "พัก (เสาร์)",
        exercises: []
    }, {
        name: "พัก (อาทิตย์)",
        exercises: []
    }]
}];
