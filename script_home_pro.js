// script_home_pro.js — FINAL (preserve logic, add immediate prepend for new posts)
// Uses socket.io ESM client; must be loaded as module.
import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// safe redirect if not logged in
if (!token || !currentUser) {
  try { location.href = "index.html"; } catch(e) {}
}

// init socket
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// DOM refs
const getEl = (id) => document.getElementById(id);
const postsContainer = getEl("posts-container");
const postContent = getEl("post-content");
const postImage = getEl("post-image");
const postSubmit = getEl("post-submit");
const mediaPreview = getEl("media-preview");
const toggleThemeBtn = getEl("toggle-theme");
const logoutAction = getEl("logout-action");
const chatWindowsRoot = getEl("chat-windows-root");
const friendsListEl = getEl("friends-list");
const messengerDropdown = getEl("messenger-dropdown");
const notifDropdown = getEl("notif-dropdown");
const notifBadge = getEl("notif-badge");
const profileDropdown = getEl("profile-dropdown");
const profileBtn = getEl("profile-btn");
const messengerBtn = getEl("messenger-btn");
const notifBtn = getEl("notif-btn");

// set nav user info safely
const setText = (id, text) => { const el = getEl(id); if (el) el.textContent = text; };
setText("nav-username", currentUser?.name || "Bạn");
if (getEl("nav-avatar")) getEl("nav-avatar").src = currentUser?.avatar || `https://i.pravatar.cc/40?u=${currentUser?._id || "x"}`;
if (getEl("left-avatar")) getEl("left-avatar").src = currentUser?.avatar || `https://i.pravatar.cc/48?u=${currentUser?._id || "x"}`;
if (getEl("create-avatar")) getEl("create-avatar").src = currentUser?.avatar || `https://i.pravatar.cc/48?u=${currentUser?._id || "x"}`;

// theme
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  if (toggleThemeBtn) toggleThemeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}
try { applyTheme(localStorage.getItem("zing_home_theme") || "light"); } catch(e) {}

// theme toggle
if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener("click", () => {
    const newMode = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("zing_home_theme", newMode);
    document.documentElement.style.transition = "background 0.45s ease, color 0.45s ease";
    applyTheme(newMode);
    setTimeout(() => { document.documentElement.style.transition = ""; }, 500);
  });
}

// logout (guarded)
if (logoutAction) {
  logoutAction.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Bạn có muốn đăng xuất?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      try { location.href = "index.html"; } catch(e) {}
    }
  });
}

// helper fetch with auth
async function fetchJson(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    throw new Error(`HTTP ${res.status} - ${txt}`);
  }
  return res.json();
}

// escape html
function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ===== LOAD POSTS ===== */
async function loadPosts() {
  if (!postsContainer) return;
  postsContainer.innerHTML = "<p style='text-align:center;color:#777;padding:12px'>Đang tải bài viết...</p>";
  try {
    const posts = await fetchJson(`${API_URL}/api/posts`);
    postsContainer.innerHTML = "";
    posts.forEach((p, i) => {
      const node = createPostNode(p);
      postsContainer.appendChild(node);
      setTimeout(() => node.classList.add("loaded"), i * 60 + 60);
    });
  } catch (err) {
    console.error("Load posts error:", err);
    postsContainer.innerHTML = "<p style='text-align:center;color:#c00;padding:12px'>Không tải được bài viết.</p>";
  }
}
loadPosts();

/* ===== CREATE POST (with preview) ===== */
if (postImage && mediaPreview) {
  postImage.addEventListener("change", (e) => {
    mediaPreview.innerHTML = "";
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      if (file.type.startsWith("video/")) {
        const v = document.createElement("video");
        v.src = fr.result; v.controls = true; v.style.maxWidth = "220px";
        mediaPreview.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = fr.result; img.style.maxWidth = "220px";
        mediaPreview.appendChild(img);
      }
    };
    fr.readAsDataURL(file);
  });
}

