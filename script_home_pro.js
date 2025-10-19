// =========================
// ZingMini - script_home_pro.js
// Giữ nguyên giao diện, chặn khách, đầy đủ chức năng
// =========================

import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";

// ===== KIỂM TRA ĐĂNG NHẬP =====
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
if (!token || !currentUser) {
  alert("Vui lòng đăng nhập để vào ZingMini!");
  location.href = "index.html";
}

// ===== ELEMENTS =====
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

// ===== SOCKET.IO =====
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// ===== CẬP NHẬT TÊN + ẢNH NGƯỜI DÙNG =====
const setText = (id, text) => { const el = getEl(id); if (el) el.textContent = text; };
setText("nav-username", currentUser?.name || "Bạn");
if (getEl("nav-avatar")) getEl("nav-avatar").src = currentUser?.avatar || `https://i.pravatar.cc/40?u=${currentUser?._id}`;
if (getEl("left-avatar")) getEl("left-avatar").src = currentUser?.avatar || `https://i.pravatar.cc/48?u=${currentUser?._id}`;
if (getEl("create-avatar")) getEl("create-avatar").src = currentUser?.avatar || `https://i.pravatar.cc/48?u=${currentUser?._id}`;

// ===== CHUYỂN CHẾ ĐỘ NỀN =====
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  if (toggleThemeBtn) toggleThemeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem("zing_home_theme") || "light");

if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener("click", () => {
    const newMode = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("zing_home_theme", newMode);
    applyTheme(newMode);
  });
}

// ===== ĐĂNG XUẤT =====
if (logoutAction) {
  logoutAction.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Bạn có muốn đăng xuất?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      location.href = "index.html";
    }
  });
}

// ===== HÀM HỖ TRỢ =====
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

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== LOAD BÀI VIẾT =====
async function loadPosts() {
  if (!postsContainer) return;
  postsContainer.innerHTML = "<p style='text-align:center;color:#777;padding:12px'>Đang tải bài viết...</p>";
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const posts = await res.json();
    postsContainer.innerHTML = "";
    posts.reverse().forEach((p) => {
      const node = createPostNode(p);
      postsContainer.appendChild(node);
    });
  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
    postsContainer.innerHTML =
      "<p style='text-align:center;color:red'>Không tải được bài viết!</p>";
  }
}
loadPosts();

// ===== ĐĂNG BÀI =====
if (postSubmit && postContent) {
  postSubmit.addEventListener("click", async () => {
    const content = postContent.value.trim();
    const file = postImage?.files?.[0] || null;
    if (!content && !file) return alert("Vui lòng nhập nội dung hoặc chọn ảnh!");

    const form = new FormData();
    form.append("content", content);
    if (file) form.append("image", file);

    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const newPost = await res.json();
      if (!res.ok) throw new Error("Đăng bài thất bại!");
      const node = createPostNode(newPost);
      postsContainer.prepend(node);
      postContent.value = "";
      postImage.value = "";
      mediaPreview.innerHTML = "";
    } catch (err) {
      console.error(err);
      alert("Không thể đăng bài, thử lại sau!");
    }
  });
}

// ===== XEM TRƯỚC ẢNH =====
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

// ===== HIỂN THỊ BÀI VIẾT =====
function createPostNode(post) {
  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = post._id;
  const time = new Date(post.createdAt).toLocaleString("vi-VN");
  const avatar = post.user?.avatar || `https://i.pravatar.cc/44?u=${post.user?._id}`;
  div.innerHTML = `
    <div class="post-header">
      <img src="${escapeHtml(avatar)}" alt="avatar" data-id="${post.user?._id}">
      <div><div style="font-weight:700">${escapeHtml(post.user?.name || "Người dùng")}</div><div class="small">${time}</div></div>
    </div>
    <div class="post-content">
      <p>${escapeHtml(post.content || "")}</p>
      ${post.image ? renderMediaHtml(post.image) : ""}
    </div>
    <div class="post-actions">
      <button class="btn like-btn">👍 Thích</button>
      <button class="btn comment-btn">💬 Bình luận</button>
    </div>
  `;
  const likeBtn = div.querySelector(".like-btn");
  likeBtn.addEventListener("click", () => {
    socket.emit("reaction", {
      postId: post._id,
      user: currentUser.name,
      reaction: "👍",
    });
    likeBtn.classList.add("reaction-selected");
    likeBtn.textContent = "👍 • Bạn";
  });
  return div;
}

function renderMediaHtml(path) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext)) {
    return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  }
  return `<img src="${url}" style="width:100%;border-radius:8px;margin-top:8px" />`;
}

// ===== SOCKET EVENTS =====
socket.on("reaction", (r) => {
  const node = document.querySelector(`.post-card[data-post-id="${r.postId}"]`);
  if (node) {
    const likeBtn = node.querySelector(".like-btn");
    likeBtn.textContent = `${r.reaction} • ${r.user}`;
    likeBtn.classList.add("reaction-selected");
  }
});

// ===== CHAT (mở khi click avatar) =====
const openChats = {};
function openChatWindow(friendId, friendName) {
  if (openChats[friendId]) return;
  const win = document.createElement("div");
  win.className = "chat-window";
  win.dataset.uid = friendId;
  win.innerHTML = `
    <div class="head"><b>${escapeHtml(friendName)}</b>
      <button class="mini close">×</button>
    </div>
    <div class="body"></div>
    <div class="foot">
      <input class="cw-input" placeholder="Nhập tin nhắn..."/>
      <button class="cw-send btn">Gửi</button>
    </div>`;
  chatWindowsRoot.appendChild(win);
  openChats[friendId] = win;
  const body = win.querySelector(".body");
  const input = win.querySelector(".cw-input");
  const sendBtn = win.querySelector(".cw-send");
  const closeBtn = win.querySelector(".close");

  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    socket.emit("private_chat", {
      from: currentUser._id,
      to: friendId,
      text,
      userName: currentUser.name,
    });
    appendChatMessage(body, currentUser.name, text, "you");
    input.value = "";
  });

  closeBtn.addEventListener("click", () => {
    win.remove();
    delete openChats[friendId];
  });
}

function appendChatMessage(bodyEl, user, text, cls = "them") {
  const el = document.createElement("div");
  el.className = `message ${cls}`;
  el.innerHTML = `<b>${escapeHtml(user)}:</b> ${escapeHtml(text)}`;
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

socket.on("private_chat", (msg) => {
  const otherId = msg.from === currentUser._id ? msg.to : msg.from;
  const otherName = msg.userName || "Bạn";
  if (!openChats[otherId]) openChatWindow(otherId, otherName);
  const body = openChats[otherId].querySelector(".body");
  appendChatMessage(body, msg.userName || otherName, msg.text, msg.from === currentUser._id ? "you" : "them");
});

// ===== CLICK AVATAR MỞ CHAT =====
document.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-id]");
  if (img) {
    const id = img.getAttribute("data-id");
    const name = img.getAttribute("alt") || "Người dùng";
    openChatWindow(id, name);
  }
});
