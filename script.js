const boardSize = 10;
const shipsInfo = [
  { size: 4, count: 1 },
  { size: 3, count: 2 },
  { size: 2, count: 3 },
  { size: 1, count: 4 }
];

const board1HitImage = 'hit.webp';
const board1MissImage = 'miss.webp';
const board2HitImage = 'hit1.webp';
const board2MissImage = 'miss.webp';

const board1 = document.getElementById('board1');
const board2 = document.getElementById('board2');

const hitSound = document.getElementById('hit-sound');
const missSound = document.getElementById('miss-sound');
const videoPopup = document.getElementById('video-popup');
const sinkVideo = document.getElementById('sink-video');

let board1Cells = [];
let board2Cells = [];
let ships1 = [];
let ships2 = [];
let currentPlayer = 1;
let gameActive = true;
let player1Name = 'Игрок 1';
let player2Name = 'Игрок 2';
let player1Mode = 'random';
let player2Mode = 'random';

let isSetupPhase = false;
let currentSetupPlayer = 1;
let shipsToPlace = [];
let currentShipIndex = 0;
let currentOrientation = 'horizontal';
let setupBoardCells = [];
let setupShips = [];
let placedShipsCount = 0;

let player1ShipsCount = 10;
let player2ShipsCount = 10;

let socket = null;
let myPlayerNum = null;
let roomId = null;
let isOnlineMode = false;
let isGameModeSelected = false;
let opponentConnected = false;
let opponentReady = false;
let myShipsReady = false;
let gameStarted = false;
let isMyTurn = false;
let waitingForOpponent = false;
let rematchRequested = false;

// === Функции для сохранения состояния игры в localStorage ===
const GAME_STATE_KEY = 'seabattle_game_state';

