// script_home_pro.js
// Home logic: load posts, create post (FormData), reactions popup, multi-chat, notif, logout, theme.
// Uses socket.io for realtime. Compatible with API endpoints under API_URL.

import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Redirect to login if missing
if (!token || !currentUser) {
  // small safe redirect
  try {
    location.href = "index.html";
  } catch (e) {}
}

// Initialize socket
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// DOM refs (use guards)
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

// Safe helper to set text content if element exists
const setText = (id, text) => {
  const el = getEl(id);
  if (el) el.textContent = text;
};

// UI setup (guarded)
setText("nav-username", currentUser?.name || "Bạn");
const navAvatar = getEl("nav-avatar");
if (navAvatar)
  navAvatar.src =
    currentUser?.avatar ||
    `https://i.pravatar.cc/40?u=${currentUser?._id || "x"}`;
const leftAvatar = getEl("left-avatar");
if (leftAvatar)
  leftAvatar.src =
    currentUser?.avatar ||
    `https://i.pravatar.cc/48?u=${currentUser?._id || "x"}`;
setText("left-username", currentUser?.name || "Bạn");
const createAvatar = getEl("create-avatar");
if (createAvatar)
  createAvatar.src =
    currentUser?.avatar ||
    `https://i.pravatar.cc/48?u=${currentUser?._id || "x"}`;

/* THEME */
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  if (toggleThemeBtn)
    toggleThemeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
}
try {
  applyTheme(localStorage.getItem("zing_home_theme") || "light");
} catch (e) {}

if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener("click", () => {
    const newMode = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("zing_home_theme", newMode);
    // smooth transition
    document.documentElement.style.transition =
      "background 0.45s ease, color 0.45s ease";
    applyTheme(newMode);
    setTimeout(() => {
      document.documentElement.style.transition = "";
    }, 500);
  });
}

/* LOGOUT */
if (logoutAction) {
  logoutAction.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Bạn có muốn đăng xuất?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      try {
        location.href = "index.html";
      } catch (e) {}
    }
  });
}

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
  if (!postsContainer) return;
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
  if (!friendsListEl) return;
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
    const img = el.querySelector("img");
    if (img)
      img.addEventListener("click", (e) =>
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
      <div><button class="btn comment-btn">💬 Bình luận</button></div>
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
  if (reactionHolder) reactionHolder.appendChild(popup);

  let hoverTimeout;
  if (likeBtn) {
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
      chooseReaction(
        post._1d || post._id || post.id,
        isSelected ? null : "👍",
        div
      );
    });
  }

  return div;
}

/* CHOOSE REACTION — update UI + emit socket */
function chooseReaction(postId, emoji, postNode) {
  const likeBtn = postNode.querySelector(".like-btn");
  if (!likeBtn) return;
  if (!emoji) {
    likeBtn.classList.remove("reaction-selected");
    likeBtn.textContent = "👍 Thích";
    socket.emit("reaction", {
      postId,
      user: currentUser?.name,
      reaction: null,
    });
    return;
  }
  likeBtn.classList.add("reaction-selected");
  likeBtn.textContent = `${emoji} • Bạn`;
  socket.emit("reaction", { postId, user: currentUser?.name, reaction: emoji });
}

/* RENDER MEDIA */
function renderMediaHtml(path) {
  const url =
    path && path.startsWith && path.startsWith("http")
      ? path
      : `${API_URL}${path}`;
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
if (postImage && mediaPreview) {
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
}

/* CREATE POST */
if (postSubmit && postContent) {
  postSubmit.addEventListener("click", async () => {
    const content = postContent.value.trim();
    const fileObj = postImage && postImage.files ? postImage.files[0] : null;
    if (!content && !fileObj) return alert("Nhập nội dung hoặc chọn ảnh!");
    const form = new FormData();
    form.append("content", content || "");
    if (fileObj) form.append("image", fileObj);

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
      if (postsContainer) postsContainer.prepend(node);
      setTimeout(() => node.classList.add("loaded"), 60);
      postContent.value = "";
      if (postImage) postImage.value = "";
      if (mediaPreview) mediaPreview.innerHTML = "";
    } catch (err) {
      console.error(err);
      alert("Không thể đăng bài ngay bây giờ. Vui lòng thử lại sau.");
    }
  });
}

