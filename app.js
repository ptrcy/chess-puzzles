// Global variables
let board = null;
let game = new Chess();
let positions = [];
let currentPositionIndex = -1;
let moveHistory = [];
let stockfish = null;
let analyzing = false;
let favorites = new Set();
let originalPosition = null;

// Initialize the application
$(document).ready(function() {
    initializeBoard();
    setupEventHandlers();
    loadFavorites();
    initStockfish();
});

// Initialize the chess board
function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('myBoard', config);
    $(window).resize(board.resize);
}

// Setup event handlers
function setupEventHandlers() {
    $('#fenFileInput').on('change', handleFileUpload);
    $('#prevBtn').on('click', () => navigatePosition(-1));
    $('#nextBtn').on('click', () => navigatePosition(1));
    $('#favoriteBtn').on('click', toggleFavorite);
    $('#flipBtn').on('click', () => board.flip());
    $('#resetBtn').on('click', resetPosition);
    $('#analyzeBtn').on('click', startAnalysis);
    $('#stopAnalysisBtn').on('click', stopAnalysis);
    $('#filterBtn').on('click', filterFavorites);
    $('#clearFilterBtn').on('click', () => loadFavorites());

    // Go to position input
    $('#goToBtn').on('click', () => {
        const num = parseInt($('#goToInput').val(), 10);
        if (!isNaN(num)) goToPosition(num);
    });
    $('#goToInput').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            const num = parseInt($(this).val(), 10);
            if (!isNaN(num)) goToPosition(num);
        }
    });

    // Tab switching
    $('.tab').on('click', function() {
        const tabName = $(this).data('tab');
        $('.tab').removeClass('active');
        $(this).addClass('active');
        $('.tab-content').removeClass('active');
        $(`#${tabName}Tab`).addClass('active');
    });
}

// Handle file upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        positions = lines.filter(line => {
            try {
                const tempGame = new Chess();
                tempGame.load(line.trim());
                return true;
            } catch {
                return false;
            }
        });
        
        if (positions.length > 0) {
            currentPositionIndex = 0;
            loadPosition(0);
            showStatus(`Loaded ${positions.length} positions`, 'success');
        } else {
            showStatus('No valid FEN positions found', 'error');
        }
    };
    reader.readAsText(file);
}

// Load a position by index
function loadPosition(index, direction = 1) {
    if (index < 0 || index >= positions.length) return;

    const fen = positions[index];
    try {
        const loaded = game.load(fen);
        if (!loaded) {
            throw new Error('Invalid FEN');
        }
    } catch (e) {
        // Bad FEN, skip to next valid position
        showStatus(`Skipping invalid FEN at position ${index + 1}`, 'error');
        const nextIndex = index + direction;
        if (nextIndex >= 0 && nextIndex < positions.length) {
            currentPositionIndex = nextIndex;
            loadPosition(nextIndex, direction);
        }
        return;
    }

    board.position(fen);
    originalPosition = fen;
    moveHistory = [];

    updateUI();
    updateMoveList();

    if (analyzing) {
        analyzePosition();
    }
}

// Navigate through positions
function navigatePosition(direction) {
    const newIndex = currentPositionIndex + direction;
    if (newIndex >= 0 && newIndex < positions.length) {
        currentPositionIndex = newIndex;
        loadPosition(newIndex, direction);
    }
}

// Jump to a specific position by number
function goToPosition(positionNumber) {
    const index = positionNumber - 1; // Convert 1-based to 0-based
    if (index >= 0 && index < positions.length) {
        currentPositionIndex = index;
        loadPosition(index);
    } else {
        showStatus(`Position ${positionNumber} not found (1-${positions.length})`, 'error');
    }
}

// Reset to original position
function resetPosition() {
    if (originalPosition) {
        game.load(originalPosition);
        board.position(originalPosition);
        moveHistory = [];
        updateMoveList();
        updateUI();
    }
}

// Update UI elements
function updateUI() {
    // Update position counter
    if (positions.length > 0) {
        $('#positionCounter').text(`${currentPositionIndex + 1} / ${positions.length}`);
        $('#prevBtn').prop('disabled', currentPositionIndex === 0);
        $('#nextBtn').prop('disabled', currentPositionIndex === positions.length - 1);
        $('#favoriteBtn').prop('disabled', false);
        $('#resetBtn').prop('disabled', false);
    }
    
    // Update current FEN
    $('#currentFen').text(game.fen());
    
    // Update favorite button
    const currentFen = positions[currentPositionIndex];
    if (favorites.has(currentFen)) {
        $('#favoriteBtn').addClass('active').html('★ Favorited');
    } else {
        $('#favoriteBtn').removeClass('active').html('☆ Favorite');
    }
}