function saveGameState() {
  if (!isOnlineMode || !roomId) return;
  
  const ships1Coords = ships1.map(ship => 
    ship.cells.map(cell => ({
      x: parseInt(cell.dataset.x),
      y: parseInt(cell.dataset.y)
    }))
  );
  
  const ships2Coords = ships2.map(ship => 
    ship.cells.map(cell => ({
      x: parseInt(cell.dataset.x),
      y: parseInt(cell.dataset.y)
    }))
  );
  
  // Сохраняем ходы (попадания и промахи)
  const board1Moves = { hits: [], misses: [] };
  const board2Moves = { hits: [], misses: [] };
  
  board1Cells.forEach(cell => {
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    if (cell.classList.contains('hit')) board1Moves.hits.push({ x, y });
    if (cell.classList.contains('miss')) board1Moves.misses.push({ x, y });
  });
  
  board2Cells.forEach(cell => {
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    if (cell.classList.contains('hit')) board2Moves.hits.push({ x, y });
    if (cell.classList.contains('miss')) board2Moves.misses.push({ x, y });
  });
  
  const state = {
    roomId,
    myPlayerNum,
    player1Name,
    player2Name,
    gameStarted,
    currentPlayer,
    isSetupPhase,
    myShipsReady,
    opponentReady,
    ships: [ships1Coords, ships2Coords],
    moves: {
      board1: board1Moves,
      board2: board2Moves
    },
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    console.log('Game state saved to localStorage');
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

function loadGameState() {
  try {
    const stateStr = localStorage.getItem(GAME_STATE_KEY);
    if (!stateStr) return null;
    
    const state = JSON.parse(stateStr);
    
    // Проверяем, не истекло ли время (5 минут)
    const elapsed = Date.now() - state.timestamp;
    if (elapsed > 5 * 60 * 1000) {
      console.log('Game state expired');
      clearGameState();
      return null;
    }
    
    return state;
  } catch (e) {
    console.error('Failed to load game state:', e);
    return null;
  }
}

function clearGameState() {
  localStorage.removeItem(GAME_STATE_KEY);
  console.log('Game state cleared');
}

function hasSavedGame() {
  return loadGameState() !== null;
}

// Функция для восстановления игры из localStorage
function restoreGameFromState(state) {
  roomId = state.roomId;
  myPlayerNum = state.myPlayerNum;
  player1Name = state.player1Name;
  player2Name = state.player2Name;
  gameStarted = state.gameStarted;
  currentPlayer = state.currentPlayer;
  isSetupPhase = state.isSetupPhase;
  myShipsReady = state.myShipsReady;
  opponentReady = state.opponentReady;
  
  // Создаём доски
  createBoard(board1, board1Cells);
  createBoard(board2, board2Cells);
  
  // Восстанавливаем корабли
  if (state.ships && state.ships[0]) {
    applyReceivedShips(state.ships[0], board1Cells, ships1, board1HitImage);
  }
  if (state.ships && state.ships[1]) {
    applyReceivedShips(state.ships[1], board2Cells, ships2, board2HitImage);
  }
  
  // Восстанавливаем ходы
  if (state.moves) {
    if (state.moves.board1) {
      state.moves.board1.hits.forEach(coord => {
        const cell = board1Cells[coord.y * boardSize + coord.x];
        if (cell) {
          cell.classList.add('hit');
          cell.style.backgroundImage = `url('${board1HitImage}')`;
        }
      });
      state.moves.board1.misses.forEach(coord => {
        const cell = board1Cells[coord.y * boardSize + coord.x];
        if (cell) {
          cell.classList.add('miss');
          cell.style.backgroundImage = `url('${board1MissImage}')`;
        }
      });
    }
    if (state.moves.board2) {
      state.moves.board2.hits.forEach(coord => {
        const cell = board2Cells[coord.y * boardSize + coord.x];
        if (cell) {
          cell.classList.add('hit');
          cell.style.backgroundImage = `url('${board2HitImage}')`;
        }
      });
      state.moves.board2.misses.forEach(coord => {
        const cell = board2Cells[coord.y * boardSize + coord.x];
        if (cell) {
          cell.classList.add('miss');
          cell.style.backgroundImage = `url('${board2MissImage}')`;
        }
      });
    }
  }
  
  isOnlineMode = true;
  isMyTurn = myPlayerNum === currentPlayer;
  
  console.log('Game restored from localStorage');
}


function applyAllMoves(moves, source = 'unknown') {
  if (!moves) return;
  console.log('=== APPLY MOVES from:', source);

  if (moves.board1) {
    moves.board1.hits.forEach(coord => {
      const cell = board1Cells[coord.y * boardSize + coord.x];
      if (cell) {
        cell.classList.add('hit');
        cell.style.backgroundImage = `url('${board1HitImage}')`;
      }
    });
    moves.board1.misses.forEach(coord => {
      const cell = board1Cells[coord.y * boardSize + coord.x];
      if (cell) {
        cell.classList.add('miss');
        cell.style.backgroundImage = `url('${board1MissImage}')`;
      }
    });
  }
  if (moves.board2) {
    moves.board2.hits.forEach(coord => {
      const cell = board2Cells[coord.y * boardSize + coord.x];
      if (cell) {
        cell.classList.add('hit');
        cell.style.backgroundImage = `url('${board2HitImage}')`;
      }
    });
    moves.board2.misses.forEach(coord => {
      const cell = board2Cells[coord.y * boardSize + coord.x];
      if (cell) {
        cell.classList.add('miss');
        cell.style.backgroundImage = `url('${board2MissImage}')`;
      }
    });
  }
}

// Инвертирует доски: board1 ↔ board2 (нужно для игрока 2)
function invertBoardMoves(moves) {
  if (!moves) return moves;
  return {
    board1: moves.board2,  // ходы по мне (от соперника) → на мою доску board1
    board2: moves.board1   // мои ходы (по сопернику) → на доску соперника board2
  };
}

function setupVideoSkippable(videoElement, popupElement) {
  videoElement.addEventListener('click', (e) => {
    e.stopPropagation();
    videoElement.pause();
    popupElement.style.display = 'none';
  });
}

setupVideoSkippable(sinkVideo, videoPopup);

function updateShipsCounter() {
  let counterDiv = document.getElementById('ships-counter');
  if (!counterDiv) {
    counterDiv = document.createElement('div');
    counterDiv.id = 'ships-counter';
    counterDiv.className = 'ships-counter';
    document.body.appendChild(counterDiv);
  }

  const player1AliveShips = ships1.filter(ship => ship.hits < ship.cells.length).length;
  const player2AliveShips = ships2.filter(ship => ship.hits < ship.cells.length).length;

  counterDiv.innerHTML = `
    <div class="counter-player">
      <span class="player-name" style="color: #374c36;">${player1Name}:</span>
      <span class="ship-count">${player1AliveShips}</span>
      <span class="ship-total">/ 10</span>
    </div>
    <div class="counter-divider"></div>
    <div class="counter-player">
      <span class="player-name" style="color: #2d3b5c;">${player2Name}:</span>
      <span class="ship-count">${player2AliveShips}</span>
      <span class="ship-total">/ 10</span>
    </div>
  `;
}

function createBoard(boardElement, boardCells){
  boardCells.length = 0;
  boardElement.innerHTML = '';
  const ABC = ['', 'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К']
  let number = 1
  for(let i=0; i<(boardSize+1)*(boardSize+1); i++){
    const cell = document.createElement('div');
    cell.classList.add('cell'); 
      
    if (i === 0) {
      cell.classList.add('cell--o')
    } else if (i < 11) {
      cell.classList.add('cell--title')
      cell.innerHTML = `${ABC[i]}`
    } else if (i % 11 === 0) {
      cell.classList.add('cell--title')
      cell.innerHTML = `${number++}`
    } else {
      const x = (i % 11) - 1;
      const y = Math.floor(i / 11) - 1;
      cell.dataset.x = x;
      cell.dataset.y = y;
    }
    
    boardElement.appendChild(cell);
    if (cell.dataset.x !== undefined) {
      boardCells.push(cell);
    }
  }
}

function canPlaceShip(boardCells, x, y, size, horizontal) {
  for(let i=-1; i<=size; i++){
    for(let j=-1; j<=1; j++){
      let xi = x + (horizontal ? i : j);
      let yi = y + (horizontal ? j : i);
      if(xi >=0 && xi<boardSize && yi>=0 && yi<boardSize){
        if(boardCells[yi*boardSize + xi].dataset.hasShip === 'true') return false;
      }
    }
  }
  return true;
}

// Исправленная функция placeShipsRandom - убираем визуальное отображение
function placeShipsRandom(boardCells) {
  boardCells.forEach(cell => {
    delete cell.dataset.hasShip;
    // Не убираем визуальные стили здесь, они уберутся в hideAllShipsForGame
  });
  
  let placedShips = [];
  shipsInfo.forEach(shipType => {
    for(let n=0; n<shipType.count; n++){
      let placed = false;
      let attempts = 0;
      while(!placed && attempts < 1000){
        attempts++;
        const horizontal = Math.random() < 0.5;
        const x = Math.floor(Math.random() * boardSize);
        const y = Math.floor(Math.random() * boardSize);
        if(horizontal && x + shipType.size > boardSize) continue;
        if(!horizontal && y + shipType.size > boardSize) continue;
        if(!canPlaceShip(boardCells, x, y, shipType.size, horizontal)) continue;

        const shipCells = [];
        for(let i=0; i<shipType.size; i++){
          const xi = x + (horizontal ? i : 0);
          const yi = y + (horizontal ? 0 : i);
          const cell = boardCells[yi*boardSize + xi];
          cell.dataset.hasShip = 'true';
          // НЕ ДОБАВЛЯЕМ визуальные стили здесь!
          shipCells.push(cell);
        }
        placedShips.push({cells: shipCells, hits: 0});
        placed = true;
      }
      if(!placed){
        console.warn('Не удалось разместить корабль размера', shipType.size);
      }
    }
  });
  console.log('Размещено кораблей:', placedShips.length);
  return placedShips;
}

// Функция для начала фазы ручной расстановки
function startManualPlacement(playerNumber) {
  console.log('=== startManualPlacement called, player:', playerNumber);
  console.log('player1Name:', player1Name, 'player2Name:', player2Name);
  console.log('board1:', board1, 'board2:', board2);
  
  isSetupPhase = true;
  currentSetupPlayer = playerNumber;
  
  // Определяем доску для расстановки
  const boardElement = playerNumber === 1 ? board1 : board2;
  setupBoardCells = playerNumber === 1 ? board1Cells : board2Cells;
  
  // ПОКАЗЫВАЕМ игровой контейнер, но скрываем вторую доску
  const gameContainer = document.getElementById('game-container');
  gameContainer.style.display = 'flex';
  
  // Скрываем доску противника
  if (playerNumber === 1) {
    board2.style.display = 'none';
    board1.style.display = 'grid';
    // Обновляем заголовок
    const header = document.querySelector('.board-container:first-child h2');
    if (header) header.textContent = `${player1Name} - РАССТАНОВКА КОРАБЛЕЙ`;
  } else {
    board1.style.display = 'none';
    board2.style.display = 'grid';
    const header = document.querySelector('.board-container:last-child h2');
    if (header) header.textContent = `${player2Name} - РАССТАНОВКА КОРАБЛЕЙ`;
  }
  
  // Очищаем доску
  setupBoardCells.forEach(cell => {
  delete cell.dataset.hasShip;
  cell.style.backgroundImage = '';
  cell.style.backgroundColor = '';
  cell.style.transform = '';
  cell.classList.remove('ship-preview', 'ship-placed', 'valid-placement', 'invalid-placement', 'hit', 'miss');
});
  
  // Создаем массив кораблей для расстановки
  shipsToPlace = [];
  shipsInfo.forEach(shipType => {
    for(let n = 0; n < shipType.count; n++) {
      shipsToPlace.push({ size: shipType.size, placed: false });
    }
  });
  
  currentShipIndex = 0;
  setupShips = [];
  placedShipsCount = 0;
  
  // Показываем информационную панель
  showPlacementInfo(playerNumber);
  
  // Добавляем временные обработчики для расстановки
  setupBoardCells.forEach(cell => {
    cell.removeEventListener('click', handleClick);
    cell.addEventListener('mouseenter', handlePlacementHover);
    cell.addEventListener('mouseleave', handlePlacementHoverEnd);
    cell.addEventListener('click', handlePlacementClick);
    cell.addEventListener('contextmenu', handlePlacementRightClick);
  });
  
  // Добавляем кнопку поворота корабля
  addRotationButton();
  
  // Добавляем кнопку случайной расстановки
  addRandomPlacementButton();
  
  // Подсвечиваем активную доску
  highlightSetupBoard(boardElement);
}

// Исправленная функция showPlacementInfo - перемещаем вниз
function showPlacementInfo(playerNumber) {
  let infoDiv = document.getElementById('placement-info');
  if (!infoDiv) {
    infoDiv = document.createElement('div');
    infoDiv.id = 'placement-info';
    infoDiv.style.position = 'fixed';
    infoDiv.style.bottom = '100px';
    if (playerNumber === 1) {
      infoDiv.style.right = '25%';
      infoDiv.style.left = 'auto';
    } else {
      infoDiv.style.left = '25%';
      infoDiv.style.right = 'auto';
    }
    infoDiv.style.transform = 'translateX(-50%)';
    infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    infoDiv.style.color = 'white';
    infoDiv.style.padding = '15px 30px';
    infoDiv.style.borderRadius = '15px';
    infoDiv.style.fontFamily = 'Montserrat, sans-serif';
    infoDiv.style.fontSize = '16px';
    infoDiv.style.fontWeight = 'bold';
    infoDiv.style.zIndex = '1001';
    infoDiv.style.border = '3px solid gold';
    infoDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.6)';
    infoDiv.style.textAlign = 'center';
    infoDiv.style.minWidth = '350px';
    infoDiv.style.backdropFilter = 'blur(5px)';
    document.body.appendChild(infoDiv);
  }
  
  const playerName = playerNumber === 1 ? player1Name : player2Name;
  const currentShip = shipsToPlace[currentShipIndex];
  
  // Подсчет оставшихся кораблей
  const remainingShips = {1: 0, 2: 0, 3: 0, 4: 0};
  for (let i = currentShipIndex; i < shipsToPlace.length; i++) {
    remainingShips[shipsToPlace[i].size]++;
  }
  
  let shipsListHTML = '';
  for (let size = 4; size >= 1; size--) {
    if (remainingShips[size] > 0) {
      shipsListHTML += `
        <div style="display: inline-block; margin: 0 10px; padding: 5px 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">
          <span>${size}🚢 ×${remainingShips[size]}</span>
        </div>
      `;
    }
  }
  
  infoDiv.innerHTML = `
    <div style="margin-bottom: 10px;">
      <span style="color: #4a90e2;">${playerName}</span> - расстановка кораблей
    </div>
    <div style="font-size: 24px; color: gold; margin-bottom: 10px;">
      ${placedShipsCount} / 10
    </div>
    <div style="margin-bottom: 10px;">
      ${shipsListHTML}
    </div>
    <div style="font-size: 18px; padding: 8px; background: rgba(74, 144, 226, 0.3); border-radius: 8px;">
      Сейчас: ${currentShip.size}-палубный 
      ${currentOrientation === 'horizontal' ? '➡️' : '⬇️'}
    </div>
    <div style="margin-top: 10px; font-size: 12px; color: #aaa;">
      ПКМ - поворот | Клик - разместить
    </div>
  `;
}

function addRotationButton() {
  let btn = document.getElementById('rotate-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'rotate-btn';
    btn.textContent = 'ПОВЕРНУТЬ (ПРОБЕЛ)';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.padding = '15px 30px';
    btn.style.fontSize = '18px';
    btn.style.fontWeight = 'bold';
    btn.style.backgroundColor = '#4a90e2';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '10px';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '1002';
    btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    btn.style.fontFamily = 'Montserrat, sans-serif';
    
    btn.onclick = () => {
      currentOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
      showPlacementInfo(currentSetupPlayer);
    };
    
    document.body.appendChild(btn);
  }
  
  // Добавляем обработчик клавиши R
  document.addEventListener('keydown', handleKeyPress);
}

function addRandomPlacementButton() {
  let btn = document.getElementById('random-placement-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'random-placement-btn';
    btn.textContent = 'СЛУЧАЙНАЯ РАССТАНОВКА';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.left = '20px';
    btn.style.padding = '15px 30px';
    btn.style.fontSize = '18px';
    btn.style.fontWeight = 'bold';
    btn.style.backgroundColor = '#e67e22';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '10px';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '1002';
    btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    btn.style.fontFamily = 'Montserrat, sans-serif';
    
    btn.onclick = () => {
      randomPlaceCurrentBoard();
    };
    
    document.body.appendChild(btn);
  }
}

function randomPlaceCurrentBoard() {
  console.log('Random placement for player:', currentSetupPlayer);
  
  // Очищаем текущую расстановку
  setupBoardCells.forEach(cell => {
    delete cell.dataset.hasShip;
    cell.style.backgroundColor = '';
    cell.style.border = '';
    cell.style.boxShadow = '';
    cell.style.transform = '';
    cell.classList.remove('ship-placed', 'ship-preview', 'valid-placement', 'invalid-placement');
  });
  
  // Случайно расставляем ВСЕ корабли
  setupShips = placeShipsRandom(setupBoardCells);
  
  // Визуально отображаем расставленные корабли
  setupShips.forEach(ship => {
    ship.cells.forEach(cell => {
      cell.classList.add('ship-placed');
      cell.style.backgroundColor = '#4a90e2';
      cell.style.border = '2px solid #2c5aa0';
      cell.style.boxShadow = 'inset 0 0 10px rgba(255, 255, 255, 0.5)';
    });
  });
  
  // Обновляем счетчики
  placedShipsCount = setupShips.length;
  
  // Завершаем расстановку
  finishPlacement();
}

function handleKeyPress(e) {
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    if (isSetupPhase) {
      currentOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
      showPlacementInfo(currentSetupPlayer);
    }
  }
}

