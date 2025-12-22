const board = document.querySelector(".main-board");
const startButton = document.querySelector(".btn-start");
const restartButton = document.querySelector(".btn-restart");
const modal = document.querySelector(".modal");
const startGameModal = document.querySelector(".start-game");
const gameOverModal = document.querySelector(".game-over");
const highScoreElement = document.querySelector("#high-score");
const scoreElement = document.querySelector("#score");
const timeElement = document.querySelector("#time");

// --- Config / state ---
const MIN_CELL = 30;    // smallest cell size allowed (px) for small screens
const MAX_CELL = 70;    // largest cell size allowed (px) for big screens
const DEFAULT_CELL = 50; // fallback

let cellSize = DEFAULT_CELL; // px (this will be chosen by JS)
let cols = 0;
let rows = 0;
let blocks = {}; // map "r-c" -> element

let intervalId = null;
let timerIntervalId = null;

let highScore = Number(localStorage.getItem("highScore") || 0);
let score = 0;
let time = "00:00";

let snake = [];
let direction = "down";
let nextDirection = "down";
let food = { x: 0, y: 0 };

// show saved highscore
highScoreElement.innerText = highScore;

// ----------------- helpers -----------------

// Measure board and decide a good cell size so grid fills width nicely
function computeGridSize() {
  const style = getComputedStyle(board);
  const paddingX =
    parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
  const paddingY =
    parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0);

  const usableWidth = Math.max(100, Math.floor(board.clientWidth - paddingX));
  const usableHeight = Math.max(100, Math.floor(board.clientHeight - paddingY));

  // Pick how many columns we want at minimum (gameplay)
  // We choose an approximate number based on DEFAULT_CELL, then compute a cell size
  let approxCols = Math.max(6, Math.floor(usableWidth / DEFAULT_CELL));
  if (approxCols === 0) approxCols = 6;

  // cell size that will make approxCols exactly fill usableWidth
  let computedCell = Math.floor(usableWidth / approxCols);

  // clamp to MIN/MAX
  computedCell = Math.max(MIN_CELL, Math.min(MAX_CELL, computedCell));

  // now recompute cols & rows using final computedCell (avoid fractional)
  cols = Math.max(6, Math.floor(usableWidth / computedCell));
  rows = Math.max(8, Math.floor(usableHeight / computedCell));

  // finally set global cellSize
  cellSize = computedCell;

  // expose CSS variable so .block uses it
  board.style.setProperty("--cell-size", `${cellSize}px`);
}

// Build a fresh grid of blocks and store references
function buildGrid() {
  blocks = {};
  board.innerHTML = "";

  // set exact CSS grid so each track is X px
  board.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  board.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block = document.createElement("div");
      block.classList.add("block");
      // ensure block matches computed size (safe)
      block.style.width = block.style.height = `${cellSize}px`;
      board.appendChild(block);
      blocks[`${r}-${c}`] = block;
    }
  }
}

// Place a food cell that is NOT on the snake
function placeRandomFood() {
  let tries = 0;
  do {
    food.x = Math.floor(Math.random() * rows);
    food.y = Math.floor(Math.random() * cols);
    tries++;
    if (tries > 2000) break;
  } while (snake.some((s) => s.x === food.x && s.y === food.y));

  const key = `${food.x}-${food.y}`;
  if (blocks[key]) blocks[key].classList.add("food");
}

// Clear fill/food classes
function resetBoardVisuals() {
  Object.values(blocks).forEach((b) => b.classList.remove("fill", "food"));
}

// ----------------- game lifecycle -----------------

function startGame() {
  // compute sizes and draw grid
  computeGridSize();
  buildGrid();
  resetBoardVisuals();

  // initial snake: two segments roughly near top third, center column
  const startRow = Math.floor(rows / 3);
  const startCol = Math.floor(cols / 2);
  snake = [{ x: startRow, y: startCol }, { x: startRow - 1, y: startCol }];

  direction = "down";
  nextDirection = direction;
  score = 0;
  time = "00:00";
  scoreElement.innerText = score;
  timeElement.innerText = time;
  highScoreElement.innerText = highScore;

  // place food and draw snake
  placeRandomFood();
  snake.forEach((s) => {
    const k = `${s.x}-${s.y}`;
    if (blocks[k]) blocks[k].classList.add("fill");
  });

  // hide modal
  modal.style.display = "none";
  startGameModal.style.display = "none";
  gameOverModal.style.display = "none";

  // start loops
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(render, 200); // game tick

  if (timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(() => {
    let [m, s] = time.split(":").map(Number);
    s++;
    if (s >= 60) { m++; s = 0; }
    time = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    timeElement.innerText = time;
  }, 1000);
}

function endGame() {
  clearInterval(intervalId);
  clearInterval(timerIntervalId);
  intervalId = null;
  timerIntervalId = null;

  // show game-over modal
  modal.style.display = "flex";
  startGameModal.style.display = "none";
  gameOverModal.style.display = "flex";

  // handle highscore
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("highScore", String(highScore));
  }
  highScoreElement.innerText = highScore;
}

// ----------------- main loop -----------------

function render() {
  // apply buffered direction (prevents instant reverse)
  direction = nextDirection;

  // compute new head pos
  const head = { x: snake[0].x, y: snake[0].y };
  if (direction === "left") head.y -= 1;
  else if (direction === "right") head.y += 1;
  else if (direction === "up") head.x -= 1;
  else if (direction === "down") head.x += 1;

  // wall collision
  if (head.x < 0 || head.x >= rows || head.y < 0 || head.y >= cols) {
    endGame();
    return;
  }

  // self collision
  if (snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
    endGame();
    return;
  }

  // food check
  const ateFood = head.x === food.x && head.y === food.y;
  if (ateFood) {
    // remove old food visual
    const oldKey = `${food.x}-${food.y}`;
    if (blocks[oldKey]) blocks[oldKey].classList.remove("food");

    score += 10;
    scoreElement.innerText = score;

    // grow: add head, don't remove tail
    snake.unshift(head);

    // place new food
    placeRandomFood();
  } else {
    // move normally: remove tail visual, pop tail, add head
    const tail = snake.pop();
    const tailKey = `${tail.x}-${tail.y}`;
    if (blocks[tailKey]) blocks[tailKey].classList.remove("fill");

    snake.unshift(head);
  }

  // draw head
  const headKey = `${head.x}-${head.y}`;
  if (blocks[headKey]) blocks[headKey].classList.add("fill");
}

// ----------------- input -----------------

function handleKeyDown(e) {
  const k = e.key;
  if ((k === "ArrowLeft" || k === "a" || k === "A") && direction !== "right") {
    nextDirection = "left";
  } else if ((k === "ArrowRight" || k === "d" || k === "D") && direction !== "left") {
    nextDirection = "right";
  } else if ((k === "ArrowUp" || k === "w" || k === "W") && direction !== "down") {
    nextDirection = "up";
  } else if ((k === "ArrowDown" || k === "s" || k === "S") && direction !== "up") {
    nextDirection = "down";
  }
}

// ----------------- restart / events -----------------

function restart() {
  clearInterval(intervalId);
  clearInterval(timerIntervalId);
  intervalId = null;
  timerIntervalId = null;

  // recompute grid and start fresh
  computeGridSize();
  buildGrid();
  startGame();
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restart);
window.addEventListener("keydown", handleKeyDown);

// if window resizes while playing, end the game (safer than trying to remap)
window.addEventListener("resize", () => {
  if (intervalId) {
    endGame();
  }
});
