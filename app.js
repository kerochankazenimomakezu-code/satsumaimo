// ===================================
// Application State
// ===================================
let vocabulary = [];
let currentIndex = 0;
let currentMode = 'flashcard';
let studiedCards = new Set();
let correctAnswers = 0;
let totalAttempts = 0;

// ===================================
// DOM Elements
// ===================================
const uploadSection = document.getElementById('uploadSection');
const appSection = document.getElementById('appSection');
const flashcard = document.getElementById('flashcard');
const frontContent = document.getElementById('frontContent');
const backContent = document.getElementById('backContent');
const cardCounter = document.getElementById('cardCounter');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const accuracyText = document.getElementById('accuracyText');

// Mode containers
const flashcardContainer = document.querySelector('.flashcard-container');
const quizContainer = document.getElementById('quizContainer');
const typeContainer = document.getElementById('typeContainer');

// Quiz elements
const quizWord = document.getElementById('quizWord');
const quizOptions = document.getElementById('quizOptions');
const quizFeedback = document.getElementById('quizFeedback');

// Type elements
const typeWord = document.getElementById('typeWord');
const typeInput = document.getElementById('typeInput');
const typeSubmit = document.getElementById('typeSubmit');
const typeFeedback = document.getElementById('typeFeedback');

// Buttons
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const resetBtn = document.getElementById('resetBtn');
const modeBtns = document.querySelectorAll('.mode-btn');

// ===================================
// Initialize App
// ===================================
window.addEventListener('DOMContentLoaded', () => {
    loadSpreadsheetData();
    setupEventListeners();
});

// ===================================
// Google Sheets Data Loading
// ===================================
async function loadSpreadsheetData() {
    try {
        const SHEET_ID = '10jtbT8Yw2HCS2hX8iPuQ7KivYaMMzAgiCwHeIj6iCKs';
        const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

        const response = await fetch(CSV_URL);
        if (!response.ok) {
            throw new Error('ネットワークエラー: データを取得できませんでした');
        }

        const csvText = await response.text();

        Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: function (results) {
                const data = results.data;

                // Parse vocabulary data (skip empty rows)
                vocabulary = data
                    .filter(row => row[0] && row[1])
                    .map((row, index) => ({
                        id: index,
                        japanese: String(row[1]).trim(),
                        english: String(row[0]).trim(),
                        studied: false,
                        correct: 0,
                        incorrect: 0
                    }));

                if (vocabulary.length === 0) {
                    throw new Error('No vocabulary data found in Spreadsheet');
                }

                // Hide upload section, show app
                setTimeout(() => {
                    uploadSection.classList.add('hidden');
                    appSection.classList.remove('hidden');
                    initializeApp();
                }, 1000);
            },
            error: function (error) {
                throw error;
            }
        });

    } catch (error) {
        console.error('Error loading Spreadsheet:', error);
        uploadSection.innerHTML = `
            <div class="upload-card">
                <div class="upload-icon">❌</div>
                <h2>エラーが発生しました</h2>
                <p>スプレッドシートのデータの読み込みに失敗しました。</p>
                <p style="color: var(--text-muted); margin-top: 1rem;">
                    ${error.message}
                </p>
            </div>
        `;
    }
}

// ===================================
// App Initialization
// ===================================
function initializeApp() {
    currentIndex = 0;
    updateCard();
    updateProgress();
    updateCardCounter();
}

// ===================================
// Event Listeners
// ===================================
function setupEventListeners() {
    // Flashcard flip
    flashcard.addEventListener('click', () => {
        if (currentMode === 'flashcard') {
            flashcard.classList.toggle('flipped');
            markAsStudied();
        }
    });

    // Navigation
    prevBtn.addEventListener('click', previousCard);
    nextBtn.addEventListener('click', nextCard);

    // Actions
    shuffleBtn.addEventListener('click', shuffleCards);
    resetBtn.addEventListener('click', resetProgress);

    // Mode switching
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });

    // Quiz mode
    typeSubmit.addEventListener('click', checkTypeAnswer);
    typeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkTypeAnswer();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

// ===================================
// Keyboard Navigation
// ===================================
function handleKeyboard(e) {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            if (currentMode === 'flashcard') {
                flashcard.classList.toggle('flipped');
                markAsStudied();
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            previousCard();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextCard();
            break;
    }
}

// ===================================
// Mode Switching
// ===================================
function switchMode(mode) {
    currentMode = mode;

    // Update active button
    modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Reset flashcard flip
    flashcard.classList.remove('flipped');

    // Show/hide containers
    flashcardContainer.classList.toggle('hidden', mode !== 'flashcard');
    quizContainer.classList.toggle('hidden', mode !== 'quiz');
    typeContainer.classList.toggle('hidden', mode !== 'type');

    // Update content based on mode
    if (mode === 'quiz') {
        setupQuizMode();
    } else if (mode === 'type') {
        setupTypeMode();
    } else {
        updateCard();
    }
}

// ===================================
// Flashcard Mode
// ===================================
function updateCard() {
    if (vocabulary.length === 0) return;

    const card = vocabulary[currentIndex];
    frontContent.textContent = card.japanese;
    backContent.textContent = card.english;
}

function markAsStudied() {
    studiedCards.add(currentIndex);
    vocabulary[currentIndex].studied = true;
    updateProgress();
}

