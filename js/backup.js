// js/backup.js
// จัดการ Logic ทั้งหมดที่เกี่ยวข้องกับการสำรองและกู้คืนข้อมูล

import { loadData, saveData } from './storage.js';
import { state, loadAllDataIntoState } from './state.js';
import { showAlert, showConfirm } from './modal.js';
import { runDataMigrations } from './logic.js';
import * as chartLogics from './charts.js';

// --- REFACTORED: Import specific functions from new UI modules ---
import { showPage } from './ui-core.js';
import { renderPlanListView } from './ui-plans.js';
import { setupTodayWorkout } from './ui-workout.js';
import { renderAutoBackupList, renderPRsPage } from './ui-shared.js';
import { loadHistory } from './ui-history.js';


// --- Internal Helper Functions ---

function getAllDataForBackup() {
    return {
        history: loadData('gymLogHistory_v2', []),
        prs: loadData('gymLogPRs_v4', {}),
        plans: loadData('gymWorkoutPlans_v3', []),
        body: loadData('gymBodyStats', []),
        equipment: loadData('gymUserEquipment', {}),
        suggestions: loadData('gymLogSuggestions', {})
    };
}

// --- DEFINITIVE FIX for Import Bug ---
// Refactored to perform a "Soft Reload" by re-initializing state and re-rendering all UI components
// This avoids browser-blocked hard reloads and provides a smoother user experience.
async function restoreAllData(backupObj) {
    let restoredSomething = false;
    if (backupObj.history) { saveData('gymLogHistory_v2', backupObj.history); restoredSomething = true; }
    if (backupObj.plans) { saveData('gymWorkoutPlans_v3', backupObj.plans); restoredSomething = true; }
    if (backupObj.body) { saveData('gymBodyStats', backupObj.body); restoredSomething = true; }
    if (backupObj.equipment) { saveData('gymUserEquipment', backupObj.equipment); restoredSomething = true; }
    if (backupObj.suggestions) { saveData('gymLogSuggestions', backupObj.suggestions); restoredSomething = true; }
    if (backupObj.prs) { saveData('gymLogPRs_v4', backupObj.prs); restoredSomething = true; }
    
    if (restoredSomething) {
        // 1. Run migrations on the newly saved data.
        runDataMigrations(true); 
        
        // 2. Force the application's state to be reloaded from storage.
        loadAllDataIntoState();
        
        // 3. Re-render all major UI components with the new state.
        setupTodayWorkout();
        renderPlanListView();
        renderPRsPage();
        renderAutoBackupList();
        chartLogics.updateChartDefaults();
        
        // 4. Show a success message.
        await showAlert('นำเข้าข้อมูลสำเร็จ!');
        
        // 5. Navigate to the history page to show the user the imported data immediately.
        showPage('history');
        loadHistory(); // Explicitly call loadHistory to render the calendar and entries.

    } else {
        showAlert('รูปแบบไฟล์สำรองไม่ถูกต้อง', 'ข้อผิดพลาด');
    }
}

function createAutoBackup() {
    let backups = loadData('gymAutoBackups', []);
    const backupData = getAllDataForBackup();

    if (backupData.history.length === 0 && backupData.plans.length === 0) {
        console.log("Skipping auto-backup: No data to back up.");
        return;
    }

    const newBackup = {
        timestamp: new Date().toISOString(),
        data: backupData
    };

    backups.unshift(newBackup);
    backups = backups.slice(0, 5); 

    saveData('gymAutoBackups', backups);
    console.log("Automatic backup created.", newBackup);
}


// --- Exported Functions ---

export function backupDataToFile() {
    const backupObj = {
        version: 4,
        ...getAllDataForBackup()
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
    showAlert('กำลังดาวน์โหลดไฟล์สำรองข้อมูล...');
}

export function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const confirmed = await showConfirm("คุณแน่ใจหรือไม่ที่จะนำเข้าข้อมูลจากไฟล์? ข้อมูลปัจจุบันทั้งหมดจะถูกเขียนทับ!", "คำเตือน");
        if (confirmed) {
            try {
                const backupObj = JSON.parse(e.target.result);
                await restoreAllData(backupObj); // Make sure to await the async function
            } catch (err) {
                showAlert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล! ไฟล์อาจเสียหายหรือไม่ถูกต้อง', 'ข้อผิดพลาด');
                console.error("Restore error: ", err);
            }
        }
    };
    reader.onerror = () => showAlert('เกิดข้อผิดพลาดในการอ่านไฟล์', 'ข้อผิดพลาด');
    reader.readAsText(file);
    event.target.value = '';
}

export function manageAutoBackups() {
    const lastBackupDate = loadData('gymLastAutoBackupDate', null);
    const today = new Date().toISOString().slice(0, 10);

    if (lastBackupDate !== today) {
        createAutoBackup();
        saveData('gymLastAutoBackupDate', today);
    }
}

export async function restoreFromAutoBackup(timestamp) {
    const confirmed = await showConfirm("คุณแน่ใจหรือไม่ที่จะกู้คืนข้อมูลจากจุดสำรองนี้? ข้อมูลปัจจุบันจะถูกเขียนทับ", "ยืนยันการกู้คืน");
    if (confirmed) {
        const backups = loadData('gymAutoBackups', []);
        const backupToRestore = backups.find(b => b.timestamp === timestamp);
        if (backupToRestore) {
            await restoreAllData(backupToRestore.data); // Make sure to await the async function
        } else {
            showAlert("ไม่พบข้อมูลสำรองที่เลือก", "ข้อผิดพลาด");
        }
    }
}

export async function deleteAutoBackup(timestamp) {
    const confirmed = await showConfirm("คุณแน่ใจหรือไม่ที่จะลบจุดสำรองข้อมูลนี้?", "ยืนยันการลบ");
    if (confirmed) {
        let backups = loadData('gymAutoBackups', []);
        backups = backups.filter(b => b.timestamp !== timestamp);
        saveData('gymAutoBackups', backups);
        renderAutoBackupList();
    }
}
