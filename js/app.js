// js/app.js
// นี่คือไฟล์เริ่มต้น (Entry Point) ของแอปพลิเคชัน
// ทำหน้าที่นำเข้า (import) โมดูลต่างๆ และเริ่มต้นการทำงานของแอป

import { state, loadAllDataIntoState } from './state.js';
import { setupEventListeners } from './handlers.js';
import { runDataMigrations } from './logic.js';
import { manageAutoBackups } from './backup.js';
import { updateChartDefaults } from './charts.js';

// --- REFACTORED: Import from new UI modules ---
import { applyTheme } from './ui-core.js';
import { setupTodayWorkout } from './ui-workout.js';
import { renderPlanListView } from './ui-plans.js';
import { populateMuscleGroupSelects } from './ui-shared.js';

/**
 * ลงทะเบียน Service Worker เพื่อเปิดใช้งานฟังก์ชัน PWA (Progressive Web App)
 * เช่น การทำงานแบบออฟไลน์ และการติดตั้งลงบนหน้าจอหลัก
 */
function registerServiceWorker() {
    // ตรวจสอบว่าเบราว์เซอร์รองรับ Service Worker หรือไม่
    if ('serviceWorker' in navigator) {
        // รอให้หน้าเว็บโหลดเสร็จสมบูรณ์ก่อนที่จะลงทะเบียน
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('PWA Service Worker registered successfully:', registration);
                })
                .catch(registrationError => {
                    console.error('PWA Service Worker registration failed:', registrationError);
                });
        });
    } else {
        console.log('Service Worker is not supported in this browser.');
    }
}


/**
 * ฟังก์ชันหลักในการเริ่มต้นแอปพลิเคชันทั้งหมด
 */
function initialize() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.");
    }

    runDataMigrations();
    loadAllDataIntoState();
    manageAutoBackups();
    
    // Initialize UI
    renderPlanListView();
    setupTodayWorkout();
    applyTheme();
    updateChartDefaults();
    populateMuscleGroupSelects();
    
    if (window.feather) {
        window.feather.replace();
    }
    
    setupEventListeners();

    // --- เปิดใช้งาน PWA โดยการลงทะเบียน Service Worker ---
    registerServiceWorker();

    console.log("Gym-Log Pro Initialized (PWA Enabled)");
}

document.addEventListener('DOMContentLoaded', initialize);