function handlePlacementHover(e) {
  if (!isSetupPhase) return;
  
  const cell = e.target;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  const shipSize = shipsToPlace[currentShipIndex].size;
  
  // Очищаем предыдущий превью, но не трогаем размещенные корабли
  setupBoardCells.forEach(c => {
    if (!c.classList.contains('ship-placed')) {
      c.classList.remove('ship-preview', 'valid-placement', 'invalid-placement');
      c.style.backgroundImage = '';
      c.style.backgroundColor = '';
      c.style.transform = '';
    }
  });
  
  // Проверяем, помещается ли корабль
  let canPlace = true;
  if (currentOrientation === 'horizontal' && x + shipSize > boardSize) canPlace = false;
  if (currentOrientation === 'vertical' && y + shipSize > boardSize) canPlace = false;
  
  if (canPlace) {
    canPlace = canPlaceShip(setupBoardCells, x, y, shipSize, currentOrientation === 'horizontal');
  }
  
  // Показываем превью с изображением
  const shipImage = currentSetupPlayer === 1 ? board1HitImage : board2HitImage;
  
  for (let i = 0; i < shipSize; i++) {
    const xi = x + (currentOrientation === 'horizontal' ? i : 0);
    const yi = y + (currentOrientation === 'vertical' ? i : 0);
    if (xi < boardSize && yi < boardSize) {
      const previewCell = setupBoardCells[yi * boardSize + xi];
      
      // Не показываем превью поверх уже размещенных кораблей
      if (!previewCell.classList.contains('ship-placed')) {
        previewCell.classList.add('ship-preview');
        previewCell.classList.add(canPlace ? 'valid-placement' : 'invalid-placement');
        
        // Показываем изображение корабля с прозрачностью
        previewCell.style.backgroundImage = `url('${shipImage}')`;
        previewCell.style.backgroundSize = 'cover';
        previewCell.style.backgroundPosition = 'center';
        previewCell.style.backgroundRepeat = 'no-repeat';
        previewCell.style.opacity = canPlace ? '0.7' : '0.5';
        previewCell.style.filter = canPlace ? 'brightness(1.2)' : 'brightness(0.8)';
        
        if (currentOrientation === 'vertical') {
          previewCell.style.transform = 'rotate(90deg)';
          previewCell.classList.add('preview-vertical');
        } else {
          previewCell.style.transform = 'rotate(0deg)';
        }
      }
    }
  }
}

function handlePlacementHoverEnd(e) {
  if (!isSetupPhase) return;
  
  setupBoardCells.forEach(c => {
    // Убираем только классы превью, но не трогаем размещенные корабли
    if (!c.classList.contains('ship-placed')) {
      c.classList.remove('ship-preview', 'valid-placement', 'invalid-placement', 'preview-vertical');
      c.style.backgroundImage = '';
      c.style.backgroundColor = '';
      c.style.transform = '';
      c.style.opacity = '';
      c.style.filter = '';
    } else {
      // Для размещенных кораблей только убираем классы превью
      c.classList.remove('ship-preview', 'valid-placement', 'invalid-placement', 'preview-vertical');
      c.style.opacity = '';
      c.style.filter = '';
    }
  });
}

function handlePlacementClick(e) {
  if (!isSetupPhase) return;
  
  const cell = e.target;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  const shipSize = shipsToPlace[currentShipIndex].size;
  
  // Проверяем возможность размещения
  if (currentOrientation === 'horizontal' && x + shipSize > boardSize) {
    showPlacementError('Корабль не помещается на поле!');
    return;
  }
  if (currentOrientation === 'vertical' && y + shipSize > boardSize) {
    showPlacementError('Корабль не помещается на поле!');
    return;
  }
  
  if (!canPlaceShip(setupBoardCells, x, y, shipSize, currentOrientation === 'horizontal')) {
    showPlacementError('Здесь нельзя разместить корабль! Слишком близко к другому.');
    return;
  }
  
  // Размещаем корабль с ИЗОБРАЖЕНИЯМИ
  const shipCells = [];
  const shipImage = currentSetupPlayer === 1 ? board1HitImage : board2HitImage;
  
  for (let i = 0; i < shipSize; i++) {
    const xi = x + (currentOrientation === 'horizontal' ? i : 0);
    const yi = y + (currentOrientation === 'vertical' ? i : 0);
    const shipCell = setupBoardCells[yi * boardSize + xi];
    
    // Отмечаем что здесь корабль
    shipCell.dataset.hasShip = 'true';
    
    // Добавляем изображение корабля
    shipCell.style.backgroundImage = `url('${shipImage}')`;
    shipCell.style.backgroundSize = 'cover';
    shipCell.style.backgroundPosition = 'center';
    shipCell.style.backgroundRepeat = 'no-repeat';
    shipCell.style.backgroundColor = '';
    
    // Добавляем класс для анимации и поворота
    shipCell.classList.add('ship-placed');
    if (currentOrientation === 'vertical') {
      shipCell.classList.add('ship-vertical');
    }
    
    shipCells.push(shipCell);
  }
  
  // Сохраняем корабль
  setupShips.push({ cells: shipCells, hits: 0 });
  placedShipsCount++;
  
  // Очищаем превью
  setupBoardCells.forEach(c => {
    c.classList.remove('ship-preview', 'valid-placement', 'invalid-placement', 'preview-vertical');
    if (!c.classList.contains('ship-placed')) {
      c.style.backgroundImage = '';
      c.style.backgroundColor = '';
      c.style.transform = '';
    }
  });
  
  // Переходим к следующему кораблю
  currentShipIndex++;
  
  if (currentShipIndex >= shipsToPlace.length) {
    // Все корабли расставлены
    setTimeout(() => finishPlacement(), 100);
  } else {
    showPlacementInfo(currentSetupPlayer);
  }
}

function handlePlacementRightClick(e) {
  e.preventDefault();
  if (isSetupPhase) {
    currentOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    showPlacementInfo(currentSetupPlayer);
  }
}

function finishPlacement() {
  console.log('=== finishPlacement called ===');
  console.log('Current setup player:', currentSetupPlayer);
  console.log('Setup ships count:', setupShips.length);
  
  setupBoardCells.forEach(cell => {
    cell.removeEventListener('mouseenter', handlePlacementHover);
    cell.removeEventListener('mouseleave', handlePlacementHoverEnd);
    cell.removeEventListener('click', handlePlacementClick);
    cell.removeEventListener('contextmenu', handlePlacementRightClick);
    cell.classList.remove('ship-preview', 'valid-placement', 'invalid-placement');
    cell.style.opacity = '';
    cell.style.filter = '';
  });

  const rotateBtn = document.getElementById('rotate-btn');
  if (rotateBtn) rotateBtn.remove();
  
  const randomBtn = document.getElementById('random-placement-btn');
  if (randomBtn) randomBtn.remove();
  
  const infoDiv = document.getElementById('placement-info');
  if (infoDiv) infoDiv.remove();
  
  document.removeEventListener('keydown', handleKeyPress);

  if (currentSetupPlayer === 1) {
    ships1 = [...setupShips];
    console.log('✅ Ships1 saved:', ships1.length, 'ships');
  } else {
    ships2 = [...setupShips];
    console.log('✅ Ships2 saved:', ships2.length, 'ships');
  }

  isSetupPhase = false;

  if (isOnlineMode) {
    const shipsData = currentSetupPlayer === 1 ? ships1 : ships2;
    const shipsCoords = shipsData.map(ship => 
      ship.cells.map(cell => ({
        x: parseInt(cell.dataset.x),
        y: parseInt(cell.dataset.y)
      }))
    );

    socket.send(JSON.stringify({
      type: 'ships-ready',
      ships: shipsCoords
    }));

    myShipsReady = true;
    saveGameState();

    const waitingOverlay = document.createElement('div');
    waitingOverlay.id = 'waiting-opponent';
    waitingOverlay.style.position = 'fixed';
    waitingOverlay.style.top = '0';
    waitingOverlay.style.left = '0';
    waitingOverlay.style.width = '100%';
    waitingOverlay.style.height = '100%';
    waitingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    waitingOverlay.style.zIndex = '9999';
    waitingOverlay.style.display = 'flex';
    waitingOverlay.style.justifyContent = 'center';
    waitingOverlay.style.alignItems = 'center';
    waitingOverlay.style.flexDirection = 'column';
    waitingOverlay.innerHTML = `
      <div style="color: white; font-size: 32px; font-family: Montserrat; margin-bottom: 20px;">
        Корабли расставлены!
      </div>
      <div id="waiting-status" style="color: #aaa; font-size: 20px; font-family: Montserrat;">
        Ожидаем соперника...
      </div>
    `;
    document.body.appendChild(waitingOverlay);

    const checkBothReady = setInterval(() => {
      if (opponentReady && myShipsReady) {
        clearInterval(checkBothReady);
        console.log('Both players ready, waiting for game-start...');
      }
    }, 500);

    saveGameState(); // Сохраняем после расстановки кораблей
    return;
  }

  if (currentSetupPlayer === 1) {
    if (player2Mode === 'manual') {
      console.log('➡️ Player 2 will place ships manually');
      hideShipsForGame(board1Cells);
      
      const header = document.querySelector('.board-container:first-child h2');
      if (header) header.textContent = player1Name;
      
      showTransitionScreen(player1Name, player2Name, () => {
        board1.style.display = 'none';
        startManualPlacement(2);
      });
    } else {
      console.log('🎲 Player 2 will use random placement');
      hideShipsForGame(board1Cells);
      ships2 = placeShipsRandom(board2Cells);
      console.log('✅ Ships2 placed randomly:', ships2.length, 'ships');
      hideShipsForGame(board2Cells);
      board1.style.display = 'grid';
      board2.style.display = 'grid';
      
      const header1 = document.querySelector('.board-container:first-child h2');
      const header2 = document.querySelector('.board-container:last-child h2');
      if (header1) header1.textContent = player1Name;
      if (header2) header2.textContent = player2Name;
      
      startGameAfterSetup();
    }
  } else {
    console.log('🎮 Both players placed ships, starting game!');
    hideShipsForGame(board2Cells);
    board1.style.display = 'grid';
    board2.style.display = 'grid';
    
    const header1 = document.querySelector('.board-container:first-child h2');
    const header2 = document.querySelector('.board-container:last-child h2');
    if (header1) header1.textContent = player1Name;
    if (header2) header2.textContent = player2Name;
    
    startGameAfterSetup();
  }
}

