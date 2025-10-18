/* script_home_pro.js — ZingMini Full Frontend
   Features:
   - load feed (sort newest first)
   - create post (multipart/formdata, sends token)
   - like/comment (optimistic + socket.emit)
   - chat popup realtime (socket.io) with no-duplicate-from-self logic
   - notifications (toast + badge)
   - profile modal, stories, suggestions, games, friends demo
*/

const API_URL = "https://zingmini-backend-2.onrender.com";
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// small helper
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};
const fmtTime = (t) => {
  try {
    return new Date(t).toLocaleString();
  } catch {
    return "N/A";
  }
};

// ------------------------------------------------------------------
// User load & auth convenience
// ------------------------------------------------------------------
let currentUser = null;
async function loadUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token");
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data || !data.email) throw new Error("Not authenticated");
    currentUser = data;
    $("profileName").textContent = data.name || data.username || "Người dùng";
    $("profileAvatar").src = data.avatar || "https://i.imgur.com/AVT0a.png";
    // emit online
    socket.emit(
      "userOnline",
      currentUser.name || currentUser.username || "Khách"
    );
  } catch (err) {
    console.warn("loadUser:", err.message);
    currentUser = null;
    // show guest view but allow limited actions
    $("profileName").textContent = "Khách";
    $("profileAvatar").src = "https://i.imgur.com/AVT0a.png";
  }
}
loadUser();

// ------------------------------------------------------------------
// Socket debug + handlers
// ------------------------------------------------------------------
socket.on("connect", () => console.log("Socket connected", socket.id));
socket.on("connect_error", (err) =>
  console.error("Socket connect error", err.message)
);

// ===== chat: avoid double-display from server echo =====
socket.on("chat", (msg) => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const myName = (stored && (stored.name || stored.username)) || null;
    // if the server echos back the message we just displayed locally, skip it
    if (myName && msg.user === myName) return;
    appendChatMessage(msg);
    // small notif badge + sound for inbound messages (not self)
    playTing();
  } catch (e) {
    console.warn("chat handler:", e.message);
    appendChatMessage(msg); // fallback
  }
});

