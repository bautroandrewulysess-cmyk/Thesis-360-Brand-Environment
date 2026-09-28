// Pending quiz data for scenes that don't exist yet
// Strings resolve lazily via t() so the language chosen at runtime wins.

window.PendingQuizzes = {
    harvesting: {
        get question() { return t('quiz.harvesting.question'); },
        get choices() { return [0, 1, 2, 3].map(i => t(`quiz.harvesting.choice.${i}`)); },
        correct: 2,
        get clue() { return t('quiz.harvesting.clue'); },
        get feedback() { return t('quiz.harvesting.feedback'); }
    },
    backToTheCafe: {
        get question() { return t('quiz.backToTheCafe.question'); },
        get choices() { return [0, 1, 2, 3].map(i => t(`quiz.backToTheCafe.choice.${i}`)); },
        // 2, not 1: this question was replaced (it used to ask about the message
        // behind every cup) and the dose it now asks for, 15g, is choice 2.
        correct: 2,
        get clue() { return t('quiz.backToTheCafe.clue'); },
        get feedback() { return t('quiz.backToTheCafe.feedback'); }
    },
    finalChallenge: {
        get question() { return t('quiz.finalChallenge.question'); },
        get choices() { return [0, 1, 2, 3].map(i => t(`quiz.finalChallenge.choice.${i}`)); },
        // 1, not 2: this question was replaced (it used to complete a sentence) and
        // the 45-second bloom it now asks for is choice 1.
        correct: 1,
        get clue() { return t('quiz.finalChallenge.clue'); },
        get feedback() { return t('quiz.finalChallenge.feedback'); }
    }
};