function showTransitionScreen(player1, player2, callback) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.flexDirection = 'column';
  
  const message = document.createElement('div');
  message.style.color = 'white';
  message.style.fontSize = '32px';
  message.style.fontFamily = 'Montserrat, sans-serif';
  message.style.marginBottom = '30px';
  message.style.textAlign = 'center';
  message.innerHTML = `${player1} расставил корабли!<br>Теперь очередь ${player2}`;
  
  const button = document.createElement('button');
  button.textContent = 'ПРОДОЛЖИТЬ';
  button.style.padding = '20px 40px';
  button.style.fontSize = '24px';
  button.style.backgroundColor = 'gold';
  button.style.color = 'black';
  button.style.border = 'none';
  button.style.borderRadius = '10px';
  button.style.cursor = 'pointer';
  button.style.fontWeight = 'bold';
  button.style.fontFamily = 'Montserrat, sans-serif';
  
  button.onclick = () => {
    overlay.remove();
    callback();
  };
  
  overlay.appendChild(message);
  overlay.appendChild(button);
  document.body.appendChild(overlay);
}

// Убедимся, что функция hideShipsForGame правильно работает
function hideShipsForGame(boardCells) {
  console.log('🙈 Hiding ships for game');
  boardCells.forEach(cell => {
    // Убираем только визуальное отображение, но ОСТАВЛЯЕМ dataset.hasShip
    cell.style.backgroundImage = '';
    cell.style.backgroundColor = '';
    cell.style.transform = '';
    cell.style.opacity = '';
    cell.style.filter = '';
    
    // Убираем классы
    cell.classList.remove('ship-placed', 'ship-preview', 'valid-placement', 'invalid-placement');
  });
}

// Функция для скрытия ВСЕХ кораблей перед началом игры
function hideAllShipsForGame() {
  console.log('🙈 Hiding ALL ships for game start');
  
  // Скрываем корабли на первой доске
  board1Cells.forEach(cell => {
    // Убираем визуальное отображение, но оставляем dataset.hasShip
    cell.style.backgroundImage = '';
    cell.style.backgroundColor = '';
    cell.style.border = '';
    cell.style.boxShadow = '';
    cell.style.transform = '';
    cell.style.opacity = '';
    cell.style.filter = '';
    
    // Убираем все классы, связанные с отображением
    cell.classList.remove('ship-placed', 'ship-preview', 'valid-placement', 'invalid-placement');
    
    // Если это клетка с кораблем, dataset.hasShip остается
  });
  
  // Скрываем корабли на второй доске
  board2Cells.forEach(cell => {
    // Убираем визуальное отображение, но оставляем dataset.hasShip
    cell.style.backgroundImage = '';
    cell.style.backgroundColor = '';
    cell.style.border = '';
    cell.style.boxShadow = '';
    cell.style.transform = '';
    cell.style.opacity = '';
    cell.style.filter = '';
    
    // Убираем все классы, связанные с отображением
    cell.classList.remove('ship-placed', 'ship-preview', 'valid-placement', 'invalid-placement');
    
    // Если это клетка с кораблем, dataset.hasShip остается
  });
  
  console.log('✅ All ships hidden');
}

function startGameAfterSetup() {
  console.log('=== startGameAfterSetup ===');
  console.log('ships1:', ships1.length, 'ships');
  console.log('ships2:', ships2.length, 'ships');
  
  const gameContainer = document.getElementById('game-container');
  gameContainer.style.display = 'flex';
  
  // Убеждаемся, что обе доски видны
  board1.style.display = 'grid';
  board2.style.display = 'grid';
  
  // Восстанавливаем указатель событий
  board1.style.pointerEvents = 'auto';
  board2.style.pointerEvents = 'auto';
  
  // Убираем все оверлеи
  const overlays = document.querySelectorAll('.board-overlay');
  overlays.forEach(overlay => overlay.remove());
  
  // Скрываем все визуальные корабли
  hideAllShipsForGame();
  
  // Навешиваем обработчики для игры
  const allCells = board1Cells.concat(board2Cells);
  allCells.forEach(cell => {
    cell.removeEventListener('click', handleClick);
    cell.addEventListener('click', handleClick);
  });
  
  currentPlayer = 1;
  gameActive = true;
  
  highlightCurrentBoard();
  updateShipsCounter();
  
  showTurnMessage(`Игра началась! Ходит ${player1Name}`);
  
  console.log('✅ Game started! Current player:', currentPlayer);
  console.log('Board1 cells with ships:', board1Cells.filter(c => c.dataset.hasShip === 'true').length);
  console.log('Board2 cells with ships:', board2Cells.filter(c => c.dataset.hasShip === 'true').length);
}

function highlightSetupBoard(boardElement) {
  board1.classList.remove('active-board');
  board2.classList.remove('active-board');
  boardElement.classList.add('active-board');
}

function markAdjacentCells(shipCells, boardCells, missImg) {
  const shipCoords = shipCells.map(cell => ({
    x: parseInt(cell.dataset.x),
    y: parseInt(cell.dataset.y)
  }));
  
  let minX = Math.max(0, Math.min(...shipCoords.map(c => c.x)) - 1);
  let maxX = Math.min(boardSize - 1, Math.max(...shipCoords.map(c => c.x)) + 1);
  let minY = Math.max(0, Math.min(...shipCoords.map(c => c.y)) - 1);
  let maxY = Math.min(boardSize - 1, Math.max(...shipCoords.map(c => c.y)) + 1);
  
  let markedCount = 0;
  
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = boardCells[y * boardSize + x];
      
      const isShipCell = shipCoords.some(coord => coord.x === x && coord.y === y);
      
      if (!isShipCell && 
          !cell.classList.contains('hit') && 
          !cell.classList.contains('miss')) {
        
        cell.classList.add('miss');
        cell.style.backgroundImage = `url('${missImg}')`;
        markedCount++;
        
        cell.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if(cell) cell.style.transform = 'scale(1)';
        }, 100);
      }
    }
  }
  
  console.log(`Отмечено ${markedCount} клеток вокруг уничтоженного корабля`);
  return markedCount;
}

function handleClick(e) {
  console.log('Click detected, game active:', gameActive);
  
  const cell = e.target;
  
  if (!gameActive) {
    console.log('Game not active');
    return;
  }
  if (cell.classList.contains('hit') || cell.classList.contains('miss')) {
    console.log('Cell already hit or miss');
    return;
  }
  
  const parentBoard = cell.parentElement.id;
  console.log('Clicked on board:', parentBoard);
  
  if (currentPlayer === 1 && parentBoard !== 'board2') {
    console.log('Not player 1 turn or wrong board');
    return;
  }
  if (currentPlayer === 2 && parentBoard !== 'board1') {
    console.log('Not player 2 turn or wrong board');
    return;
  }
  
  let hitImg, missImg;
  let shipsArray;
  let boardCells;
  
  if (parentBoard === 'board1') {
    hitImg = board1HitImage;
    missImg = board1MissImage;
    shipsArray = ships1;
    boardCells = board1Cells;
  } else {
    hitImg = board2HitImage;
    missImg = board2MissImage;
    shipsArray = ships2;
    boardCells = board2Cells;
  }
  
  let hit = false;
  
  if (cell.dataset.hasShip === 'true') {
    cell.classList.add('hit');
    cell.style.backgroundImage = `url('${hitImg}')`;
    hitSound.currentTime = 0;
    hitSound.play();
    
    const ship = shipsArray.find(s => s.cells.includes(cell));
    ship.hits++;
    
    if (ship.hits === ship.cells.length) {
      ship.cells.forEach(c => c.classList.add('sunk'));
      const markedCount = markAdjacentCells(ship.cells, boardCells, missImg);
      
      if (markedCount > 0) {
        missSound.currentTime = 0;
        missSound.play();
      }
      
      videoPopup.style.display = 'flex';
      sinkVideo.currentTime = 0;
      sinkVideo.play();
      sinkVideo.onended = () => { 
        videoPopup.style.display = 'none'; 
      };
      
      updateShipsCounter();
      
      if (areAllShipsSunk(shipsArray)) {
        gameActive = false;
        const winner = parentBoard === 'board1' ? player2Name : player1Name;
        
        if (parentBoard === 'board1') {
          disableBoard(board1, `🏆 ПОБЕДА! ${winner} уничтожил все корабли! 🏆`);
        } else {
          disableBoard(board2, `🏆 ПОБЕДА! ${winner} уничтожил все корабли! 🏆`);
        }
        
        showTurnMessage(`🏆 ${winner} победил! 🏆`);
        return;
      }
    }
    
    hit = true;
    
  } else {
    cell.classList.add('miss');
    cell.style.backgroundImage = `url('${missImg}')`;
    missSound.currentTime = 0;
    missSound.play();
    hit = false;
  }
  
  if (!hit) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    highlightCurrentBoard();
  }
  
  if (gameActive) {
    const currentPlayerName = currentPlayer === 1 ? player1Name : player2Name;
    if (!hit) {
      showTurnMessage(`Ход переходит к ${currentPlayerName}`);
    } else {
      showTurnMessage(`Попадание! ${currentPlayerName} ходит ещё раз!`);
    }
  }
}

function highlightCurrentBoard() {
  board1.classList.remove('active-board');
  board2.classList.remove('active-board');
  
  if (gameActive) {
    if (currentPlayer === 1) {
      board2.classList.add('active-board');
      board1.classList.remove('active-board');
    } else {
      board1.classList.add('active-board');
      board2.classList.remove('active-board');
    }
  }
}

function showTurnMessage(message) {
  let msgDiv = document.getElementById('turn-message');
  if (!msgDiv) {
    msgDiv = document.createElement('div');
    msgDiv.id = 'turn-message';
    document.body.appendChild(msgDiv);
  }
  
  msgDiv.textContent = message;
  msgDiv.style.opacity = '1';
  
  setTimeout(() => {
    msgDiv.style.opacity = '0';
    setTimeout(() => {
      if(msgDiv.parentNode) msgDiv.parentNode.removeChild(msgDiv);
    }, 500);
  }, 2000);
}

