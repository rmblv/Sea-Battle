# Морской бой (Battleship)

## Запуск

- Локально: `node server.js` → открыть `http://localhost:8080`
- Или открыть `index.html` напрямую (без мультиплеера)
- Deploy: Dockerfile готов для Railway

## Архитектура

- `index.html` + `style.css` + `script.js`
- `server.js`: HTTP сервер + WebSocket для мультиплеера
- Состояние игры в памяти: `ships1`, `ships2`, `currentPlayer`, `gameActive`
- Корабли в DOM: `cell.dataset.hasShip = 'true'`

## Известные проблемы

- При ручной расстановке: R — поворот, клик — разместить

## Нет

- Нет тестов
- Нет линтера
