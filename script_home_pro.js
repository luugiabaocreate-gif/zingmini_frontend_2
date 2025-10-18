import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";
const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

if (!token || !currentUser) {
  window.location.href = "index.html";
}

/* socket */
const socket = io(API_URL, { transports: ["websocket", "polling"] });

/* DOM refs */
const postsContainer = document.getElementById("posts-container");
const postContent = document.getElementById("post-content");
const postImage = document.getElementById("post-image");
const postSubmit = document.getElementById("post-submit");
const mediaPreview = document.getElementById("media-preview");
const logoutBtn = document.getElementById("logout-btn");
const toggleThemeBtn = document.getElementById("toggle-theme");
const chatWindowsRoot = document.getElementById("chat-windows-root");
const friendsListEl = document.getElementById("friends-list");
const messengerDropdown = document.getElementById("messenger-dropdown");
const notifDropdown = document.getElementById("notif-dropdown");
const notifBadge = document.getElementById("notif-badge");
const profileDropdown = document.getElementById("profile-dropdown");
const profileBtn = document.getElementById("profile-btn");

/* set user UI */
document.getElementById("nav-username").textContent = currentUser.name || "Bạn";
document.getElementById("nav-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/40?u=${currentUser._id || "x"}`;
document.getElementById("left-username").textContent =
  currentUser.name || "Bạn";
document.getElementById("left-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id || "x"}`;
document.getElementById("create-avatar").src =
  currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id || "x"}`;

/* theme */
function applyTheme(m) {
  document.body.classList.toggle("dark", m === "dark");
  toggleThemeBtn.textContent = m === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem("zing_home_theme") || "light");
toggleThemeBtn.addEventListener("click", () => {
  const newMode = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("zing_home_theme", newMode);
  applyTheme(newMode);
});

/* logout */
logoutBtn.addEventListener("click", () => {
  if (confirm("Bạn có muốn đăng xuất?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
  }
});

/* safe fetch JSON */
async function safeFetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text();
      console.error("Server lỗi response:", txt);
      throw new Error(`Server lỗi ${res.status}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON parse fail:", text);
      throw new Error("Invalid JSON");
    }
  } catch (err) {
    throw err;
  }
}

