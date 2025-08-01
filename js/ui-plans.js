// js/ui-plans.js
// Manages all UI rendering for the Workout Plans page.

import { DOM } from './dom.js';
import { state } from './state.js';
import { muscleGroups } from './config.js';
import { createElement } from './ui-core.js';

/**
 * แสดงผลหน้าหลักของ "จัดการตารางฝึก"
 */
export function renderPlanListView() {
    DOM.planEditorView.innerHTML = '';
    DOM.planEditorView.appendChild(createElement('h2', { textContent: 'จัดการตารางฝึก' }));

    const planListDiv = createElement('div', { classes: ['plan-list'] });
    state.workoutPlans.forEach((plan, planIndex) => {
        const dayItems = plan.days.map((day, dayIndex) =>
            createElement('div', {
                classes: ['list-item'],
                children: [
                    createElement('span', { children: [
                        createElement('strong', { textContent: day.name }),
                        createElement('span', { textContent: ` (${day.exercises.length} ท่า)` })
                    ]}),
                    createElement('div', {
                        classes: ['btn-group'],
                        children: [
                            createElement('button', {
                                datasets: { action: 'edit-day', planIndex, dayIndex },
                                innerHTML: '<i data-feather="edit-2"></i>'
                            })
                        ]
                    })
                ]
            })
        );

        const btnGroup = createElement('div', {
            classes: ['plan-actions'],
            children: [
                ...(plan.active ? [] : [createElement('button', {
                    classes: ['action-btn', 'success'],
                    textContent: 'เลือกใช้',
                    datasets: { action: 'set-active-plan', planIndex }
                })]),
                createElement('button', {
                    classes: ['action-btn', 'neutral'],
                    textContent: 'เปลี่ยนชื่อ',
                    datasets: { action: 'rename-plan', planIndex }
                }),
                createElement('button', {
                    classes: ['action-btn', 'danger'],
                    datasets: { action: 'delete-plan', planIndex },
                    innerHTML: '<i data-feather="trash-2"></i> ลบ'
                })
            ]
        });

        const card = createElement('div', {
            classes: ['card'],
            children: [
                createElement('h3', { textContent: `${plan.name} ${plan.active ? "(ใช้งานอยู่)" : ""}` }),
                ...dayItems,
                btnGroup
            ]
        });
        planListDiv.appendChild(card);
    });

    DOM.planEditorView.appendChild(planListDiv);
    DOM.planEditorView.appendChild(createElement('button', {
        classes: ['action-btn', 'primary'],
        datasets: { action: 'create-plan' },
        innerHTML: '<i data-feather="plus-circle"></i>สร้างโปรแกรมใหม่'
    }));
    if (window.feather) window.feather.replace();
}

/**
 * แสดงผลหน้าแก้ไขโปรแกรมรายวัน
 * @param {number} planIndex 
 * @param {number} dayIndex 
 */
export function renderDayEditorView(planIndex, dayIndex) {
    const day = state.workoutPlans[planIndex].days[dayIndex];
    DOM.planEditorView.innerHTML = '';

    const header = createElement('h2', {
        children: [
            createElement('span', {
                classes: ['back-button'],
                datasets: { action: 'back-to-plans' },
                innerHTML: '<i data-feather="arrow-left"></i> กลับ'
            }),
            createElement('span', { textContent: day.name })
        ]
    });
    DOM.planEditorView.appendChild(header);

    const exerciseItems = day.exercises.map((ex, exIndex) =>
        createElement('div', {
            classes: ['list-item'],
            children: [
                createElement('span', { children: [
                    createElement('span', { textContent: `${ex.name} ` }),
                    ...(ex.isBodyweight ? [createElement('span', { textContent: 'บอดี้เวท', classes: ['tag-bodyweight'] })] : []),
                    createElement('em', { textContent: `(${muscleGroups[ex.muscleGroup] || 'N/A'})`, style: 'font-size:0.8em; opacity:0.7;' })
                ]}),
                createElement('div', {
                    classes: ['btn-group'],
                    children: [
                        createElement('button', { datasets: { action: 'move-exercise-up', planIndex, dayIndex, exIndex }, innerHTML: '<i data-feather="arrow-up"></i>', disabled: exIndex === 0 }),
                        createElement('button', { datasets: { action: 'move-exercise-down', planIndex, dayIndex, exIndex }, innerHTML: '<i data-feather="arrow-down"></i>', disabled: exIndex === day.exercises.length - 1 }),
                        createElement('button', { classes: ['btn-delete'], datasets: { action: 'delete-exercise', planIndex, dayIndex, exIndex }, innerHTML: '<i data-feather="trash-2"></i>' })
                    ]
                })
            ]
        })
    );

    // --- BUG FIX: ใช้ createElement เวอร์ชันอัปเกรดแล้วในการสร้างฟอร์ม ---
    const muscleGroupSelect = createElement('select', { 
        id: 'new-exercise-muscle-group',
        innerHTML: Object.keys(muscleGroups).map(key => `<option value="${key}">${muscleGroups[key]}</option>`).join('')
    });

    const addExerciseForm = createElement('div', {
        classes: ['add-exercise-form-container'],
        children: [
            createElement('div', {
                classes: ['add-exercise-form'],
                children: [
                    createElement('input', { 
                        type: 'text', 
                        id: 'new-exercise-name', 
                        placeholder: 'ชื่อท่าใหม่...' 
                    }),
                    muscleGroupSelect
                ]
            }),
            createElement('div', {
                classes: ['setting-item', 'mt-10'],
                style: 'padding-bottom: 0; border-bottom: none;',
                children: [
                    createElement('span', { textContent: 'โหมดบอดี้เวท' }),
                    createElement('label', { classes: ['toggle-switch'], children: [
                        createElement('input', { 
                            type: 'checkbox', 
                            id: 'new-exercise-bodyweight-toggle' 
                        }),
                        createElement('span', { classes: ['slider'] })
                    ]})
                ]
            }),
            createElement('button', {
                classes: ['action-btn', 'primary', 'mt-15'],
                datasets: { action: 'add-exercise', planIndex, dayIndex },
                innerHTML: '<i data-feather="plus-circle"></i> เพิ่มท่า'
            })
        ]
    });

    const cardContent = day.exercises.length > 0
        ? exerciseItems
        : [createElement('p', { textContent: 'ยังไม่มีท่าออกกำลังกายสำหรับวันนี้', style: 'text-align:center; opacity:0.7;' })];

    const card = createElement('div', {
        classes: ['card'],
        children: [...cardContent, addExerciseForm]
    });

    DOM.planEditorView.appendChild(card);
    if (window.feather) window.feather.replace();
}