if (postSubmit && postContent) {
  postSubmit.addEventListener("click", async () => {
    const content = postContent.value.trim();
    const file = postImage?.files?.[0] || null;
    if (!content && !file) return alert("Nhập nội dung hoặc chọn ảnh!");
    const form = new FormData();
    form.append("content", content);
    if (file) form.append("image", file);

    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Đăng bài lỗi, server replied:", txt);
        throw new Error("Server lỗi khi đăng bài");
      }
      const newPost = await res.json();

      // IMMEDIATE UI UPDATE (prepend) — fixes “must reload to see post”
      if (newPost && newPost._id) {
        const node = createPostNode(newPost);
        if (postsContainer) postsContainer.prepend(node);
        setTimeout(() => node.classList.add("loaded"), 60);
        postContent.value = "";
        if (postImage) postImage.value = "";
        if (mediaPreview) mediaPreview.innerHTML = "";
      } else {
        console.warn("Đăng bài: server trả về không đúng định dạng:", newPost);
      }
    } catch (err) {
      console.error("Đăng bài lỗi:", err);
      alert("Không thể đăng bài. Vui lòng thử lại sau.");
    }
  });
}

/* ===== RENDER POST NODE ===== */
function createPostNode(post) {
  if (!post) return document.createElement("div");
  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = post._id || "";
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  const avatar = post.user?.avatar || `https://i.pravatar.cc/44?u=${post.user?._id || "x"}`;
  div.innerHTML = `
    <div class="post-header">
      <img src="${escapeHtml(avatar)}" alt="avatar" data-owner-id="${post.user?._id || ""}" data-name="${escapeHtml(post.user?.name||'Bạn')}">
      <div><div style="font-weight:700">${escapeHtml(post.user?.name || "Ẩn danh")}</div><div class="small">${time}</div></div>
    </div>
    <div class="post-content">
      <p>${escapeHtml(post.content || "")}</p>
      ${post.image ? renderMediaHtml(post.image) : ""}
    </div>
    <div class="post-actions">
      <div style="display:flex;align-items:center;gap:8px;position:relative;">
        <button class="btn like-btn">👍 Thích</button>
        <div class="reaction-placeholder"></div>
      </div>
      <div><button class="btn comment-btn">💬 Bình luận</button></div>
    </div>
  `;
  // attach simple like behaviour (UI + socket emit)
  const likeBtn = div.querySelector(".like-btn");
  if (likeBtn) {
    likeBtn.addEventListener("click", () => {
      const postId = div.dataset.postId;
      try { socket.emit("reaction", { postId, user: currentUser.name, reaction: "👍" }); } catch(e){}
      likeBtn.classList.add("reaction-selected");
      likeBtn.textContent = "👍 • Bạn";
    });
  }
  return div;
}

function renderMediaHtml(path) {
  const url = (path && typeof path === "string" && path.startsWith("http")) ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4","webm","ogg"].includes(ext)) {
    return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  }
  return `<img src="${url}" style="width:100%;border-radius:8px;margin-top:8px" />`;
}

/* ===== FRIENDS / friendPool rendering ===== */
let friendPool = {};
function renderFriendsList() {
  if (!friendsListEl) return;
  friendsListEl.innerHTML = "";
  const ids = Object.keys(friendPool);
  if (!ids.length) {
    friendsListEl.innerHTML = "<div class='small'>Không có bạn để hiển thị.</div>";
    return;
  }
  ids.slice(0,8).forEach(id => {
    const u = friendPool[id];
    const el = document.createElement("div");
    el.className = "s-item";
    el.innerHTML = `<img data-id="${u._id}" data-name="${escapeHtml(u.name)}" src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;cursor:pointer"/><div>${escapeHtml(u.name)}</div>`;
    friendsListEl.appendChild(el);
  });
}

