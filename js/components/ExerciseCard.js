// js/components/ExerciseCard.js

// --- คอมโพเนนต์สำหรับสร้าง "การ์ดออกกำลังกาย" ---
// ไฟล์นี้ทำหน้าที่เป็น "พิมพ์เขียว" สำหรับสร้าง UI ของการ์ดแต่ละใบในหน้าออกกำลังกาย
// การแยกโค้ดส่วนนี้ออกมาเป็นคอมโพเนนต์โดยเฉพาะ จะช่วยให้โค้ดโดยรวมจัดการได้ง่ายขึ้นและแข็งแรงขึ้น

import { state } from '../state.js';
import * as coach from '../coach.js';
import { saveData } from '../storage.js';
import { createElement } from '../ui-core.js';

/**
 * สร้างและคืนค่า Element ของการ์ดออกกำลังกาย (Exercise Card)
 * @param {object} ex - ข้อมูลท่าออกกำลังกายจากตารางฝึก
 * @returns {HTMLElement} - Element ของการ์ดที่สร้างเสร็จสมบูรณ์
 */
export function createExerciseCard(ex) {
    const exName = ex.name;
    const isBodyweight = ex.isBodyweight || false;
    
    // --- ดึงข้อมูลคำแนะนำและประวัติล่าสุด ---
    let suggestion = coach.getProgressionSuggestion(exName);
    let coachSuggestionNote = null;

    if (state.nextSessionSuggestions[exName]) {
        suggestion = { suggestedWeight: state.nextSessionSuggestions[exName] };
        coachSuggestionNote = createElement('span', {
            classes: ['coach-suggestion-text'],
            // --- BUG FIX: เปลี่ยน text เป็น textContent ---
            textContent: `โค้ชแนะนำให้เริ่มที่ ${state.nextSessionSuggestions[exName]}kg!`
        });
        delete state.nextSessionSuggestions[exName];
        saveData('gymLogSuggestions', state.nextSessionSuggestions);
    }

    let lastSessionData = "ครั้งล่าสุด: -";
    const lastEntry = state.history.find(entry => entry.exercises.some(e => e.name === exName));
    if (lastEntry) {
        const lastEx = lastEntry.exercises.find(e => e.name === exName);
        if (lastEx && lastEx.sets.length > 0) {
            const topSet = lastEx.sets.reduce((a, b) => (a.weight >= b.weight ? a : b));
            if (isBodyweight) {
                 lastSessionData = `ครั้งล่าสุด: ${topSet.reps} reps ${topSet.weight !== 0 ? `(${topSet.weight > 0 ? '+' : ''}${topSet.weight}kg)` : ''}`;
            } else {
                 lastSessionData = `ครั้งล่าสุด: ${topSet.weight}kg x ${topSet.reps} reps`;
            }
        }
    }

    // --- สร้าง Element ต่างๆ ของการ์ด ---
    const uniqueId = `card-${exName.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const quickNotes = ['รู้สึกดี', 'ฟอร์มดี', 'หนักไป', 'เบาไป', 'ปวดข้อ', 'เพิ่มน้ำหนักครั้งหน้า'];
    
    const weightInput = createElement('input', { id: `weight-${uniqueId}`, type: 'tel', classes: ['text-input'] });
    const repsInput = createElement('input', { id: `reps-${uniqueId}`, type: 'tel', placeholder: 'ครั้ง', classes: ['text-input'] });

    const weightGroup = createElement('div', {
        classes: ['control-group'],
        children: [
            createElement('button', { classes: ['util-btn'], datasets: { adjust: '-1.25' }, innerHTML: '<i data-feather="minus"></i>' }),
            weightInput,
            createElement('button', { classes: ['util-btn'], datasets: { adjust: '1.25' }, innerHTML: '<i data-feather="plus"></i>' })
        ]
    });

    const repsGroup = createElement('div', {
        classes: ['control-group'],
        children: [
            createElement('button', { classes: ['util-btn'], datasets: { adjustReps: '-1' }, innerHTML: '<i data-feather="minus"></i>' }),
            repsInput,
            createElement('button', { classes: ['util-btn'], datasets: { adjustReps: '1' }, innerHTML: '<i data-feather="plus"></i>' })
        ]
    });

    if (isBodyweight) {
        weightInput.placeholder = "+/- kg (ไม่บังคับ)";
        repsInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                weightInput.focus();
            }
        });
    } else {
        weightInput.placeholder = "kg";
        weightInput.value = suggestion ? suggestion.suggestedWeight : "";
        weightInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                repsInput.focus();
            }
        });
    }

    const rpeSelect = createElement('select', { id: `rpe-${uniqueId}`, classes: ['rpe-select'] });
    rpeSelect.innerHTML = `<option value="">RPE</option>${[10,9,8,7,6,5,4,3,2,1].map(v => `<option value="${v}">${v}</option>`).join('')}`;

    const card = createElement('div', {
        id: uniqueId,
        classes: ['card', 'exercise-card'],
        datasets: { exerciseName: exName, logKey: exName },
        children: [
            createElement('div', {
                classes: ['ex-header'],
                children: [
                    createElement('div', {
                        classes: ['ex-title-container'],
                        children: [
                            createElement('div', { classes: ['pr-star'], innerHTML: '<i data-feather="star" class="feather" style="fill: var(--pr-color);"></i>' }),
                            // --- BUG FIX: เปลี่ยน text เป็น textContent ---
                            createElement('div', { classes: ['exercise-title'], textContent: exName })
                        ]
                    }),
                    createElement('div', { classes: ['btn-group'], children: [createElement('input', { type: 'checkbox' })] })
                ]
            }),
            // --- BUG FIX: เปลี่ยน text เป็น textContent ---
            createElement('div', { classes: ['exercise-notes'], textContent: lastSessionData }),
            ...(coachSuggestionNote ? [coachSuggestionNote] : []),
            
            createElement('div', { id: `logged-sets-${uniqueId}`, classes: ['mb-15'] }),
            createElement('div', { id: `feedback-${uniqueId}`, classes: ['feedback-container'] }),
            
            createElement('div', {
                classes: ['log-input-container'],
                children: [
                    isBodyweight ? repsGroup : weightGroup,
                    isBodyweight ? weightGroup : repsGroup,
                    createElement('div', { classes: ['secondary-controls'], children: [
                        rpeSelect,
                        createElement('button', { classes: ['util-btn'], datasets: { action: 'plate-calculator' }, innerHTML: '⚖️', style: isBodyweight ? 'display:none;' : '' })
                    ]})
                ]
            }),
            
            createElement('div', {
                classes: ['split-button-container'],
                children: [
                    createElement('button', { classes: ['split-button-main'], innerHTML: '<i data-feather="plus-circle"></i><span>บันทึกเซ็ต & เริ่มพัก</span>' }),
                    createElement('button', { classes: ['split-button-repeat'], datasets: { title: 'ทำซ้ำเซ็ตล่าสุด' }, innerHTML: '<i data-feather="repeat"></i>' })
                ]
            }),
            
            createElement('textarea', { id: `notes-${uniqueId}`, classes: ['notes-input'], placeholder: 'จดบันทึกเกี่ยวกับท่านี้...' }),
            createElement('div', {
                classes: ['quick-note-tags'],
                // --- BUG FIX: เปลี่ยน text เป็น textContent ---
                children: quickNotes.map(note => createElement('button', { classes: ['quick-note-btn'], textContent: `+ ${note}`, datasets: { note } }))
            })
        ]
    });
    
    if (state.personalRecords[exName] && state.personalRecords[exName].maxWeight > 0) {
        const star = card.querySelector('.pr-star');
        if (star) star.style.display = "inline";
    }

    return card;
}