/* DROPDOWNS (messenger, notif, profile) */
if (messengerBtn && messengerDropdown) {
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
          const btn = el.querySelector(".open-chat");
          if (btn)
            btn.addEventListener("click", () => openChatWindow(u._id, u.name));
          messengerDropdown.appendChild(el);
        });
    }
  });
}
if (notifBtn && notifDropdown) {
  notifBtn.addEventListener("click", () => {
    notifDropdown.classList.toggle("hidden");
    if (!notifDropdown.innerHTML)
      notifDropdown.innerHTML = '<div class="small">Không có thông báo</div>';
  });
}
if (profileBtn && profileDropdown) {
  profileBtn.addEventListener("click", () =>
    profileDropdown.classList.toggle("hidden")
  );
}

/* MULTI-CHAT */
const openChats = {};
function openChatWindow(userId, name) {
  if (!chatWindowsRoot) return null;
  if (!userId) userId = "u_" + Math.random().toString(36).slice(2, 8);
  if (openChats[userId]) {
    const node = openChats[userId];
    node.parentNode.prepend(node);
    return node;
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

  if (close)
    close.addEventListener("click", () => {
      win.remove();
      delete openChats[userId];
    });
  if (collapse)
    collapse.addEventListener("click", () => {
      if (body.style.display === "none") {
        body.style.display = "block";
        win.querySelector(".foot").style.display = "flex";
      } else {
        body.style.display = "none";
        win.querySelector(".foot").style.display = "none";
      }
    });

  if (sendBtn) {
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
  }

  chatWindowsRoot.prepend(win);
  openChats[userId] = win;
  appendChatMessage(body, name, "Xin chào!", "them");
  return win;
}

function appendChatMessage(bodyEl, user, text, cls = "them") {
  if (!bodyEl) return;
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
  if (!win) return;
  const body = win.querySelector(".body");
  appendChatMessage(body, msg.userName || otherName, msg.text, "them");
});

socket.on("reaction", (r) => {
  const node = document.querySelector(`.post-card[data-post-id="${r.postId}"]`);
  if (node) {
    const likeBtn = node.querySelector(".like-btn");
    if (r.reaction) {
      if (likeBtn) {
        likeBtn.textContent = `${r.reaction} • ${
          r.user === currentUser.name ? "Bạn" : r.user
        }`;
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

socket.on("chat", (msg) => {
  if (notifBadge) {
    notifBadge.classList.remove("hidden");
    notifBadge.textContent = (parseInt(notifBadge.textContent || "0") || 0) + 1;
  }
});

/* UTIL: click outside to close dropdowns */
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-wrap") && !e.target.closest(".dropdown")) {
    if (messengerDropdown) messengerDropdown.classList.add("hidden");
    if (notifDropdown) notifDropdown.classList.add("hidden");
    if (profileDropdown) profileDropdown.classList.add("hidden");
  }
});

/* helper to open chat by clicking friends list imgs */
if (friendsListEl) {
  friendsListEl.addEventListener("click", (e) => {
    const img = e.target.closest("img[data-id]");
    if (img) openChatWindow(img.dataset.id, img.dataset.name || "Bạn");
  });
}

/* expose helper for debugging */
window._openChatWindow = openChatWindow;

/* keep socket alive logs */
socket.on("connect", () => console.log("socket connected"));
socket.on("connect_error", (e) => console.warn("socket error", e));

/* ===========================
   NON-BLOCKING BOOT LOGO + SAFE PAGE APPEAR
   - pointer-events: none so it won't block clicks
   - very short lifetime so it won't interfere
   =========================== */

(function nonBlockingEffects() {
  const onReady = () => {
    document.body.classList.add("page-appear");

    const boot = document.createElement("div");
    boot.id = "zingmini-boot";
    boot.innerHTML = `<div class="boot-text">ZingMini</div>`;
    document.body.appendChild(boot);

    requestAnimationFrame(() => boot.classList.add("show"));

    // Remove quickly - won't block events because pointer-events:none
    setTimeout(() => boot.classList.add("hide"), 700);
    setTimeout(() => {
      try {
        boot.remove();
      } catch (e) {}
    }, 1100);
  };

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(onReady, 80);
  } else {
    document.addEventListener("DOMContentLoaded", () =>
      setTimeout(onReady, 80)
    );
  }
})();