function showNameInputPrompt(title, defaultValue, callback) {
  const overlay = document.createElement('div');
  overlay.id = 'name-input-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  
  const container = document.createElement('div');
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  container.style.padding = '40px 50px';
  container.style.borderRadius = '20px';
  container.style.border = '3px solid rgb(178, 135, 41)';
  container.style.textAlign = 'center';
  container.style.boxShadow = '0 0 30px rgba(178, 135, 41, 0.3)';
  
  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.color = 'white';
  titleEl.style.fontSize = '24px';
  titleEl.style.fontFamily = 'Montserrat, sans-serif';
  titleEl.style.marginBottom = '25px';
  titleEl.style.fontWeight = 'bold';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultValue || '';
  input.placeholder = 'Ваше имя';
  input.maxLength = 20;
  input.style.padding = '15px 20px';
  input.style.fontSize = '18px';
  input.style.borderRadius = '10px';
  input.style.border = '2px solid rgb(178, 135, 41)';
  input.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  input.style.color = 'black';
  input.style.fontFamily = 'Montserrat, sans-serif';
  input.style.width = '250px';
  input.style.marginBottom = '25px';
  input.style.textAlign = 'center';
  
  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '15px';
  buttons.style.justifyContent = 'center';
  
  const okBtn = document.createElement('button');
  okBtn.textContent = 'ОК';
  okBtn.style.padding = '12px 35px';
  okBtn.style.fontSize = '18px';
  okBtn.style.fontFamily = 'Montserrat, sans-serif';
  okBtn.style.backgroundColor = 'rgb(178, 135, 41)';
  okBtn.style.color = 'black';
  okBtn.style.border = 'none';
  okBtn.style.borderRadius = '10px';
  okBtn.style.cursor = 'pointer';
  okBtn.style.fontWeight = 'bold';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Отмена';
  cancelBtn.style.padding = '12px 25px';
  cancelBtn.style.fontSize = '18px';
  cancelBtn.style.fontFamily = 'Montserrat, sans-serif';
  cancelBtn.style.backgroundColor = 'transparent';
  cancelBtn.style.color = 'white';
  cancelBtn.style.border = '2px solid white';
  cancelBtn.style.borderRadius = '10px';
  cancelBtn.style.cursor = 'pointer';
  
  buttons.appendChild(okBtn);
  buttons.appendChild(cancelBtn);
  
  container.appendChild(titleEl);
  container.appendChild(input);
  container.appendChild(buttons);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  
  input.focus();
  input.select();
  
  const cleanup = () => {
    overlay.remove();
  };
  
  const handleOk = () => {
    cleanup();
    callback(input.value.trim() || 'Игрок');
  };
  
  const handleCancel = () => {
    cleanup();
    callback(null);
  };
  
  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleOk();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  });
}

// Функция для показа ошибок размещения
function showPlacementError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '120px';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translateX(-50%)';
  errorDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.95)';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '15px 30px';
  errorDiv.style.borderRadius = '10px';
  errorDiv.style.fontFamily = 'Montserrat, sans-serif';
  errorDiv.style.fontSize = '18px';
  errorDiv.style.fontWeight = 'bold';
  errorDiv.style.zIndex = '1003';
  errorDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  errorDiv.style.border = '2px solid #fff';
  errorDiv.style.animation = 'shake 0.3s';
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.style.opacity = '0';
    errorDiv.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      errorDiv.remove();
    }, 300);
  }, 2000);
}

function areAllShipsSunk(shipsArray) {
  if(!shipsArray || shipsArray.length === 0) return false;
  return shipsArray.every(ship => ship.hits === ship.cells.length);
}

function disableBoard(boardElement, message, isWinner = false) {
  if(boardElement.querySelector('.board-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.classList.add('board-overlay');
  overlay.innerText = message;
  
  boardElement.appendChild(overlay);
  boardElement.style.pointerEvents = 'none';
}

function createIntroScreen() {
  const intro = document.getElementById('intro');
  intro.innerHTML = '';
  intro.style.display = 'flex';
  
  const container = document.createElement('div');
  container.style.textAlign = 'center';
  
  const title = document.createElement('h1');
  title.textContent = 'МОРСКОЙ БОЙ';
  
  const form = document.createElement('div');
  form.style.marginBottom = '20px';
  
  const player1Div = document.createElement('div');
  player1Div.classList.add('player-input');
  
  const player1Label = document.createElement('label');
  player1Label.textContent = 'Имя первого игрока:';
  
  const player1Input = document.createElement('input');
  player1Input.type = 'text';
  player1Input.id = 'player1-name';
  player1Input.placeholder = 'Игрок 1';
  player1Input.maxLength = 20;
  
  const player1ModeSelect = document.createElement('select');
  player1ModeSelect.id = 'player1-mode';
  player1ModeSelect.style.marginLeft = '10px';
  player1ModeSelect.style.padding = '5px';
  
  const option1Random = document.createElement('option');
  option1Random.value = 'random';
  option1Random.textContent = 'Случайная расстановка';
  
  const option1Manual = document.createElement('option');
  option1Manual.value = 'manual';
  option1Manual.textContent = 'Ручная расстановка';
  
  player1ModeSelect.appendChild(option1Random);
  player1ModeSelect.appendChild(option1Manual);
  
  player1Div.appendChild(player1Label);
  player1Div.appendChild(player1Input);
  player1Div.appendChild(player1ModeSelect);
  
  const player2Div = document.createElement('div');
  player2Div.classList.add('player-input');
  
  const player2Label = document.createElement('label');
  player2Label.textContent = 'Имя второго игрока:';
  
  const player2Input = document.createElement('input');
  player2Input.type = 'text';
  player2Input.id = 'player2-name';
  player2Input.placeholder = 'Игрок 2';
  player2Input.maxLength = 20;
  
  const player2ModeSelect = document.createElement('select');
  player2ModeSelect.id = 'player2-mode';
  player2ModeSelect.style.marginLeft = '10px';
  player2ModeSelect.style.padding = '5px';
  
  const option2Random = document.createElement('option');
  option2Random.value = 'random';
  option2Random.textContent = 'Случайная расстановка';
  
  const option2Manual = document.createElement('option');
  option2Manual.value = 'manual';
  option2Manual.textContent = 'Ручная расстановка';
  
  player2ModeSelect.appendChild(option2Random);
  player2ModeSelect.appendChild(option2Manual);
  
  player2Div.appendChild(player2Label);
  player2Div.appendChild(player2Input);
  player2Div.appendChild(player2ModeSelect);
  
  const startButton = document.createElement('button');
  startButton.id = 'start-btn';
  startButton.textContent = 'НАЧАТЬ ИГРУ';
  
  startButton.onclick = () => {
    const name1 = player1Input.value.trim();
    const name2 = player2Input.value.trim();
    
    player1Name = name1 || 'Игрок 1';
    player2Name = name2 || 'Игрок 2';
    player1Mode = player1ModeSelect.value;
    player2Mode = player2ModeSelect.value;
    
    const board1Header = document.querySelector('.board-container:first-child h2');
    const board2Header = document.querySelector('.board-container:last-child h2');
    if (board1Header) board1Header.textContent = player1Name;
    if (board2Header) board2Header.textContent = player2Name;
    
    startGame();
  };
  
  form.appendChild(player1Div);
  form.appendChild(player2Div);
  
  container.appendChild(title);
  container.appendChild(form);
  container.appendChild(startButton);
  
  intro.appendChild(container);
  
  player1Input.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') player2Input.focus();
  });
  
  player2Input.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') startButton.click();
  });
}

function startGame() {
  const intro = document.getElementById('intro');
  const gameContainer = document.getElementById('game-container');
  
  intro.style.display = 'none';
  
  createBoard(board1, board1Cells);
  createBoard(board2, board2Cells);
  
  // Сбрасываем состояние игры
  currentPlayer = 1;
  gameActive = true;
  
  // Начинаем расстановку в зависимости от выбранных режимов
  if (player1Mode === 'manual') {
    gameContainer.style.display = 'flex';
    board2.style.display = 'none'; // Скрываем доску второго игрока
    startManualPlacement(1);
  } else {
    ships1 = placeShipsRandom(board1Cells);
    
    if (player2Mode === 'manual') {
      gameContainer.style.display = 'flex';
      board1.style.display = 'none'; // Скрываем доску первого игрока
      startManualPlacement(2);
    } else {
      ships2 = placeShipsRandom(board2Cells);
      gameContainer.style.display = 'flex';
      board1.style.display = 'grid';
      board2.style.display = 'grid';
      startGameAfterSetup();
    }
  }
  
  // Создаем счетчик
  updateShipsCounter();
}

function scaleScene() {
  const scene = document.getElementById('scene');
  const baseWidth = 1430;
  const baseHeight = 900;
  const scaleX = window.innerWidth / baseWidth;
  const scaleY = window.innerHeight / baseHeight;
  const scale = Math.max(0.5, Math.min(scaleX, scaleY));
  scene.style.transform = `scale(${scale})`;
}

function restoreShipsVisibility() {
  // Восстанавливаем видимость кораблей на board1
  ships1.forEach(ship => {
    ship.cells.forEach(cell => {
      cell.style.backgroundImage = `url('${board1HitImage}')`;
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundPosition = 'center';
      cell.style.backgroundRepeat = 'no-repeat';
    });
  });
  
  // Восстанавливаем видимость кораблей на board2
  ships2.forEach(ship => {
    ship.cells.forEach(cell => {
      cell.style.backgroundImage = `url('${board2HitImage}')`;
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundPosition = 'center';
      cell.style.backgroundRepeat = 'no-repeat';
    });
  });
}