/* ---------- load posts, build friend pool ---------- */
let friendPool = {}; // id -> user {name, avatar, _id}
async function loadPosts() {
  postsContainer.innerHTML =
    "<p style='text-align:center;color:#777;padding:12px'>Đang tải bài viết...</p>";
  try {
    const posts = await safeFetchJson(`${API_URL}/api/posts`);
    postsContainer.innerHTML = "";
    // collect users
    posts.forEach((p) => {
      if (p.user && p.user._id)
        friendPool[p.user._id] = {
          name: p.user.name,
          avatar: p.user.avatar || `https://i.pravatar.cc/44?u=${p.user._id}`,
          _id: p.user._id,
        };
    });
    // render friend list from pool
    renderFriendsList();
    // render posts
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

/* render friends list (click to open chat window) */
function renderFriendsList() {
  friendsListEl.innerHTML = "";
  const keys = Object.keys(friendPool);
  if (keys.length === 0) {
    friendsListEl.innerHTML =
      "<div class='small'>Không có bạn để hiển thị.</div>";
    return;
  }
  keys.slice(0, 8).forEach((id) => {
    const u = friendPool[id];
    const el = document.createElement("div");
    el.className = "s-item";
    el.innerHTML = `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;cursor:pointer" data-id="${id}" data-name="${u.name}"/><div>${u.name}</div>`;
    el.querySelector("img").addEventListener("click", (e) => {
      const uid = e.target.dataset.id;
      const name = e.target.dataset.name;
      openChatWindow(uid, name);
    });
    friendsListEl.appendChild(el);
  });
}

/* ---------- create post rendering + reactions UI ---------- */
function createPostNode(post) {
  if (!post.user) post.user = { name: post.authorName || "Ẩn danh", _id: "" };
  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = post._id || "";
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  // basic reaction summary data (if backend has reaction summary we could show; else maintain local)
  const reactionDisplay = post.reaction || ""; // backend optional
  div.innerHTML = `
    <div class="post-header"><img src="${
      post.user.avatar || `https://i.pravatar.cc/44?u=${post.user._id || "x"}`
    }" alt="avatar"><div><div style="font-weight:700">${escapeHtml(
    post.user.name
  )}</div><div style="font-size:12px;color:#666">${time}</div></div></div>
    <div class="post-content"><p>${escapeHtml(post.content || "")}</p>${
    post.image ? renderMediaHtml(post.image) : ""
  }</div>
    <div class="post-actions">
      <div class="actions-left">
        <button class="btn like-btn">👍 Thích</button>
        <div class="reaction-placeholder" style="display:inline-block;position:relative"></div>
      </div>
      <div class="actions-right">
        <button class="btn">💬 Bình luận</button>
      </div>
    </div>
  `;
  /* attach reaction hover popup */
  const likeBtn = div.querySelector(".like-btn");
  const reactionHolder = div.querySelector(".reaction-placeholder");

  let currentReaction = null; // local state for this client
  // build popup
  const popup = document.createElement("div");
  popup.className = "reactions-popup hidden";
  const emojis = ["👍", "❤️", "😆", "😮", "😢", "😡"];
  emojis.forEach((em) => {
    const r = document.createElement("div");
    r.className = "reaction emoji";
    r.textContent = em;
    r.title = em;
    r.addEventListener("click", (ev) => {
      ev.stopPropagation();
      chooseReaction(post._id, em, div);
      popup.classList.add("hidden");
    });
    popup.appendChild(r);
  });
  reactionHolder.appendChild(popup);

  // show/hide on hover (with small delay to mimic FB)
  let hoveredTimeout;
  likeBtn.addEventListener("mouseenter", () => {
    clearTimeout(hoveredTimeout);
    popup.classList.remove("hidden");
    // animate children
    Array.from(popup.children).forEach(
      (c, i) => (c.style.animationDelay = `${i * 40}ms`)
    );
  });
  likeBtn.addEventListener("mouseleave", () => {
    hoveredTimeout = setTimeout(() => popup.classList.add("hidden"), 350);
  });
  popup.addEventListener("mouseenter", () => clearTimeout(hoveredTimeout));
  popup.addEventListener("mouseleave", () => popup.classList.add("hidden"));

  // reflect reaction on close (if user clicks likeBtn itself, toggle default 👍)
  likeBtn.addEventListener("click", () => {
    chooseReaction(post._id, currentReaction === "👍" ? null : "👍", div);
  });

  // update reaction display when server sends reaction events
  // (socket listener below will handle reaction updates globally)

  return div;
}

/* chooseReaction: updates local UI + emit socket event */
function chooseReaction(postId, emoji, postNode) {
  // current reaction local toggle
  const likeBtn = postNode.querySelector(".like-btn");
  if (!emoji) {
    // clear selection
    likeBtn.classList.remove("reaction-selected");
    likeBtn.textContent = "👍 Thích";
    socket.emit("reaction", { postId, user: currentUser.name, reaction: null });
    return;
  }
  likeBtn.classList.add("reaction-selected");
  likeBtn.textContent = `${emoji} • Bạn`;
  socket.emit("reaction", { postId, user: currentUser.name, reaction: emoji });
}

/* render media */
function renderMediaHtml(path) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext)) {
    return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  }
  return `<img src="${url}" alt="media" style="width:100%;border-radius:8px;margin-top:8px">`;
}

/* escape helper */
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ---------- POST SUBMIT (safe) ---------- */
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
      console.error("Đăng bài lỗi:", txt);
      throw new Error("Server lỗi");
    }
    const newPost = await res.json();
    // ensure friendPool knows this user
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

/* preview */
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

/* ---------- dropdowns: messenger & notif & profile ---------- */
document.getElementById("messenger-btn").addEventListener("click", (e) => {
  messengerDropdown.classList.toggle("hidden");
  // populate conversation shortcuts (friends)
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
document.getElementById("notif-btn").addEventListener("click", (e) => {
  notifDropdown.classList.toggle("hidden");
  if (!notifDropdown.innerHTML)
    notifDropdown.innerHTML = "<div class='small'>Không có thông báo</div>";
});
profileBtn.addEventListener("click", () =>
  profileDropdown.classList.toggle("hidden")
);

/* ---------- multi-chat windows ---------- */
const openChats = {}; // map userId -> windowElement

function openChatWindow(userId, name) {
  if (!userId) {
    // fallback: create temp id
    userId = "u_" + Math.random().toString(36).slice(2, 8);
  }
  if (openChats[userId]) {
    // bring to front (move to top)
    const node = openChats[userId];
    node.parentNode.prepend(node);
    return;
  }
  const win = document.createElement("div");
  win.className = "chat-window";
  win.dataset.uid = userId;
  win.innerHTML = `
    <div class="head">
      <div style="display:flex;gap:8px;align-items:center"><img src="https://i.pravatar.cc/40?u=${userId}" style="width:28px;height:28px;border-radius:50%"/><div style="font-weight:700">${escapeHtml(
    name
  )}</div></div>
      <div><button class="mini collapse">_</button><button class="mini close">×</button></div>
    </div>
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
    body.style.display = body.style.display === "none" ? "block" : "none";
    win.querySelector(".foot").style.display =
      body.style.display === "none" ? "none" : "flex";
  });

  sendBtn.addEventListener("click", () => {
    const txt = input.value.trim();
    if (!txt) return;
    // emit socket chat to target user
    socket.emit("private_chat", {
      from: currentUser._id,
      to: userId,
      text: txt,
    });
    appendChatMessage(body, currentUser.name, txt, "you");
    input.value = "";
  });

  chatWindowsRoot.prepend(win);
  openChats[userId] = win;
  // load last messages placeholder (could fetch from server if available)
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

