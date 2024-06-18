document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('highScore');
    const linesElement = document.getElementById('lines');
    const speedElement = document.getElementById('speed');
    const pauseButton = document.getElementById('pauseButton');
    const restartButton = document.getElementById('restartButton');
    const easyModeButton = document.getElementById('easyMode');
    const mediumModeButton = document.getElementById('mediumMode');
    const hardModeButton = document.getElementById('hardMode');
    const clickableSquare = document.getElementById('clickableSquare');
    const speedSliderContainer = document.getElementById('speedSliderContainer');
    const speedSlider = document.getElementById('speedSlider');

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;

    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let score = 0;
    let highScore = localStorage.getItem('tetrisHighScore') || 0;
    let lines = 0;
    let gameOver = false;
    let paused = false;
    let currentPiece;
    let animationId;
    let lastTime = 0;
    let dropInterval = 400; // Початковий інтервал для падіння фігур (мс) - змінюватиметься в залежності від режиму
    let dropCounter = 0;
    let speed = 1; // Початкова швидкість

    // Оновити елемент рекорду
    highScoreElement.textContent = highScore;
    linesElement.textContent = lines;
    speedElement.textContent = speed;

    const COLORS = [
        '#00f0f0', // I
        '#0000f0', // J
        '#f0a000', // L
        '#f0f000', // O
        '#00f000', // S
        '#a000f0', // T
        '#f00000'  // Z
    ];

    const SHAPES = [
        [[1, 1, 1, 1]], // I
        [[1, 0, 0], [1, 1, 1]], // J
        [[0, 0, 1], [1, 1, 1]], // L
        [[1, 1], [1, 1]], // O
        [[0, 1, 1], [1, 1, 0]], // S
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]]  // Z
    ];

    // Встановлені швидкості для кожного режиму
    const speedSettings = {
        easy: 400,  // Інтервал падіння для легкого режиму
        medium: 200, // Інтервал падіння для середнього режиму
        hard: 50    // Інтервал падіння для важкого режиму
    };

    // Відповідні значення повзунка для кожного режиму
    const sliderSettings = {
        easy: 2.5,   // 1000 / 2.5 = 400
        medium: 5,   // 1000 / 5 = 200
        hard: 20     // 1000 / 20 = 50
    };

    class Piece {
        constructor(shape, color) {
            this.shape = shape;
            this.color = color;
            this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
            this.y = 0;
        }

        draw(ctx) {
            ctx.fillStyle = this.color;
            for (let row = 0; row < this.shape.length; row++) {
                for (let col = 0; col < this.shape[row].length; col++) {
                    if (this.shape[row][col]) {
                        ctx.fillRect((this.x + col) * BLOCK_SIZE, (this.y + row) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        ctx.strokeStyle = '#111';
                        ctx.strokeRect((this.x + col) * BLOCK_SIZE, (this.y + row) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                }
            }
        }

        move(deltaX, deltaY) {
            this.x += deltaX;
            this.y += deltaY;
            if (this.hasCollision()) {
                this.x -= deltaX;
                this.y -= deltaY;
                return false;
            }
            return true;
        }

        rotate() {
            const shape = this.shape;
            const newShape = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
            const oldX = this.x;
            const oldY = this.y;

            this.shape = newShape;
            if (this.hasCollision()) {
                this.shape = shape;
                this.x = oldX;
                this.y = oldY;
            }
        }

        hasCollision() {
            for (let row = 0; row < this.shape.length; row++) {
                for (let col = 0; col < this.shape[row].length; col++) {
                    if (this.shape[row][col]) {
                        const newX = this.x + col;
                        const newY = this.y + row;
                        if (newX < 0 || newX >= COLS || newY >= ROWS || board[newY] && board[newY][newX]) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        lock() {
            for (let row = 0; row < this.shape.length; row++) {
                for (let col = 0; col < this.shape[row].length; col++) {
                    if (this.shape[row][col]) {
                        board[this.y + row][this.x + col] = this.color;
                    }
                }
            }
            this.animateClearLines();
        }

        animateClearLines() {
            let linesToClear = [];
            for (let row = 0; row < ROWS; row++) {
                if (board[row].every(cell => cell !== 0)) {
                    linesToClear.push(row);
                }
            }

            if (linesToClear.length > 0) {
                let step = 0;
                const intervalId = setInterval(() => {
                    linesToClear.forEach(row => {
                        for (let col = 0; col < COLS; col++) {
                            board[row][col] = (step % 2 === 0) ? '#ff5555' : '#ffaaaa';
                        }
                    });
                    drawBoard();
                    step++;
                    if (step > 2) {
                        clearInterval(intervalId);
                        setTimeout(() => {
                            linesToClear.forEach(row => {
                                board.splice(row, 1);
                                board.unshift(Array(COLS).fill(0));
                            });
                            score += linesToClear.length * 10;
                            lines += linesToClear.length;
                            scoreElement.textContent = score;
                            linesElement.textContent = lines;
                            drawBoard();
                        }, 100);
                    }
                }, 50);
            }
        }
    }

    function getRandomPiece() {
        const index = Math.floor(Math.random() * SHAPES.length);
        return new Piece(SHAPES[index], COLORS[index]);
    }

    function drawGrid(ctx) {
        ctx.strokeStyle = '#1f1f1f';
        for (let x = 0; x <= COLS * BLOCK_SIZE; x += BLOCK_SIZE) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ROWS * BLOCK_SIZE);
        }
        for (let y = 0; y <= ROWS * BLOCK_SIZE; y += BLOCK_SIZE) {
            ctx.moveTo(0, y);
            ctx.lineTo(COLS * BLOCK_SIZE, y);
        }
        ctx.stroke();
    }

    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col]) {
                    ctx.fillStyle = board[row][col] === 'clearing' ? '#ffffff' : board[row][col];
                    ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.strokeStyle = '#111';
                    ctx.strokeRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }
        drawGrid(ctx);
    }

    function update(time = 0) {
        const deltaTime = time - lastTime;
        lastTime = time;

        if (!paused) {
            dropCounter += deltaTime;

            if (dropCounter > dropInterval) {
                if (!currentPiece.move(0, 1)) {
                    currentPiece.lock();
                    if (currentPiece.y === 0) {
                        gameOver = true;
                        checkHighScore();
                    } else {
                        currentPiece = getRandomPiece();
                    }
                }
                dropCounter = 0;
            }

            drawBoard();
            currentPiece.draw(ctx);

            if (!gameOver) {
                animationId = requestAnimationFrame(update);
            } else {
                alert('Гра завершена');
            }
        }
    }

    function checkHighScore() {
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('tetrisHighScore', highScore);
        }
    }

    function setGameMode(mode) {
        // Встановити інтервал падіння залежно від режиму гри
        dropInterval = speedSettings[mode];
        speedElement.textContent = mode === 'easy' ? '1 (Легкий)' : mode === 'medium' ? '2 (Середній)' : '3 (Важкий)';

        // Встановити значення повзунка відповідно до режиму
        speedSlider.value = sliderSettings[mode];

        restartGame();
    }

    function restartGame() {
        cancelAnimationFrame(animationId);
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        score = 0;
        lines = 0;
        gameOver = false;
        paused = false;
        dropCounter = 0;
        currentPiece = getRandomPiece();
        scoreElement.textContent = score;
        linesElement.textContent = lines;
        pauseButton.textContent = 'Пауза';
        drawBoard();
        update();
    }

    // Обробка подій для вибору режиму гри
    easyModeButton.addEventListener('click', () => setGameMode('easy'));
    mediumModeButton.addEventListener('click', () => setGameMode('medium'));
    hardModeButton.addEventListener('click', () => setGameMode('hard'));

    document.addEventListener('keydown', event => {
        if (paused) return;
        if (event.key === 'ArrowLeft') {
            currentPiece.move(-1, 0);
        } else if (event.key === 'ArrowRight') {
            currentPiece.move(1, 0);
        } else if (event.key === 'ArrowDown') {
            if (currentPiece.move(0, 1)) {
                dropCounter = 0; // Скидаємо лічильник падіння при швидкому русі вниз
            }
        } else if (event.key === 'ArrowUp') {
            currentPiece.rotate();
        }
        drawBoard();
        currentPiece.draw(ctx);
    });

    pauseButton.addEventListener('click', () => {
        if (paused) {
            paused = false;
            pauseButton.textContent = 'Пауза';
            update();
        } else {
            paused = true;
            pauseButton.textContent = 'Відновити';
            cancelAnimationFrame(animationId);
        }
    });

    restartButton.addEventListener('click', restartGame);

    // Додавання обробки кліку на клікабельний квадрат
    clickableSquare.addEventListener('click', () => {
        if (speedSliderContainer.classList.contains('show')) {
            speedSliderContainer.classList.remove('show');
        } else {
            speedSliderContainer.classList.add('show');
        }
    });

    // Додавання обробки зміни значення повзунка швидкості
    speedSlider.addEventListener('input', () => {
        const sliderValue = speedSlider.value;
        dropInterval = 1000 / sliderValue; // Швидкість падіння фігури залежить від значення повзунка
        speedElement.textContent = sliderValue; // Відображення тільки значення швидкості
    });

    currentPiece = getRandomPiece();
    drawBoard();
    update();
});
