// js/modal.js
// จัดการระบบ Custom Modal ทั้งหมด (Alert, Confirm, Prompt)

import { DOM } from './dom.js';

/**
 * แสดง Modal หลัก
 * @param {string} title - หัวข้อ Modal
 * @param {string} message - ข้อความใน Modal
 * @param {Array<Object>} buttons - อาร์เรย์ของปุ่ม
 * @param {Object|null} input - การตั้งค่าสำหรับ input field (ถ้ามี)
 */
function showAppModal(title, message, buttons, input = null) {
    DOM.appModalTitle.textContent = title;
    // --- SECURITY FIX: เปลี่ยนจาก innerHTML เป็น textContent เพื่อป้องกัน XSS ---
    // การเปลี่ยนแปลงนี้จะป้องกันการใส่โค้ด HTML ที่เป็นอันตราย
    // แต่จะทำให้ไม่สามารถใช้ tag เช่น <br> ในข้อความได้ โดยจะแสดงเป็นตัวอักษรธรรมดาแทน
    DOM.appModalMessage.textContent = message;
    DOM.appModalButtons.innerHTML = '';
    DOM.appModalInputContainer.innerHTML = '';

    if (input) {
        DOM.appModalInputContainer.innerHTML = `<input type="text" id="app-modal-input" class="text-input" placeholder="${input.placeholder || ''}" value="${input.value || ''}">`;
    }

    buttons.forEach(btn => {
        const buttonEl = document.createElement('button');
        buttonEl.textContent = btn.text;
        buttonEl.className = `action-btn ${btn.class}`;
        buttonEl.addEventListener('click', () => {
            const inputValue = input ? document.getElementById('app-modal-input').value : null;
            hideAppModal();
            if (btn.resolveFn) {
                btn.resolveFn(inputValue);
            }
        }, { once: true }); // event listener จะทำงานแค่ครั้งเดียว
        DOM.appModalButtons.appendChild(buttonEl);
    });

    DOM.appModal.classList.remove('hidden');
    setTimeout(() => DOM.appModal.classList.add('visible'), 10); // หน่วงเวลาเล็กน้อยเพื่อให้ animation ทำงาน
    if (input) {
        document.getElementById('app-modal-input').focus();
    }
}

/**
 * ซ่อน Modal หลัก
 */
function hideAppModal() {
    DOM.appModal.classList.remove('visible');
    setTimeout(() => DOM.appModal.classList.add('hidden'), 300); // รอ animation จบก่อนซ่อน
}

/**
 * แสดง Alert Modal
 * @param {string} message - ข้อความ
 * @param {string} [title='แจ้งเตือน'] - หัวข้อ
 */
export function showAlert(message, title = 'แจ้งเตือน') {
    return new Promise((resolve) => {
        showAppModal(title, message, [{
            text: 'ตกลง',
            class: 'primary',
            resolveFn: resolve
        }]);
    });
}

/**
 * แสดง Confirm Modal
 * @param {string} message - ข้อความคำถาม
 * @param {string} [title='ยืนยัน'] - หัวข้อ
 * @returns {Promise<boolean>} - คืนค่า true ถ้ากดยืนยัน, false ถ้ากดยกเลิก
 */
export function showConfirm(message, title = 'ยืนยัน') {
    return new Promise((resolve) => {
        showAppModal(title, message, [{
            text: 'ยกเลิก',
            class: 'neutral',
            resolveFn: () => resolve(false)
        }, {
            text: 'ยืนยัน',
            class: 'danger',
            resolveFn: () => resolve(true)
        }]);
    });
}

/**
 * แสดง Prompt Modal
 * @param {string} message - ข้อความ
 * @param {string} [title='กรอกข้อมูล'] - หัวข้อ
 * @param {string} [defaultValue=''] - ค่าเริ่มต้นในช่อง input
 * @returns {Promise<string|null>} - คืนค่าที่ผู้ใช้กรอก, หรือ null ถ้ากดยกเลิก
 */
export function showPrompt(message, title = 'กรอกข้อมูล', defaultValue = '') {
    return new Promise((resolve) => {
        showAppModal(title, message, [{
            text: 'ยกเลิก',
            class: 'neutral',
            resolveFn: () => resolve(null)
        }, {
            text: 'ตกลง',
            class: 'success',
            resolveFn: (value) => resolve(value)
        }], {
            value: defaultValue
        });
    });
}

/**
 * ปิด Modal แบบเก่า (สำหรับ modal ที่ยังไม่ได้แปลง)
 * @param {string} modalId 
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}
