// Simple game list (static). You can replace URLs with your embedded games.
const games = [
  { id: 1, title: "Snake Classic", img: "https://picsum.photos/seed/snake/400/200", url: "https://playsnake.org/" },
  { id: 2, title: "2048", img: "https://picsum.photos/seed/2048/400/200", url: "https://play2048.co/" },
  { id: 3, title: "Tetris", img: "https://picsum.photos/seed/tetris/400/200", url: "https://tetris.com/play-tetris" },
  { id: 4, title: "Solitaire", img: "https://picsum.photos/seed/sol/400/200", url: "https://cardgames.io/solitaire/" },
  { id: 5, title: "Minesweeper", img: "https://picsum.photos/seed/mine/400/200", url: "https://minesweeper.online/" }
];

const grid = document.getElementById("games-grid");
games.forEach(g => {
  const c = document.createElement("div");
  c.className = "game-card";
  c.innerHTML = `<img src="${g.img}" alt="${g.title}"><div style="font-weight:700">${escapeHtml(g.title)}</div><div style="margin-top:auto;display:flex;gap:8px"><button class="btn" data-url="${g.url}">Vào chơi</button></div>`;
  grid.appendChild(c);
});
grid.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-url]");
  if (!btn) return;
  const url = btn.getAttribute("data-url");
  window.open(url, "_blank");
});
function escapeHtml(s=""){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