// other realtime
socket.on("like", (d) => handleIncomingLike(d));
socket.on("comment", (d) => handleIncomingComment(d));
socket.on("notification", (n) => showNotification(n.title || n));
socket.on("newPost", (p) => {
  // normalize then add
  addPostToFeed(normalizePost(p), true);
});
socket.on("onlineUsers", (list) => {
  const ul = $("friendsList");
  if (!ul) return;
  ul.innerHTML = "";
  list.forEach((name) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="opacity:1"></span>${escapeHtml(
      name
    )}`;
    ul.appendChild(li);
  });
});

// ------------------------------------------------------------------
// UI: Chat popup build + helpers
// ------------------------------------------------------------------
function buildChatPopup() {
  const root = $("chatContainer");
  root.innerHTML = `
    <div class="chat-popup" id="chatPopup">
      <div class="title">
        <div>💬 Chat ZingMini</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="online-dot" style="width:8px;height:8px;border-radius:50%;background:#2ecc71"></div>
          <button class="action-btn" id="minimizeChat">−</button>
        </div>
      </div>
      <div class="messages" id="chatMessages"></div>
      <div class="controls">
        <input id="chatInput" placeholder="Gửi tin nhắn..." />
        <button class="btn primary" id="chatSendBtn">Gửi</button>
      </div>
    </div>
  `;
  $("chatSendBtn").addEventListener("click", sendMessage);
  $("chatInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}
buildChatPopup();

function appendChatMessage(msg) {
  const box = $("chatMessages");
  if (!box) return;
  const wrapper = document.createElement("div");
  wrapper.className = "msg";
  const mine =
    currentUser && msg.user === (currentUser.name || currentUser.username);
  wrapper.classList.add(mine ? "self" : "other");
  const bubble = document.createElement("div");
  bubble.innerHTML = `<strong>${escapeHtml(msg.user)}</strong>: ${escapeHtml(
    msg.text
  )}`;
  bubble.className = "chat-bubble";
  bubble.style.background = mine
    ? "linear-gradient(135deg,#a18cd1,#fbc2eb)"
    : "#f1f4ff";
  bubble.style.color = mine ? "#fff" : "#222";
  bubble.style.padding = "8px 12px";
  bubble.style.borderRadius = "12px";
  const meta = document.createElement("div");
  meta.className = "chat-time";
  meta.style.fontSize = "0.75rem";
  meta.style.color = "#777";
  meta.style.marginTop = "6px";
  meta.textContent = fmtTime(msg.ts || msg.time || Date.now());
  wrapper.appendChild(bubble);
  wrapper.appendChild(meta);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
}

// send message (do NOT append again on server echo)
function sendMessage() {
  const input = $("chatInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  const userName = (stored && (stored.name || stored.username)) || "Ẩn danh";
  const msg = { user: userName, text, ts: Date.now() };
  // display immediately to user
  appendChatMessage(msg);
  // emit to server
  socket.emit("chat", msg);
  input.value = "";
}

// small sound
function playTing() {
  try {
    const audio = new Audio(
      "https://cdn.pixabay.com/download/audio/2022/03/15/audio_0b7d2d2b9d.mp3?filename=message-pop-14792.mp3"
    );
    audio.volume = 0.35;
    audio.play().catch(() => {});
  } catch {}
}

// ------------------------------------------------------------------
// Feed: load, normalize, add post
// ------------------------------------------------------------------
function normalizePost(p) {
  return {
    _id: p._id || p.id || String(Math.random()).slice(2),
    content: p.content || "",
    createdAt: p.createdAt || p.created_at || p.ts || Date.now(),
    username:
      (p.user && (p.user.name || p.user.username)) || p.username || "Ẩn danh",
    user: p.user || {
      name: (p.user && p.user.name) || p.username || "Ẩn danh",
      avatar:
        (p.user && p.user.avatar) ||
        p.avatar ||
        "https://i.imgur.com/AVT0a.png",
    },
    image: p.imageUrl || p.image || p.image_path || null,
  };
}

async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const arr = await res.json();
    arr.sort(
      (a, b) =>
        new Date(b.createdAt || b.created_at || b.ts || Date.now()) -
        new Date(a.createdAt || a.created_at || a.ts || Date.now())
    );
    $("feed").innerHTML = "";
    arr.forEach((p) => addPostToFeed(normalizePost(p), false));
  } catch (e) {
    console.error("loadFeed", e);
  }
}
loadFeed();

function addPostToFeed(post, toTop = true) {
  const feed = $("feed");
  const div = document.createElement("div");
  div.className = "post animate-pop";
  const id = post._id;
  const username = escapeHtml(post.username || post.user.name);
  const time = fmtTime(post.createdAt);
  const imageHtml = post.image
    ? `<div class="post-img-wrap"><img src="${post.image}" alt="img" /></div>`
    : "";
  div.innerHTML = `
    <div class="post-header">
      <img src="${post.user.avatar || "https://i.imgur.com/AVT0a.png"}" />
      <div>
        <div style="font-weight:700">${username}</div>
        <div style="font-size:0.8rem;color:#666">${escapeHtml(time)}</div>
      </div>
      <div style="margin-left:auto;cursor:pointer;color:#888" onclick="openProfile('${escapeHtml(
        post.user._id || ""
      )}')">Xem</div>
    </div>
    <div class="post-content">${escapeHtml(post.content)}</div>
    ${imageHtml}
    <div class="post-actions">
      <button class="action-btn like-btn" data-post-like="${id}" data-count="0" onclick="handleLike('${id}')">❤ 0</button>
      <button class="action-btn comment-toggle" onclick="toggleComments('${id}')">💬 Bình luận</button>
      <button class="action-btn share-btn" onclick="handleShare('${id}')">⤴ Chia sẻ</button>
    </div>
    <div id="comments-${id}" class="comments" style="display:none"></div>
  `;
  if (toTop) {
    feed.prepend(div);
    div.animate([{ background: "#fff7ff" }, { background: "transparent" }], {
      duration: 1200,
    });
  } else feed.appendChild(div);
}

// ------------------------------------------------------------------
// Create post: sends token, FormData(with image) and emits newPost
// ------------------------------------------------------------------
async function createPost() {
  const content = $("statusInput").value.trim();
  const imgEl = $("imageInput");
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  if (!token || !userStored) return alert("Bạn cần đăng nhập để đăng bài!");
  if (!content && (!imgEl || !imgEl.files.length))
    return alert("Viết gì đó hoặc chọn ảnh!");

  const fd = new FormData();
  fd.append("content", content);
  fd.append("userId", userStored._id);
  if (imgEl && imgEl.files[0]) fd.append("image", imgEl.files[0]);

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("post error", txt);
      return alert("Không thể đăng bài. Đăng nhập lại?");
    }
    const data = await res.json();
    const norm = normalizePost(data);
    addPostToFeed(norm, true);
    socket.emit("newPost", norm);
    $("statusInput").value = "";
    if (imgEl) imgEl.value = "";
  } catch (e) {
    console.error("createPost", e);
    alert("Lỗi mạng khi đăng bài");
  }
}

// ------------------------------------------------------------------
// Like / Comment (optimistic) handlers
// ------------------------------------------------------------------
function handleIncomingLike(d) {
  const el = document.querySelector(`[data-post-like="${d.postId}"]`);
  if (el) {
    let c = Number(el.dataset.count || 0) + 1;
    el.dataset.count = c;
    el.innerText = `❤ ${c}`;
    sparkle(el);
  }
  showNotification({ title: `${d.user} đã thích bài viết` });
}

function handleIncomingComment(d) {
  const box = $(`comments-${d.postId}`);
  if (!box) return;
  const p = document.createElement("div");
  p.className = "comment";
  p.innerHTML = `<strong>${escapeHtml(d.user)}</strong>: ${escapeHtml(d.text)}`;
  box.appendChild(p);
  showNotification({ title: `${d.user} đã bình luận` });
}

async function handleLike(postId) {
  const btn = document.querySelector(`[data-post-like="${postId}"]`);
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  if (btn) {
    let c = Number(btn.dataset.count || 0) + 1;
    btn.dataset.count = c;
    btn.innerText = `❤ ${c}`;
    btn.classList.add("liked");
    sparkle(btn);
  }
  socket.emit("like", {
    postId,
    user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh",
  });
  if (token) {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.warn("like API failed", e.message);
    }
  }
}

function toggleComments(postId) {
  const box = $(`comments-${postId}`);
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
  // append input if not exists
  if (box && !box.querySelector(".comment-input")) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "8px";
    wrapper.style.marginTop = "8px";
    wrapper.innerHTML = `<input class="comment-input" placeholder="Viết bình luận..." style="flex:1;padding:8px;border-radius:8px;border:1px solid #eee"/><button class="action-btn">Gửi</button>`;
    wrapper
      .querySelector("button")
      .addEventListener("click", () =>
        submitComment(postId, wrapper.querySelector("input").value)
      );
    box.prepend(wrapper);
  }
}

async function submitComment(postId, text) {
  if (!text || !text.trim()) return;
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  // optimistic
  const box = $(`comments-${postId}`);
  if (box) {
    const el = document.createElement("div");
    el.className = "comment";
    el.innerHTML = `<strong>${escapeHtml(
      (userStored && (userStored.name || userStored.username)) || "Ẩn danh"
    )}</strong>: ${escapeHtml(text)}`;
    box.appendChild(el);
  }
  socket.emit("comment", {
    postId,
    user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh",
    text,
  });
  if (token) {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
    } catch (e) {
      console.warn("comment API fail", e.message);
    }
  }
}

// ------------------------------------------------------------------
// Share / profile / notification helpers
// ------------------------------------------------------------------
function handleShare(postId) {
  navigator.clipboard?.writeText(location.href + `?post=${postId}`);
  showNotification({ title: "Đã sao chép link bài viết" });
}
function openProfile(userId) {
  const modal = $("profileModal");
  const details = $("profileDetails");
  modal.style.display = "flex";
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  if (stored && (!userId || stored._id === userId)) {
    details.innerHTML = `<img src="${
      stored.avatar || "https://i.imgur.com/AVT0a.png"
    }" style="width:80px;height:80px;border-radius:50%"/><h3>${escapeHtml(
      stored.name || stored.username || "Người dùng"
    )}</h3><p>${escapeHtml(stored.email || "")}</p>`;
  } else {
    details.innerHTML = `<img src="https://i.imgur.com/AVT0a.png" style="width:80px;height:80px;border-radius:50%"/><h3>Người dùng</h3><p>Không có thông tin</p>`;
  }
}
function closeProfile() {
  $("profileModal").style.display = "none";
}

function showNotification(n) {
  // n can be string or {title,body}
  const wrapper = $("toastWrapper");
  const el = document.createElement("div");
  el.className = "toast";
  if (typeof n === "string") el.innerHTML = `<strong>${escapeHtml(n)}</strong>`;
  else
    el.innerHTML = `<strong>${escapeHtml(
      n.title || "Thông báo"
    )}</strong><div style="font-size:0.85rem">${escapeHtml(
      n.body || ""
    )}</div>`;
  wrapper.appendChild(el);
  // badge
  const b = $("notifBadge");
  if (b) {
    b.style.display = "inline-block";
    b.innerText = Number(b.innerText || "0") + 1;
  }
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
  }, 3800);
}

// ------------------------------------------------------------------
// small UX: sparkle + helpers
// ------------------------------------------------------------------
function sparkle(el) {
  try {
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.12)" },
        { transform: "scale(1)" },
      ],
      { duration: 380 }
    );
  } catch (e) {}
}

// ------------------------------------------------------------------
// Demo content: stories, suggestions, games, friends
// ------------------------------------------------------------------
(function populateDemos() {
  const stories = [
    { name: "Linh", img: "https://i.imgur.com/XC8ZbZC.jpg" },
    { name: "Huy", img: "https://i.imgur.com/5ZQbB3k.jpg" },
    { name: "An", img: "https://i.imgur.com/zCw6zZC.jpg" },
  ];
  $("storyBox").innerHTML = stories
    .map(
      (s) =>
        `<div class="story"><img src="${s.img}" alt="${escapeHtml(
          s.name
        )}"/><div>${escapeHtml(s.name)}</div></div>`
    )
    .join("");
  const suggestions = [
    { name: "Trang", img: "https://i.imgur.com/2vS8t4h.jpg" },
    { name: "Đạt", img: "https://i.imgur.com/Tjz5UB1.jpg" },
  ];
  $("suggestBox").innerHTML = suggestions
    .map(
      (p) =>
        `<div class="suggest-item"><div class="suggest-info"><img src="${
          p.img
        }"/><span>${escapeHtml(
          p.name
        )}</span></div><button class="add-friend">Kết bạn</button></div>`
    )
    .join("");
  const games = [
    { name: "Zing Farm", img: "https://i.imgur.com/dzWl3V7.png" },
    { name: "Gunny", img: "https://i.imgur.com/0LKBgGR.png" },
  ];
  $("gameList").innerHTML = games
    .map(
      (g) =>
        `<div class="game-item"><img class="game-thumb" src="${
          g.img
        }"/><div>${escapeHtml(g.name)}</div></div>`
    )
    .join("");
  const friends = [
    { name: "Tuấn", online: true },
    { name: "Mai", online: true },
    { name: "Phúc", online: false },
  ];
  $("friendsList").innerHTML = friends
    .map(
      (f) =>
        `<li><span class="dot" style="opacity:${
          f.online ? 1 : 0.3
        }"></span>${escapeHtml(f.name)}</li>`
    )
    .join("");
})();

// ------------------------------------------------------------------
// Wire UI buttons
// ------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // post button
  const pbtn = $("postBtn");
  if (pbtn) pbtn.addEventListener("click", createPost);
  // logout
  const lobtn = $("logoutBtn");
  if (lobtn)
    lobtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "index.html";
    });
  // notif clr
  const nb = $("notifBtn");
  if (nb)
    nb.addEventListener("click", () => {
      const b = $("notifBadge");
      if (b) {
        b.style.display = "none";
        b.innerText = "0";
      }
      showNotification("Đã xem thông báo");
    });
  // minimize chat
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "minimizeChat") {
      const cp = $("chatPopup");
      if (cp) cp.style.display = cp.style.display === "none" ? "flex" : "none";
    }
  });
  // navbar hover effects preserved
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("mouseenter", () =>
      btn.classList.add("animate-pulse")
    );
    btn.addEventListener("mouseleave", () =>
      btn.classList.remove("animate-pulse")
    );
  });
  // load feed
  loadFeed();
});
