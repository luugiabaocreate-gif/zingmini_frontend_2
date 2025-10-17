// home.js - frontend logic for home.html (uses app.js)
if (!getToken()) {
  location.href = "index.html";
}

const user = getUser() || { name: "Ẩn danh" };
document.getElementById("logoutBtn").addEventListener("click", logout);

// sample static friends & games (you can later fetch from API)
const sampleFriends = [
  { id: 1, name: "Mai", avatar: "assets/img/avatar1.jpg" },
  { id: 2, name: "Tuấn", avatar: "assets/img/avatar2.jpg" },
  { id: 3, name: "Phương", avatar: "assets/img/avatar3.jpg" },
  { id: 4, name: "Trâm", avatar: "assets/img/avatar4.jpg" },
];
const sampleGames = [
  {
    id: "race",
    title: "Mini Race",
    desc: "Vui chơi cùng bạn bè",
    url: "https://example.com/game/race",
  },
  {
    id: "puzzle",
    title: "Puzzle Land",
    desc: "Vui chơi cùng bạn bè",
    url: "https://example.com/game/puzzle",
  },
  {
    id: "opposition",
    title: "Plant VS Zombies",
    desc: "Vui chơi cùng bạn bè",
    url: "https://example.com/game/opposition",
  },
  {
    id: "trade",
    title: "Hàng Rong",
    desc: "Vui chơi cùng bạn bè",
    url: "https://example.com/game/trade",
  },
];

function renderFriends() {
  const list = document.getElementById("friendsList");
  list.innerHTML = sampleFriends
    .map(
      (f) =>
        `<li><a href="#" data-id="${f.id}" class="friend-link">${f.name}</a></li>`
    )
    .join("");
  document.querySelectorAll(".friend-link").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const id = +el.dataset.id;
      openFriendWindow(sampleFriends.find((x) => x.id === id));
    });
  });
}

function renderGames() {
  const el = document.getElementById("gamesList");
  el.innerHTML = sampleGames
    .map(
      (g) => `
    <div class="game-item">
      <div>
        <strong>${g.title}</strong>
        <div class="muted">${g.desc}</div>
      </div>
      <div><button class="btn small" data-url="${g.url}">Chơi ngay</button></div>
    </div>
  `
    )
    .join("");
  el.querySelectorAll("button[data-url]").forEach((b) => {
    b.addEventListener("click", () => window.open(b.dataset.url, "_blank"));
  });
}

function renderStories() {
  const el = document.getElementById("stories");
  el.innerHTML = sampleFriends
    .map(
      (f) => `
    <div class="story">
      <img src="${f.avatar}" alt="${f.name}" />
      <div class="story-name">${f.name}</div>
    </div>
  `
    )
    .join("");
  // click to open hero view
  el.querySelectorAll(".story img").forEach((img, i) => {
    img.addEventListener("click", () =>
      alert("Open story: " + sampleFriends[i].name)
    );
  });
}

// POSTS (connect to backend /posts)
async function loadPosts() {
  try {
    const posts = await request("/posts", "GET");
    const container = document.getElementById("posts");
    if (!posts || posts.length === 0) {
      container.innerHTML = `<div class="empty">Chưa có bài viết nào 💬</div>`;
      return;
    }
    // newest first
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    container.innerHTML = posts
      .map((p) => {
        const imgHTML = p.image
          ? `<div class="post-img-wrap"><img src="${p.image}" alt="post image"/></div>`
          : "";
        const author = p.user || "Ẩn danh";
        const when = new Date(p.createdAt).toLocaleString();
        return `
        <article class="post">
          <div class="post-head">
            <div><strong>${author}</strong></div>
            <div class="muted">${when}</div>
          </div>
          <div class="post-body">${escapeHtml(p.content || "")}</div>
          ${imgHTML}
        </article>
      `;
      })
      .join("");
  } catch (err) {
    console.error(err);
    document.getElementById(
      "posts"
    ).innerHTML = `<div class="error">Lỗi tải bài: ${err.message}</div>`;
  }
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

// create post with optional image (multipart/form-data)
document.getElementById("submitPost").addEventListener("click", async () => {
  const content = document.getElementById("postContent").value.trim();
  const fileInput = document.getElementById("postImage");
  const file = fileInput.files[0];

  if (!content && !file) {
    alert("Vui lòng nhập nội dung hoặc chọn ảnh");
    return;
  }

  const form = new FormData();
  form.append("user", user.name || "Ẩn danh");
  form.append("content", content);
  if (file) form.append("image", file);

  try {
    await request("/posts", "POST", form, true);
    document.getElementById("postContent").value = "";
    fileInput.value = "";
    await loadPosts();
  } catch (err) {
    alert("Không đăng được bài: " + err.message);
  }
});

// Open small friend window with actions
function openFriendWindow(friend) {
  const ok = confirm(
    `Bạn: ${friend.name}\n\nChọn OK để mở chat giả lập, Cancel để hủy.`
  );
  if (ok) {
    openChat(friend);
  }
}

// Simple chat bubble
function openChat(friend) {
  const chat = document.getElementById("chatBubble");
  chat.style.display = "block";
  document.getElementById("chatHeader").innerText = `Chat — ${friend.name}`;
  const body = document.getElementById("chatBody");
  body.innerHTML = `<div class="msg bot">Xin chào ${friend.name}! (demo chat)</div>`;
  document.getElementById("sendChat").onclick = () => {
    const txt = document.getElementById("chatText").value.trim();
    if (!txt) return;
    const p = document.createElement("div");
    p.className = "msg me";
    p.innerText = txt;
    body.appendChild(p);
    document.getElementById("chatText").value = "";
    body.scrollTop = body.scrollHeight;
  };
}

// init
renderFriends();
renderGames();
renderStories();
loadPosts();
