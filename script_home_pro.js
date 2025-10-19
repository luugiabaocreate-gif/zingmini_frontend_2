// script_home_pro.js — FINAL FIX 2 (posts newest on top, chat newest at bottom, no duplicates)
import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";

// ===== Auth check =====
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
if (!token || !currentUser) {
  alert("Vui lòng đăng nhập để vào ZingMini!");
  location.href = "index.html";
  throw new Error("Not authenticated");
}

// ===== DOM refs =====
const $ = (id) => document.getElementById(id);
const postsContainer = $("posts-container");
const postContent = $("post-content");
const postImage = $("post-image");
const postSubmit = $("post-submit");
const mediaPreview = $("media-preview");
const toggleThemeBtn = $("toggle-theme");
const logoutTop = $("logout-top");
const friendsListEl = $("friends-list");
const chatWindowsRoot = $("chat-windows-root");

// prevent anchors "#"
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="#"]');
  if (a) e.preventDefault();
});

// show user info
if ($("nav-username"))
  $("nav-username").textContent = currentUser.name || "Bạn";
if ($("nav-avatar"))
  $("nav-avatar").src =
    currentUser.avatar || `https://i.pravatar.cc/40?u=${currentUser._id}`;
if ($("create-avatar"))
  $("create-avatar").src =
    currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id}`;

// ===== Smooth theme toggle =====
document.documentElement.style.transition =
  "background 320ms ease, color 320ms ease";
setTimeout(() => {
  document.documentElement.style.transition = "";
}, 360);

// ===== Socket =====
let socket;
try {
  socket = io(API_URL, {
    transports: ["websocket", "polling"],
    auth: { token },
    query: { token },
  });
} catch (e) {
  socket = { on: () => {}, emit: () => {} };
}

// ===== Helpers =====
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, ">");
}
async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
async function apiFetch(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token && !opts.skipAuth)
    opts.headers = { ...opts.headers, Authorization: `Bearer ${token}` };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const b = await safeJson(res);
    throw new Error(b?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ===== POSTS =====
async function loadPosts() {
  if (!postsContainer) return;
  postsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Đang tải bài viết...</p>`;
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    renderPosts(json);
  } catch (e) {
    postsContainer.innerHTML = `<p style="text-align:center;color:#c00">Không thể tải bài viết.</p>`;
  }
}

function renderPosts(json) {
  let posts = [];
  if (Array.isArray(json)) posts = json;
  else if (Array.isArray(json.posts)) posts = json.posts;
  else posts = [];
  postsContainer.innerHTML = "";
  if (!posts.length) {
    postsContainer.innerHTML = `<p style="text-align:center;color:#777">Chưa có bài viết.</p>`;
    return;
  }
  // backend đã trả newest->oldest nên hiển thị đúng chiều
  posts.forEach((p) => {
    const node = createPostNode(p);
    postsContainer.appendChild(node);
  });
}

loadPosts();

// đăng bài
if (postSubmit) {
  postSubmit.addEventListener("click", async (e) => {
    e.preventDefault();
    const content = postContent.value.trim();
    const file = postImage?.files?.[0];
    if (!content && !file)
      return alert("Vui lòng nhập nội dung hoặc chọn ảnh!");
    const form = new FormData();
    form.append("content", content);
    if (file) form.append("image", file);
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      const newest = Array.isArray(json) ? json : json.posts || json.data || [];
      if (Array.isArray(newest) && newest.length) {
        // lấy phần đầu (bài mới nhất) prepend
        const node = createPostNode(newest[0]);
        postsContainer.prepend(node);
      }
      postContent.value = "";
      if (postImage) postImage.value = "";
      if (mediaPreview) mediaPreview.innerHTML = "";
    } catch (err) {
      alert("Đăng bài thất bại");
    }
  });
}

// preview ảnh/video
if (postImage && mediaPreview) {
  postImage.addEventListener("change", (e) => {
    mediaPreview.innerHTML = "";
    const f = e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      if (f.type.startsWith("video/")) {
        const v = document.createElement("video");
        v.controls = true;
        v.src = fr.result;
        v.style.maxWidth = "220px";
        mediaPreview.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = fr.result;
        img.style.maxWidth = "220px";
        mediaPreview.appendChild(img);
      }
    };
    fr.readAsDataURL(f);
  });
}

