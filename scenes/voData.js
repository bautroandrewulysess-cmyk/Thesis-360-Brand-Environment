// Segmented voiceover manifest. Segment ids are language-neutral: voUrl() maps
// each id to the per-language audio file (VO/{id}.mp3 or VO/bis/{id with _en_->_bis_}.mp3).
// There is therefore no per-language segment list — the manifest below serves all languages.
// gate types:
//   marker    VO pauses; world-space marker spawns; click resumes next segment
//   miniquiz  VO pauses; two-option quiz; must answer correctly to resume
//   quiz      final narrated segment; end-of-scene quiz fires on its end
//   postquiz  plays only after the scene quiz has been passed
//   none      auto-advances to the next segment
//   sting     standalone cue, not part of any sequence

// Segment ids that exist only as an English recording. In any other language these are
// skipped entirely rather than falling back to English mid-sequence — a 1.5s English sting
// dropped into a Bisaya narration is more jarring than no sting at all. Their gate still
// runs, so a skipped quiz sting still opens its quiz (see triggerQuizDirect in main.js).
window.VoMissingNonEn = new Set(['quizTime_en_01', 'harvesting_en_02']);

window.VoSegments = {
    brandStoryIntro: {
        en: [
            { id: 'brandStory_en_01', gate: { type: 'marker', ref: 'mapZoom' }, dur: 33.52 },
            { id: 'brandStory_en_02', gate: { type: 'marker', ref: 'aerial' }, dur: 19.25 },
            { id: 'brandStory_en_03', gate: { type: 'marker', ref: 'farmerMontage' }, dur: 15.93 },
        ],
    },
    cafeInterior: {
        en: [
            { id: 'brandStory_en_04', gate: { type: 'marker', ref: 'ownerInterview' }, dur: 24.75 },
            { id: 'quizTime_en_01', gate: { type: 'quiz' }, dur: 1.56 },
        ],
    },
    nursery: {
        en: [
            { id: 'nursery_en_01', gate: { type: 'marker', ref: 'polybag' }, dur: 19.92 },
            { id: 'nursery_en_02', gate: { type: 'miniquiz', ref: 'flowers' }, dur: 37.47 },
            { id: 'nursery_en_03', gate: { type: 'quiz' }, dur: 20.29 },
        ],
    },
    journeyToFarm: {
        en: [
            { id: 'journeyToFarm_en_01', gate: { type: 'none' }, dur: 13.1 },
            { id: 'journeyToFarm_en_02', gate: { type: 'none' }, dur: 13.03 },
            { id: 'journeyToFarm_en_03', gate: { type: 'none' }, dur: 3.48 },
            { id: 'journeyToFarm_en_04', gate: { type: 'none' }, dur: 4.67 },
            { id: 'journeyToFarm_en_05', gate: { type: 'none' }, dur: 6.28 },
            { id: 'journeyToFarm_en_06', gate: { type: 'none' }, dur: 4.03 },
        ],
    },
    farm: {
        en: [
            { id: 'farm_en_01', gate: { type: 'marker', ref: 'treePhoto' }, dur: 12.91 },
            { id: 'farm_en_02', gate: { type: 'miniquiz', ref: 'monitoring' }, dur: 24.73 },
            { id: 'farm_en_03', gate: { type: 'quiz' }, dur: 23.65 },
            { id: 'farm_en_04', gate: { type: 'postquiz' }, dur: 5.32 },
        ],
    },
    harvesting: {
        en: [
            { id: 'harvesting_en_01', gate: { type: 'quiz' }, dur: 65.0 },
            { id: 'harvesting_en_02', gate: { type: 'postquiz' }, dur: 3.73 },
        ],
    },
    roasting: {
        en: [
            { id: 'roasting_en_01', gate: { type: 'marker', ref: 'roasterVideo' }, dur: 20.85 },
            { id: 'quizTime_en_01', gate: { type: 'quiz' }, dur: 1.56 },
            { id: 'roasting_en_04', gate: { type: 'postquiz' }, dur: 6.59 },
        ],
    },
    backToCafe: {
        en: [
            { id: 'backToCafe_en_01', gate: { type: 'marker', ref: 'brewingPOV' }, dur: 22.97 },
            { id: 'backToCafe_en_02', gate: { type: 'quiz' }, dur: 14.35 },
        ],
    },
    quizTime: {
        en: [
            { id: 'quizTime_en_01', gate: { type: 'sting' }, dur: 1.56 },
        ],
    },
};
