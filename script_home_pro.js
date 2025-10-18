// script_home_pro.js
// Home logic: load posts, create post (FormData), reactions popup, multi-chat, notif, logout, theme.
// Uses socket.io for realtime. Compatible with API endpoints under API_URL.

import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Redirect to login if missing
if (!token || !currentUser) location.href = "index.html";

// Initialize socket
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// DOM refs
const postsContainer = document.getElementById("posts-container");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");
const postSubmit = document.getElementById("post-submit");
const mediaPreview = document.getElementById("media-preview");
const toggleThemeBtn = document.getElementById("toggle-theme");
const logoutAction = document.getElementById("logout-action");
const chatWindowsRoot = document.getElementById("chat-windows-root");
const friendsListEl = document.getElementById("friends-list");
const messengerDropdown = document.getElementById("messenger-dropdown");
const notifDropdown = document.getElementById("notif-dropdown");
const notifBadge = document.getElementById("notif-badge");
const profileDropdown = document.getElementById("profile-dropdown");
const profileBtn = document.getElementById("profile-btn");
const messengerBtn = document.getElementById("messenger-btn");
const notifBtn = document.getElementById("notif-btn");

// UI setup
document.getElementById("nav-username").textContent = currentUser.name || "Bạn";
document.getElementById("nav-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/40?u=${currentUser._id || "x"}`;
document.getElementById("left-username").textContent =
  currentUser.name || "Bạn";
document.getElementById("left-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id || "x"}`;
document.getElementById("create-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id || "x"}`;

/* THEME */
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  toggleThemeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem("zing_home_theme") || "light");
toggleThemeBtn.addEventListener("click", () => {
  const newMode = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("zing_home_theme", newMode);
  applyTheme(newMode);
});

/* LOGOUT */
logoutAction.addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("Bạn có muốn đăng xuất?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    location.href = "index.html";
  }
});

/* safe fetch helper */
async function safeFetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text();
      console.error("Server error:", txt);
      throw new Error(`Server lỗi ${res.status}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON");
    }
  } catch (err) {
    throw err;
  }
}

/* friend pool (collected from posts) */
let friendPool = {};

/* LOAD POSTS */
async function loadPosts() {
  postsContainer.innerHTML =
    "<p style='text-align:center;color:#777;padding:12px'>Đang tải bài viết...</p>";
  try {
    const posts = await safeFetchJson(`${API_URL}/api/posts`);
    postsContainer.innerHTML = "";
    // build friend pool
    posts.forEach((p) => {
      if (p.user && p.user._id)
        friendPool[p.user._id] = {
          name: p.user.name,
          avatar: p.user.avatar || `https://i.pravatar.cc/44?u=${p.user._id}`,
          _id: p.user._id,
        };
    });
    renderFriendsList();
    posts.forEach((p, i) => {
      const node = createPostNode(p);
      postsContainer.appendChild(node);
      setTimeout(() => node.classList.add("loaded"), i * 80 + 90);
    });
  } catch (err) {
    console.error(err);
    postsContainer.innerHTML =
      "<p style='text-align:center;color:#c00;padding:12px'>Không tải được bài viết.</p>";
  }
}
loadPosts();

/* RENDER FRIENDS */
function renderFriendsList() {
  friendsListEl.innerHTML = "";
  const ids = Object.keys(friendPool);
  if (ids.length === 0) {
    friendsListEl.innerHTML =
      "<div class='small'>Không có bạn để hiển thị.</div>";
    return;
  }
  ids.slice(0, 8).forEach((id) => {
    const u = friendPool[id];
    const el = document.createElement("div");
    el.className = "s-item";
    el.innerHTML = `<img data-id="${id}" data-name="${u.name}" src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;cursor:pointer"/><div>${u.name}</div>`;
    el.querySelector("img").addEventListener("click", (e) =>
      openChatWindow(e.target.dataset.id, e.target.dataset.name)
    );
    friendsListEl.appendChild(el);
  });
}

