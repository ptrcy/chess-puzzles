# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chess FEN Analyzer - A web application for analyzing chess positions from FEN notation using Stockfish engine.

## Development Commands

```bash
# Start local dev server (Netlify Dev)
npm run dev

# No build step required (static site)
npm run build
```

## Architecture

### Frontend (Static Site)
- `index.html` - Single-page application with embedded styles
- `app.js` - Main application logic

### Key Frontend Components (app.js)
- **Board**: ChessboardJS library with chess.js for move validation
- **Engine**: Web Worker running Stockfish WASM (`stockfish/stockfish.js`)
- **State**: Global variables manage positions array, current index, move history, and favorites

### Backend (Netlify Functions)
- `netlify/functions/favorites.js` - REST API for favorites (GET/POST/DELETE)
- Storage: Local JSON file (demo only, not production-ready)

### External Dependencies (CDN)
- jQuery 3.6.0
- ChessboardJS 1.0.0
- Chess.js 0.10.3

### Data Flow
1. User uploads FEN file → parsed and stored in `positions` array
2. Navigation buttons cycle through positions, loading each into chess.js and board
3. Moves made on board are validated by chess.js, stored in `moveHistory`
4. Analysis sends FEN to Stockfish worker, parses UCI output for evaluation
5. Favorites persisted via Netlify function to `/.netlify/functions/favorites`

## Key Patterns

- FEN validation uses chess.js `load()` method in try/catch
- Stockfish communication via Web Worker message passing (UCI protocol)
- Evaluation bar percentage: `50 + (centipawns/100 * 10)`, clamped 0-100
- Favorites ID generated from base64-encoded FEN (first 16 alphanumeric chars)
