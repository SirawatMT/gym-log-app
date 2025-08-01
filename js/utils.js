// js/utils.js
// รวมฟังก์ชันเสริมเล็กๆ น้อยๆ ที่ไม่มี state และสามารถใช้ซ้ำได้ทั่วทั้งแอป

/**
 * สั่งให้เครื่องสั่น (ถ้าทำได้)
 * @param {number} [duration=50] - ระยะเวลาที่สั่น (ms)
 */
export function vibrate(duration = 50) {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(duration);
        } catch (e) {
            console.warn("Could not vibrate:", e);
        }
    }
}

/**
 * เดากลุ่มกล้ามเนื้อจากชื่อท่าออกกำลังกาย
 * @param {string} exerciseName - ชื่อท่า
 * @returns {string} - ชื่อกลุ่มกล้ามเนื้อ
 */
export function getMuscleGroup(exerciseName) {
    const lowerExName = exerciseName.toLowerCase();
    if (lowerExName.includes('run') || lowerExName.includes('walk') || lowerExName.includes('cycle') || lowerExName.includes('cardio')) return 'Cardio';

    // --- BUG FIX: เปลี่ยนมาใช้ Array เพื่อจัดลำดับความสำคัญของ Keyword ---
    // ตรวจสอบ Keyword ที่เฉพาะเจาะจงและยาวกว่าก่อน เพื่อความแม่นยำ
    const keywordMap = [
        // Shoulders (Specific)
        ['shoulder press', 'Shoulders'],
        ['lateral raise', 'Shoulders'],
        ['front raise', 'Shoulders'],
        // Chest (Specific)
        ['push-up', 'Chest'],
        ['fly', 'Chest'],
        ['dips', 'Chest'],
        // Back (Specific)
        ['pull-up', 'Back'],
        ['pull-down', 'Back'],
        ['deadlift', 'Back'],
        // Legs (Specific)
        ['calf raise', 'Legs'],
        ['step-up', 'Legs'],
        // Arms (Specific)
        ['hammer curl', 'Arms'],
        ['triceps extension', 'Arms'],
        // Core (Specific)
        ['leg raise', 'Core'],
        // General Keywords (ตรวจสอบทีหลัง)
        ['press', 'Chest'],
        ['row', 'Back'],
        ['squat', 'Legs'],
        ['lunge', 'Legs'],
        ['thrust', 'Legs'],
        ['curl', 'Arms'],
        ['crunch', 'Core'],
        ['plank', 'Core'],
    ];

    for (const [keyword, group] of keywordMap) {
        if (lowerExName.includes(keyword)) {
            return group;
        }
    }

    return 'Other';
}


/**
 * คำนวณหาเลขสัปดาห์ของปีจากวันที่
 * @param {Date} d - วันที่
 * @returns {string} - รูปแบบ "YYYY-WXX"
 */
export function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + "-W" + weekNo.toString().padStart(2, '0');
}

/**
 * คำนวณ Estimated 1 Rep Max (e1RM)
 * @param {number} weight - น้ำหนักที่ยก
 * @param {number} reps - จำนวนครั้งที่ยก
 * @returns {number} - ค่า e1RM
 */
export function calculate1RM(weight, reps) {
    if (reps == 1) return weight;
    if (reps <= 0) return 0;
    // Epley formula
    return weight * (1 + (reps / 30));
}