// Chess.js integration for legal moves
function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    });
    
    if (move === null) return 'snapback';
    
    moveHistory.push(move);
    updateMoveList();
    updateUI();
    
    if (analyzing) {
        analyzePosition();
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

// Update move list display
function updateMoveList() {
    const $moveList = $('#moveList');
    $moveList.empty();
    
    let moveText = '';
    moveHistory.forEach((move, index) => {
        if (index % 2 === 0) {
            moveText += `${Math.floor(index/2) + 1}. `;
        }
        moveText += `${move.san} `;
        
        const $move = $(`<span class="move">${move.san}</span>`);
        $move.on('click', () => goToMove(index));
        $moveList.append($move);
    });
}

// Go to a specific move
function goToMove(moveIndex) {
    game.load(originalPosition);
    for (let i = 0; i <= moveIndex; i++) {
        game.move(moveHistory[i]);
    }
    board.position(game.fen());
    updateUI();
}

// Initialize Stockfish
function initStockfish() {
    if (typeof Worker !== 'undefined') {
        try {
            stockfish = new Worker('./stockfish/stockfish.js');
            
            stockfish.addEventListener('message', function(e) {
                const line = e.data;
                if (typeof line === 'string') {
                    handleEngineOutput(line);
                }
            });
            
            stockfish.postMessage('uci');
            stockfish.postMessage('setoption name UCI_AnalyseMode value true');
            $('#engineOutput').text('Engine ready');
        } catch (error) {
            console.error('Failed to initialize Stockfish:', error);
            $('#engineOutput').text('Engine initialization failed');
        }
    }
}

// Handle engine output
function handleEngineOutput(line) {
    const $engineOutput = $('#engineOutput');
    $engineOutput.append($('<div>').text(line)); // Use .text() to prevent XSS
    $engineOutput.scrollTop($engineOutput[0].scrollHeight);
    
    // Parse evaluation
    if (line.includes('score cp')) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) {
            const cp = parseInt(match[1]) / 100;
            const eval = game.turn() === 'w' ? cp : -cp;
            updateEvaluation(eval);
        }
    } else if (line.includes('score mate')) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
            const mate = parseInt(match[1]);
            const evalText = `M${Math.abs(mate)}`;
            $('#evalText').text(mate > 0 ? `+${evalText}` : `-${evalText}`);
        }
    }
}

// Update evaluation display
function updateEvaluation(eval) {
    $('#evalText').text(eval > 0 ? `+${eval.toFixed(2)}` : eval.toFixed(2));
    
    // Update evaluation bar
    const percentage = Math.max(0, Math.min(100, 50 + (eval * 10)));
    $('#evalBar').css('width', `${percentage}%`);
}

// Start analysis
function startAnalysis() {
    if (!stockfish) {
        initStockfish();
        return;
    }
    
    analyzing = true;
    $('#analyzeBtn').hide();
    $('#stopAnalysisBtn').show();
    $('#engineOutput').empty();
    
    analyzePosition();
}

// Stop analysis
function stopAnalysis() {
    analyzing = false;
    $('#analyzeBtn').show();
    $('#stopAnalysisBtn').hide();

    if (stockfish) {
        stockfish.postMessage('stop');
    }

    // Reset to initial state
    $('#evalBar').css('width', '50%');
    $('#evalText').text('0.0');
    $('#engineOutput').text('Engine ready');
}

// Analyze current position
function analyzePosition() {
    if (!stockfish || !analyzing) return;
    
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 15');
}

// Toggle favorite status
async function toggleFavorite() {
    if (currentPositionIndex < 0) return;
    
    const fen = positions[currentPositionIndex];
    const isFavorite = favorites.has(fen);
    
    try {
        const response = await fetch('/.netlify/functions/favorites', {
            method: isFavorite ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                fen: fen,
                id: btoa(fen).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
            })
        });
        
        if (response.ok) {
            if (isFavorite) {
                favorites.delete(fen);
            } else {
                favorites.add(fen);
            }
            updateUI();
            loadFavorites();
            showStatus(isFavorite ? 'Removed from favorites' : 'Added to favorites', 'success');
        }
    } catch (error) {
        showStatus('Failed to update favorites', 'error');
    }
}

// Load favorites from server
async function loadFavorites(dateFrom = null, dateTo = null) {
    try {
        let url = '/.netlify/functions/favorites';
        const params = new URLSearchParams();
        if (dateFrom) params.append('from', dateFrom);
        if (dateTo) params.append('to', dateTo);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        favorites.clear();
        data.forEach(item => favorites.add(item.fen));
        
        displayFavorites(data);
        updateUI();
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
}

// Display favorites list
function displayFavorites(favoritesList) {
    const $list = $('#favoritesList');
    $list.empty();
    
    if (favoritesList.length === 0) {
        $list.html('<p style="color: #888;">No favorites yet</p>');
        return;
    }
    
    favoritesList.forEach(item => {
        const date = new Date(item.date).toLocaleDateString();
        const $item = $(`
            <div class="favorite-item">
                <span></span>
                <span>${date}</span>
            </div>
        `);
        $item.find('span:first-child').text(item.fen.substring(0, 30) + '...');
        
        $item.on('click', () => {
            positions = [item.fen];
            currentPositionIndex = 0;
            loadPosition(0);
            $('.tab[data-tab="analysis"]').click();
        });
        
        $list.append($item);
    });
}

// Filter favorites by date
function filterFavorites() {
    const dateFrom = $('#dateFrom').val();
    const dateTo = $('#dateTo').val();
    loadFavorites(dateFrom, dateTo);
}

// Show status message
function showStatus(message, type) {
    const $status = $('#statusMessage');
    $status.removeClass('success error').addClass(type);
    $status.text(message).show();
    setTimeout(() => $status.fadeOut(), 3000);
}