// Функция для получения CSS-свойств изображения корабля в зависимости от ориентации и позиции
function getShipImageStyle(shipSize, orientation, position, isFirst, isLast) {
  // Используем те же изображения, что и для игры
  const baseImage = currentSetupPlayer === 1 ? board1HitImage : board2HitImage;
  
  // Можно использовать разные изображения для разных частей корабля
  // если у вас есть спрайты или отдельные изображения
  let rotation = orientation === 'horizontal' ? '0deg' : '90deg';
  
  return {
    backgroundImage: `url('${baseImage}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transform: orientation === 'vertical' ? 'rotate(90deg)' : 'none',
    transformOrigin: 'center'
  };
}

function validateShips() {
  const board1ShipCells = board1Cells.filter(c => c.dataset.hasShip === 'true');
  const board2ShipCells = board2Cells.filter(c => c.dataset.hasShip === 'true');
  
  console.log('Board1 ship cells:', board1ShipCells.length);
  console.log('Board2 ship cells:', board2ShipCells.length);
  console.log('ships1 array:', ships1.length);
  console.log('ships2 array:', ships2.length);
}

  // Создаем счетчик
  updateShipsCounter();

window.addEventListener('resize', scaleScene);

function initModeSelect() {
  const modeSelect = document.getElementById('mode-select');
  const localBtn = document.getElementById('local-btn');
  const onlineBtn = document.getElementById('online-btn');
  const onlineMenu = document.getElementById('online-menu');
  const createRoomBtn = document.getElementById('create-room-btn');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const roomIdInput = document.getElementById('room-id-input');
  const backToMenuBtn = document.getElementById('back-to-menu-btn');
  const waitingRoom = document.getElementById('waiting-room');
  const cancelWaitBtn = document.getElementById('cancel-wait-btn');
  const copyRoomIdBtn = document.getElementById('copy-room-id');

  localBtn.addEventListener('click', () => {
    isOnlineMode = false;
    isGameModeSelected = true;
    modeSelect.style.display = 'none';
    createIntroScreen();
  });

  onlineBtn.addEventListener('click', () => {
    modeSelect.style.display = 'none';
    onlineMenu.style.display = 'flex';
  });

  backToMenuBtn.addEventListener('click', () => {
    onlineMenu.style.display = 'none';
    modeSelect.style.display = 'flex';
  });

  createRoomBtn.addEventListener('click', () => {
    isGameModeSelected = true;
    showNameInputPrompt('Введите ваше имя:', 'Игрок 1', (name) => {
      if (name) {
        player1Name = name;
        connectToServer();
      }
    });
  });

  joinRoomBtn.addEventListener('click', () => {
    const roomIdVal = roomIdInput.value.trim().toUpperCase();
    if (!roomIdVal) {
      alert('Введите ID комнаты');
      return;
    }
    isGameModeSelected = true;
    roomId = roomIdVal;
    showNameInputPrompt('Введите ваше имя:', 'Игрок 1', (name) => {
      if (name) {
        player1Name = name;
        connectToServer();
      }
    });
  });

  cancelWaitBtn.addEventListener('click', () => {
    disconnectFromServer();
    waitingRoom.style.display = 'none';
    onlineMenu.style.display = 'flex';
  });

  copyRoomIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
      copyRoomIdBtn.textContent = 'Скопировано!';
      copyRoomIdBtn.classList.add('copied');
      setTimeout(() => {
        copyRoomIdBtn.textContent = 'Копировать';
        copyRoomIdBtn.classList.remove('copied');
      }, 2000);
    });
  });
}

function connectToServer() {
  const waitingRoom = document.getElementById('waiting-room');
  const roomIdText = document.getElementById('room-id-text');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const waitingTitle = document.getElementById('waiting-title');

  waitingRoom.style.display = 'flex';
  statusIndicator.classList.remove('connected');
  statusText.textContent = 'Подключение...';

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('Connected to server');
    statusText.textContent = 'Соединение установлено';
    statusIndicator.classList.add('connected');

    if (roomId) {
      socket.send(JSON.stringify({
        type: 'join-room',
        roomId: roomId,
        playerName: player1Name
      }));
      waitingTitle.textContent = 'Подключение к комнате...';
    } else {
      socket.send(JSON.stringify({
        type: 'create-room',
        playerName: player1Name
      }));
      waitingTitle.textContent = 'Ожидание игрока...';
    }
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message.type);
    handleServerMessage(message);
  };

  socket.onclose = (event) => {
    console.log('Disconnected from server');
    resetToMainMenu();
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    alert('Ошибка подключения к серверу');
  };
}

function resetToMainMenu() {
  ships1 = [];
  ships2 = [];
  board1Cells = [];
  board2Cells = [];
  gameActive = false;
  gameStarted = false;
  isSetupPhase = false;
  isOnlineMode = false;
  currentPlayer = null;
  isMyTurn = false;

  // Удаляем счетчик кораблей
  const counterDiv = document.getElementById('ships-counter');
  if (counterDiv) counterDiv.remove();

  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.style.display = 'none';

  const waitingRoom = document.getElementById('waiting-room');
  if (waitingRoom) waitingRoom.style.display = 'none';

  const disconnectOverlay = document.getElementById('disconnect-overlay');
  if (disconnectOverlay) disconnectOverlay.style.display = 'none';

  document.getElementById('mode-select').style.display = 'flex';
}

function showDisconnectPopup(playerName) {
  const overlay = document.createElement('div');
  overlay.id = 'disconnect-popup';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.flexDirection = 'column';

  overlay.innerHTML = `
    <div style="color: white; font-size: clamp(32px, 6vw, 48px); font-family: Montserrat; margin-bottom: 20px; text-align: center; text-shadow: 2px 2px 8px black;">
      ${playerName} покинул игру
    </div>
    <div style="color: #aaa; font-size: clamp(18px, 3vw, 24px); font-family: Montserrat; margin-bottom: 40px;">
      Обновите страницу для новой игры
    </div>
    <button id="disconnect-back-btn" style="
      font-family: Montserrat;
      padding: 15px 30px;
      font-size: clamp(18px, 3vw, 24px);
      background: #4e1a1c;
      color: white;
      border: 2px solid #8b0000;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
    ">
      Вернуться в меню
    </button>
  `;

  document.body.appendChild(overlay);

  document.getElementById('disconnect-back-btn').addEventListener('click', () => {
    overlay.remove();
    resetToMainMenu();
  });
}

function disconnectFromServer() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'disconnect' }));
    socket.close();
  }
  socket = null;
  roomId = null;
  myPlayerNum = null;
  isOnlineMode = false;
  gameStarted = false;
}

function handleServerMessage(message) {
  const waitingRoom = document.getElementById('waiting-room');
  const waitingTitle = document.getElementById('waiting-title');

  switch (message.type) {
    case 'room-created':
      console.log('room-created received:', message);
      roomId = message.roomId;
      myPlayerNum = 1;
      isOnlineMode = true;
      isGameModeSelected = true;
      document.getElementById('room-id-text').textContent = roomId;
      waitingTitle.textContent = 'Ожидание игрока...';
      break;

    case 'room-joined':
      console.log('room-joined received:', message);
      roomId = message.roomId;
      myPlayerNum = 2;
      isOnlineMode = true;
      isGameModeSelected = true;
      document.getElementById('room-id-text').textContent = roomId;
      waitingTitle.textContent = 'Подключение...';
      break;

    case 'player-joined':
      console.log('player-joined received, myPlayerNum:', myPlayerNum);
      console.log('player-joined message:', message);
      opponentConnected = true;
      
      if (myPlayerNum === 1) {
        player2Name = message.playerName || 'Игрок 2';
      } else {
        player1Name = message.playerName || 'Игрок 1';
        player2Name = message.player2Name || 'Игрок 2';
        
        console.log('Player 2 joined, player1Name:', player1Name, 'player2Name:', player2Name);
        createBoard(board1, board1Cells);
        createBoard(board2, board2Cells);
      }
      
      waitingTitle.textContent = 'Игрок подключился!';
      
      const waitingRoomEl = document.getElementById('waiting-room');
      console.log('waitingRoom display before:', waitingRoomEl.style.display);
      
      setTimeout(() => {
        try {
          console.log('Going to startLocalGameSetup, myPlayerNum:', myPlayerNum);
          
          const waitingRoomEl = document.getElementById('waiting-room');
          const modeSelectEl = document.getElementById('mode-select');
          const onlineMenuEl = document.getElementById('online-menu');
          const gameContainerEl = document.getElementById('game-container');
          
          waitingRoomEl.style.display = 'none';
          modeSelectEl.style.display = 'none';
          onlineMenuEl.style.display = 'none';
          gameContainerEl.style.display = 'flex';
          
          if (myPlayerNum === 2) {
            startManualPlacement(2);
          } else {
            startLocalGameSetup();
          }
        } catch (e) {
          console.error('Error in startLocalGameSetup:', e);
        }
      }, 1500);
      break;

    case 'error':
      alert(message.message);
      disconnectFromServer();
      waitingRoom.style.display = 'none';
      document.getElementById('online-menu').style.display = 'flex';
      break;

    case 'ships-status':
      opponentReady = message.opponentReady;
      if (message.bothReady) {
        waitingTitle.textContent = 'Оба игрока готовы!';
        const waitingOpponent = document.getElementById('waiting-opponent');
        if (waitingOpponent) waitingOpponent.remove();
      } else {
        waitingTitle.textContent = 'Ожидаем готовности соперника...';
      }
      break;

    case 'opponent-ships':
      console.log('Received opponent-ships, myPlayerNum:', myPlayerNum);
      if (myPlayerNum === 1) {
        applyReceivedShips(message.ships, board2Cells, ships2, board2HitImage);
      } else {
        applyReceivedShips(message.ships, board1Cells, ships1, board1HitImage);
      }
      break;

    case 'game-start':
      gameStarted = true;
      isMyTurn = (message.currentTurn === myPlayerNum);
      document.getElementById('waiting-room').style.display = 'none';
      
      const waitingOpponent = document.getElementById('waiting-opponent');
      if (waitingOpponent) waitingOpponent.remove();
      
      if (message.opponentShips) {
        if (myPlayerNum === 1) {
          applyReceivedShips(message.opponentShips, board2Cells, ships2, board2HitImage);
        } else {
          applyReceivedShips(message.opponentShips, board1Cells, ships1, board1HitImage);
        }
      }
      
      startOnlineGame();
      saveGameState(); // Сохраняем когда игра началась
      break;

    case 'opponent-move':
      handleOpponentMove(message);
      break;

    case 'your-turn':
      isMyTurn = true;
      showTurnMessage('Ваш ход!');
      break;

    case 'game-over':
      const winnerName = message.winnerPlayerNum === 1 ? player1Name : player2Name;
      showOnlineWin(winnerName);
      break;

    case 'player-disconnected':
      // Игрок = 1 → ушёл игрок1, показываем player2Name (я остался)
      // Игрок = 2 → ушёл игрок2, показываем player1Name (я остался)
      const disconnectedPlayerName = message.playerNum === 1 ? player1Name : player2Name;
      showDisconnectPopup(disconnectedPlayerName);
      break;

case 'room-reconnected':
    case 'player-reconnected':
    case 'sync-state':
      alert('Соединение прервано. Обновите страницу!');
      resetToMainMenu();
      break;

    case 'rematch-request':
      showRematchRequest(message.from);
      break;

    case 'rematch-accepted':
      resetGameForRematch();
      break;
  }
}

function startLocalGameSetup() {
  console.log('=== startLocalGameSetup called ===');
  try {
    const gameContainer = document.getElementById('game-container');
    const waitingRoom = document.getElementById('waiting-room');
    const modeSelect = document.getElementById('mode-select');
    const onlineMenu = document.getElementById('online-menu');
    
    console.log('Before: waitingRoom display:', waitingRoom.style.display);
    console.log('Before: modeSelect display:', modeSelect.style.display);
    console.log('Before: onlineMenu display:', onlineMenu.style.display);
    console.log('Before: gameContainer display:', gameContainer.style.display);
    
    waitingRoom.style.display = 'none';
    modeSelect.style.display = 'none';
    onlineMenu.style.display = 'none';
    gameContainer.style.display = 'flex';
    
    createBoard(board1, board1Cells);
    createBoard(board2, board2Cells);

    player1Mode = 'manual';
    player2Mode = 'manual';
    
    currentSetupPlayer = 1;
    
    const infoDiv = document.getElementById('placement-info');
    if (infoDiv) infoDiv.remove();
    const waitingOpponent = document.getElementById('waiting-opponent');
    if (waitingOpponent) waitingOpponent.remove();
    
    board2.style.display = 'none';
    startManualPlacement(1);
    
    console.log('After: gameContainer display:', gameContainer.style.display);
    console.log('After: board1 display:', board1.style.display);
    console.log('After: board2 display:', board2.style.display);
    console.log('startLocalGameSetup completed');
  } catch (e) {
    console.error('Error in startLocalGameSetup:', e);
  }
}

function startOnlineGame() {
  const gameContainer = document.getElementById('game-container');
  const waitingRoom = document.getElementById('waiting-room');
  
  if (waitingRoom) waitingRoom.style.display = 'none';
  gameContainer.style.display = 'flex';

  board1.style.display = 'grid';
  board2.style.display = 'grid';

  if (isOnlineMode && myPlayerNum === 2 && board1Cells.length === 0) {
    createBoard(board1, board1Cells);
    createBoard(board2, board2Cells);
  }

  hideAllShipsForGame();

  const allCells = board1Cells.concat(board2Cells);
  allCells.forEach(cell => {
    cell.removeEventListener('click', handleClick);
    cell.addEventListener('click', handleOnlineClick);
  });

  gameActive = true;
  updateShipsCounter();

  if (isOnlineMode) {
    const player1MyLabel = document.getElementById('player1-my-label');
    const player2EnemyLabel = document.getElementById('player2-enemy-label');
    const player2MyLabel = document.getElementById('player2-my-label');
    const player1EnemyLabel = document.getElementById('player1-enemy-label');
    
    if (myPlayerNum === 1) {
      player1MyLabel.style.display = 'block';
      player1MyLabel.textContent = 'ВЫ';
      player2EnemyLabel.style.display = 'block';
      player2EnemyLabel.textContent = 'СОПЕРНИК';
      document.getElementById('player1-title').textContent = player1Name;
      document.getElementById('player2-title').textContent = player2Name;
      
      restoreShipsForPlayer(board1Cells, ships1, board1HitImage);
    } else {
      player2MyLabel.style.display = 'block';
      player2MyLabel.textContent = 'ВЫ';
      player1EnemyLabel.style.display = 'block';
      player1EnemyLabel.textContent = 'СОПЕРНИК';
      document.getElementById('player1-title').textContent = player1Name;
      document.getElementById('player2-title').textContent = player2Name;
      
      restoreShipsForPlayer(board2Cells, ships2, board2HitImage);
    }
  }

  if (isMyTurn) {
    showTurnMessage('Ваш ход!');
  } else {
    showTurnMessage('Ход соперника...');
  }

  highlightOnlineBoard();
}

function restoreShipsForPlayer(boardCells, ships, hitImg) {
  if (!ships || ships.length === 0) return;
  ships.forEach(ship => {
    ship.cells.forEach(cell => {
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      const targetCell = boardCells[y * boardSize + x];
      if (targetCell) {
        targetCell.style.backgroundImage = `url('${hitImg}')`;
        targetCell.style.backgroundSize = 'cover';
        targetCell.style.backgroundPosition = 'center';
        targetCell.style.backgroundRepeat = 'no-repeat';
      }
    });
  });
}

function applyReceivedShips(shipsData, boardCells, shipsArray, hitImg) {
  if (!shipsData || !boardCells || boardCells.length === 0) {
    console.log('Cannot apply ships: missing data or empty board');
    return;
  }
  
  shipsArray.length = 0;
  boardCells.forEach(cell => {
    delete cell.dataset.hasShip;
    cell.style.backgroundImage = '';
    cell.classList.remove('ship-placed');
  });
  
  shipsData.forEach(shipCoords => {
    const shipCells = [];
    shipCoords.forEach(coord => {
      const cell = boardCells[coord.y * boardSize + coord.x];
      if (cell) {
        cell.dataset.hasShip = 'true';
        cell.classList.add('ship-placed');
        cell.style.backgroundImage = `url('${hitImg}')`;
        cell.style.backgroundSize = 'cover';
        cell.style.backgroundPosition = 'center';
        cell.style.backgroundRepeat = 'no-repeat';
        shipCells.push(cell);
      }
    });
    if (shipCells.length > 0) {
      shipsArray.push({ cells: shipCells, hits: 0 });
    }
  });
  
  console.log('Applied opponent ships:', shipsArray.length, 'ships');
}

function handleOnlineClick(e) {
  if (!gameActive || !isMyTurn) return;

  const cell = e.target;
  const parentBoard = cell.parentElement.id;

  const enemyBoard = myPlayerNum === 1 ? 'board2' : 'board1';
  if (parentBoard !== enemyBoard) return;
  if (cell.classList.contains('hit') || cell.classList.contains('miss')) return;

  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);

  const enemyShips = myPlayerNum === 1 ? ships2 : ships1;
  const hitImg = myPlayerNum === 1 ? board2HitImage : board1HitImage;
  const missImg = myPlayerNum === 1 ? board2MissImage : board1MissImage;

  const isHit = cell.dataset.hasShip === 'true';
  
  if (isHit) {
    cell.classList.add('hit');
    cell.style.backgroundImage = `url('${hitImg}')`;
    hitSound.currentTime = 0;
    hitSound.play();

    const ship = enemyShips.find(s => s.cells.includes(cell));
    if (ship) {
      ship.hits++;
      
      if (ship.hits === ship.cells.length) {
        ship.cells.forEach(c => c.classList.add('sunk'));
        const markedCount = markAdjacentCellsForOnline(ship.cells, parentBoard === 'board1' ? board1Cells : board2Cells, missImg);
        
        if (markedCount > 0) {
          missSound.currentTime = 0;
          missSound.play();
        }
        
        videoPopup.style.display = 'flex';
        sinkVideo.currentTime = 0;
        sinkVideo.play();
        sinkVideo.onended = () => { videoPopup.style.display = 'none'; };

        updateShipsCounter();

        if (areAllShipsSunk(enemyShips)) {
          gameActive = false;
          const winnerName = myPlayerNum === 1 ? player1Name : player2Name;
          
          socket.send(JSON.stringify({ type: 'game-over', winner: winnerName }));
          showOnlineWin(winnerName);
          return;
        }
      }
    }

    socket.send(JSON.stringify({
      type: 'player-move',
      x: x,
      y: y,
      hit: true,
      sunk: ship && ship.hits === ship.cells.length
    }));

    showTurnMessage('Попадание! Ещё ход!');
    highlightOnlineBoard();
    saveGameState();

  } else {
    cell.classList.add('miss');
    cell.style.backgroundImage = `url('${missImg}')`;
    missSound.currentTime = 0;
    missSound.play();

    socket.send(JSON.stringify({
      type: 'player-move',
      x: x,
      y: y,
      hit: false
    }));

    isMyTurn = false;
    showTurnMessage('Мимо! Ход переходит к сопернику');
    highlightOnlineBoard();
    saveGameState();
  }
}

function handleOpponentMove(message) {
  const myBoard = myPlayerNum === 1 ? board1 : board2;
  const myCells = myPlayerNum === 1 ? board1Cells : board2Cells;
  const myShips = myPlayerNum === 1 ? ships1 : ships2;
  const hitImg = myPlayerNum === 1 ? board1HitImage : board2HitImage;
  const missImg = myPlayerNum === 1 ? board1MissImage : board2MissImage;

  const cell = myCells[message.y * boardSize + message.x];
  if (!cell || cell.classList.contains('hit') || cell.classList.contains('miss')) return;

  if (message.hit) {
    cell.classList.add('hit', 'ship-hit');
    cell.style.backgroundImage = `url('${hitImg}')`;
    hitSound.currentTime = 0;
    hitSound.play();

    if (message.sunk) {
      const ship = myShips.find(s => s.cells.includes(cell));
      if (ship) {
        ship.hits = ship.cells.length;
        ship.cells.forEach(c => {
          c.classList.remove('ship-hit');
          c.classList.add('sunk');
        });
        markAdjacentCellsForOnline(ship.cells, myCells, missImg);

        videoPopup.style.display = 'flex';
        sinkVideo.currentTime = 0;
        sinkVideo.play();
        sinkVideo.onended = () => { videoPopup.style.display = 'none'; };

        if (areAllShipsSunk(myShips)) {
          gameActive = false;
          const winnerName = myPlayerNum === 1 ? player2Name : player1Name;
          showOnlineWin(winnerName);
          return;
        }
      }
    }

    showTurnMessage('Соперник попал! Его очередь ходить снова');
  } else {
    cell.classList.add('miss');
    cell.style.backgroundImage = `url('${missImg}')`;
    missSound.currentTime = 0;
    missSound.play();
    
    cell.classList.add('miss-highlight');
    setTimeout(() => cell.classList.remove('miss-highlight'), 3000);
    
    showTurnMessage('Соперник промахнулся! Ваш ход');
    isMyTurn = true;
    highlightOnlineBoard();
  }

  updateShipsCounter();
  saveGameState();
}

function markAdjacentCellsForOnline(shipCells, boardCells, missImg) {
  const shipCoords = shipCells.map(cell => ({
    x: parseInt(cell.dataset.x),
    y: parseInt(cell.dataset.y)
  }));

  let minX = Math.max(0, Math.min(...shipCoords.map(c => c.x)) - 1);
  let maxX = Math.min(boardSize - 1, Math.max(...shipCoords.map(c => c.x)) + 1);
  let minY = Math.max(0, Math.min(...shipCoords.map(c => c.y))) - 1;
  let maxY = Math.min(boardSize - 1, Math.max(...shipCoords.map(c => c.y)) + 1);

  let markedCount = 0;

  console.log('markAdjacentCellsForOnline:', { minX, maxX, minY, maxY, missImg });

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = boardCells[y * boardSize + x];
      if (!cell) {
        console.log('No cell at:', y, x);
        continue;
      }
      const isShipCell = shipCoords.some(coord => coord.x === x && coord.y === y);

      if (!isShipCell && !cell.classList.contains('hit') && !cell.classList.contains('miss')) {
        cell.classList.add('miss');
        cell.style.backgroundImage = `url('${missImg}')`;
        console.log('Marked miss at:', x, y);
        markedCount++;
      }
    }
  }

  console.log('Total marked:', markedCount);

  if (markedCount > 0 && isOnlineMode) {
    saveGameState();
  }

  return markedCount;
}

function highlightOnlineBoard() {
  console.log('highlightOnlineBoard:', { myPlayerNum, currentPlayer, isMyTurn, gameActive });
  
  board1.classList.remove('active-board');
  board2.classList.remove('active-board');

  if (!gameActive) return;

  const enemyBoard = myPlayerNum === 1 ? board2 : board1;
  enemyBoard.classList.add('active-board');

  const myBoard = myPlayerNum === 1 ? board1 : board2;
  myBoard.style.pointerEvents = 'none';
  enemyBoard.style.pointerEvents = isMyTurn ? 'auto' : 'none';
}

function showOnlineWin(winnerName) {
  gameActive = false;
  clearGameState();
  
  const isWinner = (myPlayerNum === 1 && winnerName === player1Name) || 
                 (myPlayerNum === 2 && winnerName === player2Name);
  
  const overlay = document.createElement('div');
  overlay.classList.add('board-overlay');
  overlay.style.zIndex = '1000';
  overlay.style.position = 'fixed';
  overlay.style.top = '50%';
  overlay.style.left = '50%';
  overlay.style.transform = 'translate(-50%, -50%)';
  
  if (isWinner) {
    overlay.innerHTML = `🏆 Поздравляем, Вы победили! 🏆<br><br><button id="rematch-btn" style="padding: 10px 20px; font-size: 18px; cursor: pointer; background: gold; border: none; border-radius: 5px; color: black;">Предложить реванш</button>`;
    overlay.style.color = 'rgb(178, 135, 41)';
    overlay.style.border = '2px solid rgb(178, 135, 41)';
  } else {
    overlay.innerHTML = `💀 Поражение. ${winnerName} победил. 💀<br><br><button id="rematch-btn" style="padding: 10px 20px; font-size: 18px; cursor: pointer; background: #444; color: white; border: none; border-radius: 5px;">Предложить реванш</button>`;
    overlay.style.color = '#ff4444';
    overlay.style.border = '2px solid #ff4444';
  }
  
  document.body.appendChild(overlay);

  document.getElementById('rematch-btn').addEventListener('click', function() {
    socket.send(JSON.stringify({ type: 'rematch-request' }));
    this.textContent = 'Ожидаем ответа...';
    this.disabled = true;
    this.style.background = '#888';
    this.style.cursor = 'default';
  });

  showTurnMessage(isWinner ? `🏆 Поздравляем, Вы победили! 🏆` : `💀 Поражение. ${winnerName} победил. 💀`);
}

function handleGameOver(winnerName) {
  showOnlineWin(winnerName);
}

function showDisconnectOverlay(disconnectedAt) {
  const overlay = document.getElementById('disconnect-overlay');
  overlay.style.display = 'flex';
  
  const timerEl = document.getElementById('reconnect-timer');
  const reconnectBtn = document.getElementById('reconnect-btn');
  
  let countdownInterval;
  
  const updateTimer = () => {
    if (!disconnectedAt) {
      timerEl.textContent = '';
      return;
    }
    
    const elapsed = Date.now() - disconnectedAt;
    const remaining = Math.max(0, 5 * 60 * 1000 - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (remaining <= 0) {
      timerEl.textContent = 'Время вышло';
      clearInterval(countdownInterval);
      reconnectBtn.style.display = 'block';
      reconnectBtn.textContent = 'Выйти в меню';
      reconnectBtn.onclick = () => {
        overlay.style.display = 'none';
        document.getElementById('mode-select').style.display = 'flex';
        resetGameState();
      };
    } else {
      timerEl.textContent = `У вас есть ${minutes}:${seconds.toString().padStart(2, '0')} чтобы вернуться`;
    }
  };
  
  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
  
  reconnectBtn.style.display = 'block';
  reconnectBtn.textContent = 'Ждать';
  reconnectBtn.onclick = () => {
    clearInterval(countdownInterval);
  };
}

function showRematchRequest(fromName) {
  const overlay = document.getElementById('rematch-overlay');
  const title = document.getElementById('rematch-title');
  const text = document.getElementById('rematch-text');
  const acceptBtn = document.getElementById('accept-rematch-btn');
  const declineBtn = document.getElementById('decline-rematch-btn');

  title.textContent = 'Реванш?';
  text.textContent = `${fromName} предлагает реванш`;
  overlay.style.display = 'flex';

  acceptBtn.onclick = () => {
    overlay.style.display = 'none';
    socket.send(JSON.stringify({ type: 'rematch-accept' }));
  };

  declineBtn.onclick = () => {
    overlay.style.display = 'none';
  };
}

function resetGameForRematch() {
  ships1 = [];
  ships2 = [];
  board1Cells = [];
  board2Cells = [];
  gameActive = true;
  myShipsReady = false;
  opponentReady = false;
  gameStarted = false;
  isMyTurn = false;

  const overlays = document.querySelectorAll('.board-overlay');
  overlays.forEach(o => o.remove());

  document.getElementById('disconnect-overlay').style.display = 'none';
  document.getElementById('rematch-overlay').style.display = 'none';
  document.getElementById('waiting-room').style.display = 'none';
  document.getElementById('mode-select').style.display = 'none';

  if (isOnlineMode) {
    startOnlineGameSetupForRematch();
  } else {
    startLocalGameSetup();
  }
}

function startOnlineGameSetupForRematch() {
  const gameContainer = document.getElementById('game-container');
  gameContainer.style.display = 'flex';
  
  createBoard(board1, board1Cells);
  createBoard(board2, board2Cells);
  
  const myBoard = myPlayerNum === 1 ? board1 : board2;
  const enemyBoard = myPlayerNum === 1 ? board2 : board1;
  const myCells = myPlayerNum === 1 ? board1Cells : board2Cells;
  
  player1Mode = 'manual';
  player2Mode = 'manual';
  currentSetupPlayer = myPlayerNum;
  
  const infoDiv = document.getElementById('placement-info');
  if (infoDiv) infoDiv.remove();
  const waitingOpponent = document.getElementById('waiting-opponent');
  if (waitingOpponent) waitingOpponent.remove();
  
  myBoard.style.display = 'block';
  enemyBoard.style.display = 'block';
  
  startManualPlacement(myPlayerNum);
}

function resetGameState() {
  ships1 = [];
  ships2 = [];
  board1Cells = [];
  board2Cells = [];
  gameActive = true;
  myPlayerNum = null;
  roomId = null;
  opponentConnected = false;
  opponentReady = false;
  myShipsReady = false;
  gameStarted = false;
  isMyTurn = false;
  waitingForOpponent = false;
  rematchRequested = false;
  clearGameState();
}

function showResumeGamePrompt() {
  const savedState = loadGameState();
  if (!savedState) return;
  
  // Скрываем все экраны
  document.getElementById('mode-select').style.display = 'none';
  document.getElementById('online-menu').style.display = 'none';
  document.getElementById('waiting-room').style.display = 'none';
  document.getElementById('intro').style.display = 'none';
  
  const overlay = document.createElement('div');
  overlay.id = 'resume-game-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.flexDirection = 'column';
  
  overlay.innerHTML = `
    <div style="color: white; font-size: 28px; font-family: Montserrat; margin-bottom: 20px; text-align: center;">
      Обнаружена сохранённая игра
    </div>
    <div style="color: #aaa; font-size: 18px; font-family: Montserrat; margin-bottom: 30px; text-align: center;">
      Комната: ${savedState.roomId}<br>
      Вы: ${savedState.myPlayerNum === 1 ? savedState.player1Name : savedState.player2Name}
    </div>
    <div style="display: flex; gap: 20px;">
      <button id="resume-game-btn" style="padding: 15px 30px; font-size: 20px; cursor: pointer; background: gold; border: none; border-radius: 10px; color: black; font-weight: bold; font-family: Montserrat;">
        Продолжить игру
      </button>
      <button id="discard-game-btn" style="padding: 15px 30px; font-size: 20px; cursor: pointer; background: #444; border: none; border-radius: 10px; color: white; font-family: Montserrat;">
        Начать заново
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  document.getElementById('resume-game-btn').addEventListener('click', () => {
    overlay.remove();
    resumeSavedGame(savedState);
  });
  
  document.getElementById('discard-game-btn').addEventListener('click', () => {
    clearGameState();
    overlay.remove();
    initModeSelect();
  });
}

function resumeSavedGame(savedState) {
  // Сначала подключаемся к серверу
  isGameModeSelected = true;  // Отмечаем, что режим уже выбран
  player1Name = savedState.player1Name;
  player2Name = savedState.player2Name;
  roomId = savedState.roomId;  // Используем сохранённый ID комнаты
  connectToServer();
}

window.addEventListener('load', () => {
  // Просто показываем главное меню (сохранённая игра игнорируется)
  initModeSelect();
  scaleScene();
});