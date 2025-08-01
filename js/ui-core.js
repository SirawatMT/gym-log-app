// js/ui-core.js
// Contains core UI navigation, element creation, and theme management functions.

import { DOM } from './dom.js';
import { state } from './state.js';
import { saveData } from './storage.js';
// --- BUG FIX: ลบการ import ที่ทำให้เกิด Circular Dependency ---
// A ui-core file should not know about a specific feature like charts.

/**
 * สร้าง DOM element พร้อมกำหนดคุณสมบัติต่างๆ (Helper Function)
 * @param {string} tag - ชื่อแท็ก HTML (เช่น 'div', 'button')
 * @param {object} options - อ็อบเจกต์สำหรับกำหนดคุณสมบัติ
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const el = document.createElement(tag);

    for (const key in options) {
        const value = options[key];
        
        if (key === 'classes' && Array.isArray(value)) {
            el.classList.add(...value);
        } else if (key === 'datasets' && typeof value === 'object') {
            for (const dataKey in value) {
                el.dataset[dataKey] = value[dataKey];
            }
        } else if (key === 'children' && Array.isArray(value)) {
            value.forEach(child => el.appendChild(child));
        } 
        else {
            el[key] = value;
        }
    }
    return el;
}


/**
 * แสดงหน้าที่เลือกและซ่อนหน้าที่เหลือ (Page Navigator)
 * @param {string} pageName - ชื่อของ page ที่จะแสดง
 */
export function showPage(pageName) {
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === pageName);
        page.classList.toggle('hidden', page.id !== pageName);
    });
    DOM.tabButtons.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.page === pageName);
    });
}

/**
 * แสดง tab ย่อยในหน้า Analysis
 * @param {string} tabName - ชื่อของ tab ที่จะแสดง
 */
// --- BUG FIX: ลดความรับผิดชอบของฟังก์ชันนี้ลง ---
// ทำให้มันทำหน้าที่แค่แสดง/ซ่อน UI เท่านั้น ส่วนการวาดกราฟจะถูกย้ายไปที่ handlers.js
export function showAnalysisTab(tabName) {
    document.querySelectorAll('.analysis-sub-page').forEach(page => {
        page.classList.toggle('active', page.id === `analysis-${tabName}`);
        page.classList.toggle('hidden', page.id !== `analysis-${tabName}`);
    });
    document.querySelectorAll('.analysis-tab-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });
}

/**
 * 적용된 테마를 UI에 반영합니다.
 */
export function applyTheme() {
    const theme = state.theme || "dark";
    DOM.body.className = theme === "dark" ? "" : "light-mode";
}

/**
 * สลับระหว่าง Dark/Light theme
 */
export function toggleTheme() {
    const newTheme = DOM.body.classList.contains("light-mode") ? "dark" : "light";
    DOM.body.className = newTheme === "dark" ? "" : "light-mode";
    saveData("gymLogTheme", newTheme);
    state.theme = newTheme;
    // การอัปเดตกราฟจะถูกจัดการโดย handlers.js หลังจากนี้
}

/**
 * ดึงค่าสีต่างๆ จาก CSS variables ของ theme ปัจจุบัน
 * @returns {object} - อ็อบเจกต์ของสี
 */
export function getThemeColors() {
    const style = getComputedStyle(document.body);
    return {
        textColor: style.getPropertyValue('--text-color').trim(),
        textSecondaryColor: style.getPropertyValue('--text-secondary-color').trim(),
        borderColor: style.getPropertyValue('--border-color').trim(),
        primaryColor: style.getPropertyValue('--primary-color').trim(),
        successColor: style.getPropertyValue('--success-color').trim(),
        warningColor: style.getPropertyValue('--warning-color').trim(),
    };
}