/* CREATE POST NODE + REACTIONS POPUP */
function createPostNode(post) {
  if (!post.user) post.user = { name: post.authorName || "Ẩn danh", _id: "" };
  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = post._id || "";
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  div.innerHTML = `
    <div class="post-header">
      <img src="${
        post.user.avatar || `https://i.pravatar.cc/44?u=${post.user._id || "x"}`
      }" alt="avatar">
      <div><div style="font-weight:700">${escapeHtml(
        post.user.name
      )}</div><div class="small">${time}</div></div>
    </div>
    <div class="post-content"><p>${escapeHtml(post.content || "")}</p>${
    post.image ? renderMediaHtml(post.image) : ""
  }</div>
    <div class="post-actions">
      <div style="display:flex;align-items:center;gap:6px;position:relative;">
        <button class="btn like-btn">👍 Thích</button>
        <div class="reaction-placeholder"></div>
      </div>
      <div><button class="btn">💬 Bình luận</button></div>
    </div>
  `;

  const likeBtn = div.querySelector(".like-btn");
  const reactionHolder = div.querySelector(".reaction-placeholder");
  const popup = document.createElement("div");
  popup.className = "reactions-popup hidden";
  const emojis = ["👍", "❤️", "😆", "😮", "😢", "😡"];
  emojis.forEach((e) => {
    const r = document.createElement("div");
    r.className = "reaction";
    r.textContent = e;
    r.addEventListener("click", (ev) => {
      ev.stopPropagation();
      chooseReaction(post._id, e, div);
      popup.classList.add("hidden");
    });
    popup.appendChild(r);
  });
  reactionHolder.appendChild(popup);

  let hoverTimeout;
  likeBtn.addEventListener("mouseenter", () => {
    clearTimeout(hoverTimeout);
    popup.classList.remove("hidden");
  });
  likeBtn.addEventListener("mouseleave", () => {
    hoverTimeout = setTimeout(() => popup.classList.add("hidden"), 300);
  });
  popup.addEventListener("mouseenter", () => clearTimeout(hoverTimeout));
  popup.addEventListener("mouseleave", () => popup.classList.add("hidden"));

  likeBtn.addEventListener("click", () => {
    const isSelected = likeBtn.classList.contains("reaction-selected");
    chooseReaction(post._id, isSelected ? null : "👍", div);
  });

  return div;
}

/* CHOOSE REACTION — update UI + emit socket */
function chooseReaction(postId, emoji, postNode) {
  const likeBtn = postNode.querySelector(".like-btn");
  if (!emoji) {
    likeBtn.classList.remove("reaction-selected");
    likeBtn.textContent = "👍 Thích";
    socket.emit("reaction", { postId, user: currentUser.name, reaction: null });
    return;
  }
  likeBtn.classList.add("reaction-selected");
  likeBtn.textContent = `${emoji} • Bạn`;
  socket.emit("reaction", { postId, user: currentUser.name, reaction: emoji });
}

/* RENDER MEDIA */
function renderMediaHtml(path) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext)) {
    return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  }
  return `<img src="${url}" alt="media" style="width:100%;border-radius:8px;margin-top:8px">`;
}

/* ESCAPE */
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* PREVIEW */
postImage.addEventListener("change", (e) => {
  const file = e.target.files[0];
  mediaPreview.innerHTML = "";
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.src = fr.result;
      v.controls = true;
      v.style.maxWidth = "220px";
      mediaPreview.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = fr.result;
      img.style.maxWidth = "220px";
      mediaPreview.appendChild(img);
    }
  };
  fr.readAsDataURL(file);
});

/* CREATE POST */
postSubmit.addEventListener("click", async () => {
  const content = postContent.value.trim();
  if (!content && !postImage.files[0])
    return alert("Nhập nội dung hoặc chọn ảnh!");
  const form = new FormData();
  form.append("content", content || "");
  if (postImage.files[0]) form.append("image", postImage.files[0]);

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
    if (newPost.user && newPost.user._id)
      friendPool[newPost.user._id] = {
        name: newPost.user.name,
        avatar:
          newPost.user.avatar ||
          `https://i.pravatar.cc/44?u=${newPost.user._id}`,
        _id: newPost.user._id,
      };
    renderFriendsList();
    const node = createPostNode(newPost);
    postsContainer.prepend(node);
    setTimeout(() => node.classList.add("loaded"), 60);
    postContent.value = "";
    postImage.value = "";
    mediaPreview.innerHTML = "";
  } catch (err) {
    console.error(err);
    alert("Không thể đăng bài ngay bây giờ. Vui lòng thử lại sau.");
  }
});

/* DROPDOWNS (messenger, notif, profile) */
messengerBtn.addEventListener("click", () => {
  messengerDropdown.classList.toggle("hidden");
  if (!messengerDropdown.innerHTML) {
    messengerDropdown.innerHTML = "";
    Object.values(friendPool)
      .slice(0, 6)
      .forEach((u) => {
        const el = document.createElement("div");
        el.className = "card";
        el.style.display = "flex";
        el.style.gap = "8px";
        el.style.alignItems = "center";
        el.innerHTML = `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;cursor:pointer"/><div style="flex:1">${u.name}</div><button class="btn open-chat" data-id="${u._id}" data-name="${u.name}">Chat</button>`;
        el.querySelector(".open-chat").addEventListener("click", () =>
          openChatWindow(u._id, u.name)
        );
        messengerDropdown.appendChild(el);
      });
  }
});
notifBtn.addEventListener("click", () => {
  notifDropdown.classList.toggle("hidden");
  if (!notifDropdown.innerHTML)
    notifDropdown.innerHTML = '<div class="small">Không có thông báo</div>';
});
profileBtn.addEventListener("click", () =>
  profileDropdown.classList.toggle("hidden")
);

