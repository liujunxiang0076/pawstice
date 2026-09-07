import './styles/global.css';
import { createGame } from './app/createGame.js';

const game = createGame();
if (import.meta.env.DEV) window.__petGame = game.debug;
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    game.dispose();
    delete window.__petGame;
  });