/* collect friendPool after posts rendered */
function refreshFriendPoolFromPosts() {
  friendPool = {};
  Array.from(document.querySelectorAll(".post-card")).forEach(p => {
    const img = p.querySelector("img[data-owner-id]") || p.querySelector("img");
    if (!img) return;
    const id = img.dataset.id || img.dataset.ownerId || img.getAttribute("data-id");
    const name = img.dataset.name || img.getAttribute("alt") || (p.querySelector(".post-header div b") && p.querySelector(".post-header div b").textContent) || "Bạn";
    const avatar = img.src;
    if (id) friendPool[id] = { _id: id, name, avatar };
  });
  renderFriendsList();
}
setTimeout(refreshFriendPoolFromPosts, 600);
setInterval(refreshFriendPoolFromPosts, 3000);

/* observe posts for dynamic changes */
const observePosts = new MutationObserver(() => refreshFriendPoolFromPosts());
if (postsContainer) observePosts.observe(postsContainer, { childList: true, subtree: true });

/* ===== CHAT (open when clicking friend avatar in friendsList or post avatars) ===== */
const openChats = {};

function openChatWindow(friendId, friendName) {
  if (!chatWindowsRoot) return;
  if (!friendId) friendId = "u_"+Math.random().toString(36).slice(2,8);
  if (openChats[friendId]) {
    const node = openChats[friendId];
    node.parentNode.prepend(node);
    return;
  }
  const win = document.createElement("div");
  win.className = "chat-window";
  win.dataset.uid = friendId;
  win.innerHTML = `
    <div class="head"><div style="display:flex;gap:8px;align-items:center"><div style="width:34px;height:34px;border-radius:50%;background:#fff"></div><div style="font-weight:700;color:#fff;margin-left:6px">${escapeHtml(friendName)}</div></div>
      <div>
        <button class="mini collapse">_</button>
        <button class="mini close">×</button>
      </div>
    </div>
    <div class="body"></div>
    <div class="foot"><input class="cw-input" placeholder="Nhập tin nhắn..."/><button class="cw-send btn">Gửi</button></div>
  `;
  chatWindowsRoot.appendChild(win);
  openChats[friendId] = win;

  const body = win.querySelector(".body");
  const input = win.querySelector(".cw-input");
  const sendBtn = win.querySelector(".cw-send");
  const closeBtn = win.querySelector(".close");
  const collapseBtn = win.querySelector(".collapse");

  // load history
  loadChatHistory(friendId, body).catch(()=>{});

  sendBtn.addEventListener("click", () => {
    sendChat(friendId, friendName, input.value.trim(), body, input);
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });

  closeBtn.addEventListener("click", () => {
    win.remove();
    delete openChats[friendId];
  });
  collapseBtn.addEventListener("click", () => {
    const hidden = body.style.display === "none";
    body.style.display = hidden ? "block" : "none";
    win.querySelector(".foot").style.display = hidden ? "flex" : "none";
  });
}

/* load chat history */
async function loadChatHistory(friendId, bodyEl) {
  if (!bodyEl) return;
  try {
    const msgs = await fetchJson(`${API_URL}/api/messages/${currentUser._id}/${friendId}`);
    bodyEl.innerHTML = "";
    msgs.forEach(m => {
      appendChatMessage(bodyEl, m.from === currentUser._id ? currentUser.name : "Họ", m.text, m.from === currentUser._id ? "you" : "them");
    });
  } catch (err) {
    console.warn("Không tải được lịch sử chat:", err);
  }
}

