// js/storage.js
// Abstraction Layer สำหรับจัดการการบันทึกและโหลดข้อมูลจาก Local Storage
// ทำให้ง่ายต่อการเปลี่ยนไปใช้ฐานข้อมูลอื่นในอนาคต

/**
 * บันทึกข้อมูลลง localStorage (แปลงเป็น JSON)
 * @param {string} key - Key ที่จะใช้บันทึก
 * @param {any} value - Value ที่จะบันทึก
 * @returns {boolean} - คืนค่า true หากบันทึกสำเร็จ, false หากล้มเหลว
 */
export function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true; // คืนค่า true เมื่อสำเร็จ
    } catch (e) {
        console.error(`Failed to save data for key "${key}":`, e);
        // คืนค่า false เพื่อให้โค้ดที่เรียกใช้สามารถจัดการข้อผิดพลาดได้ (เช่น แสดง Alert)
        return false; // คืนค่า false เมื่อล้มเหลว
    }
}

/**
 * โหลดข้อมูลจาก localStorage
 * @param {string} key - Key ที่จะใช้โหลด
 * @param {any} [defaultValue={}] - ค่าเริ่มต้นหากไม่พบข้อมูล
 * @returns {any} - ข้อมูลที่โหลดมา หรือค่า defaultValue
 */
export function loadData(key, defaultValue = {}) {
    try {
        const data = localStorage.getItem(key);
        // หาก data เป็น null หรือ undefined ให้ return defaultValue
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error(`Failed to load data for key "${key}":`, e);
        return defaultValue;
    }
}
