// --- Global Variables & Constants ---
// ... (เหมือนเดิมทุกประการ) ...

// --- Main Execution (Entry Point) ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
        console.error("Web Audio API not supported");
    }
    runDataMigrations();
    loadAllData();
    renderPlanListView();
    setupTodayWorkout();
    applyTheme();
    updateChartDefaults();
    populateMuscleGroupSelects();
    
    initializeEventListeners();
    
    feather.replace();
    registerServiceWorker(); 
});


// --- Function Definitions ---

function initializeEventListeners() {
    // --- Main Tab Navigation ---
    document.querySelectorAll('.tab-buttons .tab-button:not(.analysis-tab-btn)').forEach(button => {
        button.addEventListener('click', () => {
            const pageName = button.dataset.page;
            if (pageName) showPage(pageName);
        });
    });

    // --- Analysis Tab Navigation ---
    document.querySelectorAll('.analysis-tabs .analysis-tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            if(tabName) showAnalysisTab(tabName);
        });
    });

    // --- Settings Page ---
    document.getElementById('toggle-theme-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('save-equipment-btn')?.addEventListener('click', saveEquipmentSettings);
    document.getElementById('backup-btn')?.addEventListener('click', backupDataToFile);
    document.getElementById('restore-btn')?.addEventListener('click', () => document.getElementById('restore-file-input').click());
    document.getElementById('restore-file-input')?.addEventListener('change', handleRestoreFile);

    // --- Workout Page ---
    document.getElementById('quick-log-btn-top')?.addEventListener('click', toggleQuickLogMenu);
    document.getElementById('override-btn')?.addEventListener('click', showOverrideModal);
    document.getElementById('quick-log-weight-training-btn')?.addEventListener('click', openQuickLogForm);
    document.getElementById('quick-log-cardio-btn')?.addEventListener('click', openCardioLogForm);
    document.getElementById('cancel-quick-log-btn')?.addEventListener('click', hideQuickLogForm);
    document.getElementById('save-quick-log-btn')?.addEventListener('click', saveQuickLog);
    document.getElementById('finish-workout-btn')?.addEventListener('click', showWorkoutSummary);

    // --- Analysis Page ---
    document.getElementById('exercise-select')?.addEventListener('change', (e) => generateExerciseCharts(e.target.value));
    document.getElementById('generate-comparison-chart-btn')?.addEventListener('click', generateComparisonChart);
    document.getElementById('save-body-stats-btn')?.addEventListener('click', saveBodyStats);
    document.getElementById('body-stat-select')?.addEventListener('change', (e) => renderBodyStatChart(e.target.value));

    // --- History Page ---
    document.getElementById('history-search')?.addEventListener('keyup', filterHistory);

    // --- Modals ---
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.target.dataset.modalId));
    });
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.target.dataset.modalId));
    });
    document.getElementById('save-cardio-log-btn')?.addEventListener('click', saveCardioLog);

    // --- Rest Timer ---
    document.getElementById('stop-timer-btn')?.addEventListener('click', stopTimer);
    document.querySelectorAll('#rest-timer button[data-adjust]').forEach(btn => {
        btn.addEventListener('click', (e) => adjustTimer(parseInt(e.target.dataset.adjust)));
    });

    // --- Dynamic Event Delegation for generated content (like workout cards) ---
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        
        // Find closest button for event delegation
        const button = target.closest('button, input[type="checkbox"]');
        if (!button) return;

        const card = button.closest('.exercise-card');
        if (card) {
            const uniqueId = card.id;
            const exTitleEl = card.querySelector('.exercise-title');
            if(!exTitleEl) return;
            const exName = exTitleEl.textContent.replace(" (Freestyle)", "");

            if (button.matches('.util-btn')) {
                if (button.innerHTML.includes('minus')) adjustWeight(uniqueId, -1.25);
                if (button.innerHTML.includes('plus')) adjustWeight(uniqueId, 1.25);
                if (button.title.includes('คำนวณ')) openPlateCalculator(uniqueId);
            } else if (button.matches('.split-button-main')) {
                logSetAndStartTimer(uniqueId, exName);
            } else if (button.matches('.split-button-repeat')) {
                logRepeatSet(uniqueId, exName);
            } else if (button.matches('.quick-note-btn')) {
                addQuickNote(uniqueId, button.textContent.trim().replace('+ ', ''));
            } else if (button.matches('input[type="checkbox"]')) {
                toggleComplete(uniqueId);
            }
        }
        
        // Plan Editor, History, etc. Still have onclick for now, to be refactored
    });
}


// ... All other functions are here ...