/* MULTI-CHAT */
const openChats = {};
function openChatWindow(userId, name) {
  if (!userId) userId = "u_" + Math.random().toString(36).slice(2, 8);
  if (openChats[userId]) {
    const node = openChats[userId];
    node.parentNode.prepend(node);
    return;
  }
  const win = document.createElement("div");
  win.className = "chat-window";
  win.dataset.uid = userId;
  win.innerHTML = `
    <div class="head"><div style="display:flex;gap:8px;align-items:center"><img src="https://i.pravatar.cc/40?u=${userId}" style="width:28px;height:28px;border-radius:50%"/><div style="font-weight:700">${escapeHtml(
    name
  )}</div></div><div><button class="mini collapse">_</button><button class="mini close">×</button></div></div>
    <div class="body"></div>
    <div class="foot"><input class="cw-input" placeholder="Nhập tin nhắn..."/><button class="cw-send btn">Gửi</button></div>
  `;
  const body = win.querySelector(".body");
  const input = win.querySelector(".cw-input");
  const sendBtn = win.querySelector(".cw-send");
  const collapse = win.querySelector(".collapse");
  const close = win.querySelector(".close");

  close.addEventListener("click", () => {
    win.remove();
    delete openChats[userId];
  });
  collapse.addEventListener("click", () => {
    if (body.style.display === "none") {
      body.style.display = "block";
      win.querySelector(".foot").style.display = "flex";
    } else {
      body.style.display = "none";
      win.querySelector(".foot").style.display = "none";
    }
  });

  sendBtn.addEventListener("click", () => {
    const txt = input.value.trim();
    if (!txt) return;
    socket.emit("private_chat", {
      from: currentUser._id,
      to: userId,
      text: txt,
      userName: currentUser.name,
    });
    appendChatMessage(body, currentUser.name, txt, "you");
    input.value = "";
  });

  chatWindowsRoot.prepend(win);
  openChats[userId] = win;
  appendChatMessage(body, name, "Xin chào!", "them");
  return win;
}

function appendChatMessage(bodyEl, user, text, cls = "them") {
  const el = document.createElement("div");
  el.className = `message ${cls}`;
  el.innerHTML = `<b>${escapeHtml(user)}:</b> ${escapeHtml(text)}`;
  bodyEl.appendChild(el);
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

/* SOCKET EVENTS */
socket.on("private_chat", (msg) => {
  const otherId = msg.from === currentUser._id ? msg.to : msg.from;
  const otherName = msg.userName || `User ${otherId}`;
  const win = openChats[otherId] || openChatWindow(otherId, otherName);
  const body = win.querySelector(".body");
  appendChatMessage(body, msg.userName || otherName, msg.text, "them");
});

socket.on("reaction", (r) => {
  const node = document.querySelector(`.post-card[data-post-id="${r.postId}"]`);
  if (node) {
    const likeBtn = node.querySelector(".like-btn");
    if (r.reaction) {
      likeBtn.textContent = `${r.reaction} • ${
        r.user === currentUser.name ? "Bạn" : r.user
      }`;
      likeBtn.classList.add("reaction-selected");
    } else {
      likeBtn.textContent = "👍 Thích";
      likeBtn.classList.remove("reaction-selected");
    }
  }
  notifBadge.classList.remove("hidden");
  notifBadge.textContent = (parseInt(notifBadge.textContent || "0") || 0) + 1;
  const el = document.createElement("div");
  el.className = "card";
  el.textContent = `${r.user} đã phản ứng trên một bài viết`;
  notifDropdown.prepend(el);
});

socket.on("chat", (msg) => {
  notifBadge.classList.remove("hidden");
  notifBadge.textContent = (parseInt(notifBadge.textContent || "0") || 0) + 1;
});

/* UTIL: click outside to close dropdowns */
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-wrap") && !e.target.closest(".dropdown")) {
    messengerDropdown.classList.add("hidden");
    notifDropdown.classList.add("hidden");
    profileDropdown.classList.add("hidden");
  }
});

/* helper to open chat by clicking friends list imgs */
friendsListEl.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-id]");
  if (img) openChatWindow(img.dataset.id, img.dataset.name || "Bạn");
});

/* expose helper for debugging */
window._openChatWindow = openChatWindow;

/* keep socket alive logs */
socket.on("connect", () => console.log("socket connected"));
socket.on("connect_error", (e) => console.warn("socket error", e));