/* socket handlers for private_chat */
socket.on("private_chat", (msg) => {
  // msg: {from, to, text, userName}
  const otherId = msg.from === currentUser._id ? msg.to : msg.from;
  const otherName = msg.userName || `User ${otherId}`;
  const win = openChats[otherId] || openChatWindow(otherId, otherName);
  const body = win.querySelector(".body");
  appendChatMessage(body, msg.userName || otherName, msg.text, "them");
});

/* reactions and notif via socket */
socket.on("reaction", (r) => {
  // r: {postId, user, reaction}
  // update UI: find post node and show a tiny toast or change state
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
  // increment notif badge
  notifBadge.classList.remove("hidden");
  notifBadge.textContent = (parseInt(notifBadge.textContent || "0") || 0) + 1;
  // optionally add entry to notif dropdown
  const el = document.createElement("div");
  el.className = "card";
  el.textContent = `${r.user} đã phản ứng trên một bài viết`;
  notifDropdown.prepend(el);
});

/* receive generic chat */
socket.on("chat", (msg) => {
  // show in main chat area (not private)
  // append a simple message to an open global chat window if exists
  // for simplicity, display as notif
  notifBadge.classList.remove("hidden");
  notifBadge.textContent = (parseInt(notifBadge.textContent || "0") || 0) + 1;
});

/* helper to open chat from friends list on right panel */
friendsListEl.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-id]");
  if (img) openChatWindow(img.dataset.id, img.dataset.name || "Bạn");
});

/* simulate online: create friend elements from friendPool */
function buildFriendsFromPool() {
  // already handled in renderFriendsList
}

/* utils */
function renderMediaHtml(path) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext)) {
    return `<video controls src="${url}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  }
  return `<img src="${url}" alt="media" style="width:100%;border-radius:8px;margin-top:8px">`;
}

/* initial seed: if friendPool empty, add a few example users from posts on load */
window.addEventListener("load", () => {
  // small heartbeat - request posts already triggered above
});

/* keep socket alive and log errors */
socket.on("connect_error", (e) => console.warn("Socket connect error", e));
socket.on("connect", () => console.log("Socket connected"));