function appendChatMessage(bodyEl, user, text, cls="them") {
  if (!bodyEl) return;
  const el = document.createElement("div");
  el.className = `message ${cls}`;
  el.innerHTML = `<b>${escapeHtml(user)}:</b> ${escapeHtml(text)}`;
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

async function sendChat(friendId, friendName, text, bodyEl, inputEl) {
  if (!text) return;
  const msg = { from: currentUser._id, to: friendId, text, userName: currentUser.name };
  try { socket.emit("private_chat", msg); } catch(e){}
  appendChatMessage(bodyEl, currentUser.name, text, "you");
  if (inputEl) inputEl.value = "";
  try {
    await fetchJson(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  } catch (err) {
    console.warn("Lưu tin nhắn thất bại:", err);
  }
}

/* socket handlers */
socket.on("connect", () => console.log("socket connected:", socket.id));
socket.on("disconnect", () => console.log("socket disconnected"));
socket.on("private_chat", (msg) => {
  const otherId = msg.from === currentUser._id ? msg.to : msg.from;
  const otherName = msg.userName || "Bạn";
  const win = openChats[otherId] || (function(){ openChatWindow(otherId, otherName); return openChats[otherId]; })();
  if (!win) return;
  const body = win.querySelector(".body");
  appendChatMessage(body, msg.userName || otherName, msg.text, msg.from === currentUser._id ? "you" : "them");
});
socket.on("reaction", (r) => {
  const node = document.querySelector(`.post-card[data-post-id="${r.postId}"]`);
  if (node) {
    const likeBtn = node.querySelector(".like-btn");
    if (r.reaction) {
      if (likeBtn) {
        likeBtn.textContent = `${r.reaction} • ${r.user === currentUser.name ? "Bạn" : r.user}`;
        likeBtn.classList.add("reaction-selected");
      }
    } else {
      if (likeBtn) {
        likeBtn.textContent = "👍 Thích";
        likeBtn.classList.remove("reaction-selected");
      }
    }
  }
  if (notifBadge) {
    notifBadge.classList.remove("hidden");
    notifBadge.textContent = (parseInt(notifBadge.textContent || "0") || 0) + 1;
  }
  if (notifDropdown) {
    const el = document.createElement("div");
    el.className = "card";
    el.textContent = `${r.user} đã phản ứng trên một bài viết`;
    notifDropdown.prepend(el);
  }
});

/* UI interactions */
document.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-id]");
  if (img) {
    const id = img.getAttribute("data-id");
    const name = img.getAttribute("data-name") || img.getAttribute("alt") || "Bạn";
    if (id) openChatWindow(id, name);
  }
  const postImg = e.target.closest("img[data-owner-id]");
  if (postImg) {
    const id = postImg.dataset.id || postImg.dataset.ownerId;
    const name = postImg.getAttribute("data-name") || postImg.getAttribute("alt") || "Bạn";
    if (id) openChatWindow(id, name);
  }

  if (!e.target.closest(".dropdown-wrap") && !e.target.closest(".dropdown")) {
    if (messengerDropdown) messengerDropdown.classList.add("hidden");
    if (notifDropdown) notifDropdown.classList.add("hidden");
    if (profileDropdown) profileDropdown.classList.add("hidden");
  }
});

/* messenger dropdown quick open */
if (messengerBtn && messengerDropdown) {
  messengerBtn.addEventListener("click", () => {
    messengerDropdown.classList.toggle("hidden");
    if (messengerDropdown.innerHTML.trim() === "") {
      messengerDropdown.innerHTML = "";
      Object.values(friendPool).slice(0,6).forEach(u => {
        const el = document.createElement("div");
        el.className = "card";
        el.style.display="flex"; el.style.gap="8px"; el.style.alignItems="center";
        el.innerHTML = `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;"/><div style="flex:1">${escapeHtml(u.name)}</div><button class="btn open-chat" data-id="${u._id}" data-name="${escapeHtml(u.name)}">Chat</button>`;
        const btn = el.querySelector(".open-chat");
        if (btn) btn.addEventListener("click", () => openChatWindow(u._id, u.name));
        messengerDropdown.appendChild(el);
      });
    }
  });
}

/* keep socket alive logs */
socket.on("connect_error", (e) => console.warn("socket error", e));

/* boot logo (non-blocking) */
(function nonBlockingEffects() {
  const onReady = () => {
    document.body.classList.add("page-appear");
    const boot = document.createElement("div");
    boot.id = "zingmini-boot";
    boot.innerHTML = `<div class="boot-text">ZingMini</div>`;
    document.body.appendChild(boot);
    requestAnimationFrame(() => boot.classList.add("show"));
    setTimeout(() => boot.classList.add("hide"), 700);
    setTimeout(() => { try { boot.remove(); } catch(e){} }, 1100);
  };
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(onReady, 80);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(onReady, 80));
  }
})();
