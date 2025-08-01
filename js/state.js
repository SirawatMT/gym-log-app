// js/state.js
// จัดการ State กลางของแอปพลิเคชันทั้งหมดในที่เดียว

import { defaultPlan } from './config.js';
import { loadData } from './storage.js';

// --- App State Object ---
// ใช้ object เดียวในการเก็บ state ทั้งหมดเพื่อให้จัดการและส่งต่อได้ง่าย
export let state = {
    workoutStartTime: null,
    workoutTimerInterval: null,
    currentWorkoutLog: {},
    personalRecords: {},
    history: [],
    bodyStats: [],
    nextSessionSuggestions: {},
    currentSessionPRs: [],
    timerInterval: null,
    timeRemaining: 0,
    audioContext: null,
    charts: {}, // To hold chart instances
    workoutPlans: [],
    activePlanIndex: 0,
    userEquipment: {
        barbellWeight: 20,
        availablePlates: [20, 15, 10, 5, 2.5, 1.25]
    },
    currentCalendarDate: new Date(),
    isWorkoutOverridden: false,
    coachSuggestions: [],
    
    // --- NEW FEATURE: Timer Settings ---
    // เพิ่ม object สำหรับเก็บการตั้งค่าต่างๆ ของผู้ใช้
    settings: {
        useTotalDurationTimer: true, // เปิด/ปิด การจับเวลาซ้อมรวม
        useRestTimer: true           // เปิด/ปิด การจับเวลาพักระหว่างเซ็ต
    }
};

/**
 * โหลดข้อมูลทั้งหมดจาก Storage มาใส่ใน State
 * จะถูกเรียกใช้ครั้งเดียวเมื่อแอปเริ่มทำงาน
 */
export function loadAllDataIntoState() {
    state.personalRecords = loadData('gymLogPRs_v4', {});
    state.history = loadData('gymLogHistory_v2', []);
    state.nextSessionSuggestions = loadData('gymLogSuggestions', {});
    const storedPlans = loadData('gymWorkoutPlans_v3', []);
    state.workoutPlans = storedPlans && storedPlans.length > 0 ? storedPlans : defaultPlan;
    state.userEquipment = loadData('gymUserEquipment', { barbellWeight: 20, availablePlates: [20, 15, 10, 5, 2.5, 1.25] });
    state.bodyStats = loadData('gymBodyStats', []);
    
    // --- NEW: โหลดการตั้งค่าตัวจับเวลา ---
    const storedSettings = loadData('gymAppSettings', {});
    state.settings = { ...state.settings, ...storedSettings }; // ผสานค่าที่โหลดมากับค่าเริ่มต้น

    state.activePlanIndex = state.workoutPlans.findIndex(p => p.active);
    if (state.activePlanIndex === -1) {
        state.activePlanIndex = 0;
        if (state.workoutPlans.length > 0) {
            state.workoutPlans[0].active = true;
        }
    }
}