function createPostNode(post) {
  const id = post._id || post.id;
  const user = post.user || post.author || { name: "Ẩn danh" };
  const avatar =
    user.avatar || `https://i.pravatar.cc/44?u=${user._id || user.id}`;
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  const content = post.content || "";
  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = id;
  div.innerHTML = `
  <div class="post-header">
    <img src="${escapeHtml(avatar)}" alt="${escapeHtml(
    user.name
  )}" data-id="${escapeHtml(user._id || user.id || "")}">
    <div><div style="font-weight:700">${escapeHtml(
      user.name
    )}</div><div class="small">${time}</div></div>
  </div>
  <div class="post-content"><p>${escapeHtml(content)}</p>${
    post.image ? renderMedia(post.image) : ""
  }</div>
  <div class="post-actions">
    <button class="btn like-btn">👍 Thích</button>
    <button class="btn comment-btn">💬 Bình luận</button>
  </div>`;
  const likeBtn = div.querySelector(".like-btn");
  likeBtn.addEventListener("click", () => {
    socket.emit("reaction", {
      postId: id,
      user: currentUser.name,
      reaction: "👍",
    });
    likeBtn.textContent = "👍 • Bạn";
  });
  const img = div.querySelector("img[data-id]");
  if (img)
    img.addEventListener("click", () =>
      openChatWindow(img.dataset.id, img.alt)
    );
  return div;
}
function renderMedia(path) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  return ["mp4", "webm", "ogg"].includes(ext)
    ? `<video controls src="${url}" style="width:100%;border-radius:8px"></video>`
    : `<img src="${url}" style="width:100%;border-radius:8px">`;
}

// ===== CHAT =====
const openChats = {};
function appendChatMessage(bodyEl, user, text, cls = "them") {
  const el = document.createElement("div");
  el.className = `message ${cls}`;
  el.innerHTML = `<b>${escapeHtml(user)}:</b> ${escapeHtml(text)}`;
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

function openChatWindow(fid, fname) {
  if (openChats[fid]) return;
  const win = document.createElement("div");
  win.className = "chat-window";
  win.dataset.uid = fid;
  win.innerHTML = `
  <div class="head"><div>${escapeHtml(
    fname
  )}</div><div><button class="mini close">×</button></div></div>
  <div class="body"></div>
  <div class="foot"><input class="cw-input" placeholder="Nhập tin nhắn..."/><button class="cw-send btn">Gửi</button></div>`;
  chatWindowsRoot.appendChild(win);
  openChats[fid] = win;
  const body = win.querySelector(".body"),
    input = win.querySelector(".cw-input"),
    send = win.querySelector(".cw-send"),
    close = win.querySelector(".close");

  (async () => {
    try {
      let msgs = await apiFetch(
        `${API_URL}/api/messages/${currentUser._id}/${fid}`
      );
      msgs = Array.isArray(msgs) ? msgs : msgs.data || [];
      msgs.forEach((m) => {
        appendChatMessage(
          body,
          m.from === currentUser._id ? currentUser.name : fname,
          m.text,
          m.from === currentUser._id ? "you" : "them"
        );
      });
      body.scrollTop = body.scrollHeight;
    } catch (e) {}
  })();

  send.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    appendChatMessage(body, currentUser.name, text, "you");
    input.value = "";
    socket.emit("private_chat", {
      from: currentUser._id,
      to: fid,
      text,
      userName: currentUser.name,
    });
    try {
      await apiFetch(`${API_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: currentUser._id,
          to: fid,
          text,
          userName: currentUser.name,
        }),
      });
    } catch (e) {}
  });
  close.addEventListener("click", () => {
    win.remove();
    delete openChats[fid];
  });
}

if (socket && socket.on) {
  socket.on("private_chat", (msg) => {
    const chatId = msg.from === currentUser._id ? msg.to : msg.from;
    const fname = msg.userName || "Họ";
    if (!openChats[chatId]) openChatWindow(chatId, fname);
    const body = openChats[chatId].querySelector(".body");
    appendChatMessage(
      body,
      msg.from === currentUser._id ? currentUser.name : fname,
      msg.text,
      msg.from === currentUser._id ? "you" : "them"
    );
  });
  socket.on("reaction", (r) => {
    const node = document.querySelector(
      `.post-card[data-post-id="${r.postId}"]`
    );
    if (node) {
      const b = node.querySelector(".like-btn");
      b.textContent = `${r.reaction} • ${
        r.user === currentUser.name ? "Bạn" : r.user
      }`;
    }
  });
}

// ===== LOGOUT =====
if (logoutTop) {
  logoutTop.addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm("Đăng xuất?")) return;
    try {
      socket.disconnect();
    } catch (e) {}
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    location.href = "index.html";
  });
}