// ===================================
// Quiz Mode
// ===================================
function setupQuizMode() {
    const card = vocabulary[currentIndex];
    quizWord.textContent = card.japanese;
    quizFeedback.classList.add('hidden');

    // Generate options (1 correct + 3 random)
    const options = [card.english];
    const usedIndices = new Set([currentIndex]);

    while (options.length < 4 && options.length < vocabulary.length) {
        const randomIndex = Math.floor(Math.random() * vocabulary.length);
        if (!usedIndices.has(randomIndex)) {
            options.push(vocabulary[randomIndex].english);
            usedIndices.add(randomIndex);
        }
    }

    // Shuffle options
    options.sort(() => Math.random() - 0.5);

    // Create option buttons
    quizOptions.innerHTML = '';
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = option;
        btn.addEventListener('click', () => checkQuizAnswer(btn, option, card.english));
        quizOptions.appendChild(btn);
    });
}

function checkQuizAnswer(btn, selected, correct) {
    const isCorrect = selected === correct;

    // Disable all options
    const allOptions = quizOptions.querySelectorAll('.quiz-option');
    allOptions.forEach(opt => {
        opt.style.pointerEvents = 'none';
        if (opt.textContent === correct) {
            opt.classList.add('correct');
        } else if (opt === btn && !isCorrect) {
            opt.classList.add('incorrect');
        }
    });

    // Update stats
    totalAttempts++;
    if (isCorrect) {
        correctAnswers++;
        vocabulary[currentIndex].correct++;
        quizFeedback.innerHTML = '✅ 正解！ Correct!';
        quizFeedback.style.background = 'var(--color-success)';
    } else {
        vocabulary[currentIndex].incorrect++;
        quizFeedback.innerHTML = `❌ 不正解。正解は「${correct}」です。`;
        quizFeedback.style.background = 'var(--color-error)';
    }

    quizFeedback.classList.remove('hidden');
    markAsStudied();
    updateProgress();

    // Auto advance after 2 seconds
    setTimeout(() => {
        nextCard();
    }, 2000);
}

// ===================================
// Type Mode
// ===================================
function setupTypeMode() {
    const card = vocabulary[currentIndex];
    typeWord.textContent = card.japanese;
    typeInput.value = '';
    typeFeedback.classList.add('hidden');
    typeInput.focus();
}

function checkTypeAnswer() {
    const card = vocabulary[currentIndex];
    const userAnswer = typeInput.value.trim().toLowerCase();
    const correctAnswer = card.english.trim().toLowerCase();

    totalAttempts++;

    if (userAnswer === correctAnswer) {
        correctAnswers++;
        vocabulary[currentIndex].correct++;
        typeFeedback.innerHTML = '✅ 正解！ Correct!';
        typeFeedback.className = 'type-feedback success';

        // Auto advance after 1.5 seconds
        setTimeout(() => {
            nextCard();
        }, 1500);
    } else {
        vocabulary[currentIndex].incorrect++;
        typeFeedback.innerHTML = `❌ 不正解。正解は「${card.english}」です。`;
        typeFeedback.className = 'type-feedback error';
    }

    typeFeedback.classList.remove('hidden');
    markAsStudied();
    updateProgress();
}

// ===================================
// Navigation
// ===================================
function previousCard() {
    currentIndex = (currentIndex - 1 + vocabulary.length) % vocabulary.length;
    flashcard.classList.remove('flipped');

    if (currentMode === 'quiz') {
        setupQuizMode();
    } else if (currentMode === 'type') {
        setupTypeMode();
    } else {
        updateCard();
    }

    updateCardCounter();
}

function nextCard() {
    currentIndex = (currentIndex + 1) % vocabulary.length;
    flashcard.classList.remove('flipped');

    if (currentMode === 'quiz') {
        setupQuizMode();
    } else if (currentMode === 'type') {
        setupTypeMode();
    } else {
        updateCard();
    }

    updateCardCounter();
}

// ===================================
// Progress Tracking
// ===================================
function updateProgress() {
    const studiedCount = studiedCards.size;
    const totalCards = vocabulary.length;
    const percentage = (studiedCount / totalCards) * 100;

    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${studiedCount} / ${totalCards} 学習済み`;

    if (totalAttempts > 0) {
        const accuracy = Math.round((correctAnswers / totalAttempts) * 100);
        accuracyText.textContent = `正解率: ${accuracy}%`;
    } else {
        accuracyText.textContent = '正解率: 0%';
    }
}

function updateCardCounter() {
    cardCounter.textContent = `${currentIndex + 1} / ${vocabulary.length}`;
}

// ===================================
// Actions
// ===================================
function shuffleCards() {
    // Fisher-Yates shuffle
    for (let i = vocabulary.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vocabulary[i], vocabulary[j]] = [vocabulary[j], vocabulary[i]];
    }

    // Reassign IDs
    vocabulary.forEach((card, index) => {
        card.id = index;
    });

    currentIndex = 0;
    flashcard.classList.remove('flipped');

    if (currentMode === 'quiz') {
        setupQuizMode();
    } else if (currentMode === 'type') {
        setupTypeMode();
    } else {
        updateCard();
    }

    updateCardCounter();

    // Visual feedback
    shuffleBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        shuffleBtn.style.transform = '';
    }, 500);
}

function resetProgress() {
    if (!confirm('進捗をリセットしますか？ Reset all progress?')) {
        return;
    }

    studiedCards.clear();
    correctAnswers = 0;
    totalAttempts = 0;

    vocabulary.forEach(card => {
        card.studied = false;
        card.correct = 0;
        card.incorrect = 0;
    });

    currentIndex = 0;
    flashcard.classList.remove('flipped');

    if (currentMode === 'quiz') {
        setupQuizMode();
    } else if (currentMode === 'type') {
        setupTypeMode();
    } else {
        updateCard();
    }

    updateProgress();
    updateCardCounter();
}
