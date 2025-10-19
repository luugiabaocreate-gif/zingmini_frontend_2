// script_home_pro.js — Final bundle
// Fix toàn diện: load posts, post (file/image), realtime chat, reactions, logout (logout-top),
// theme smooth, prevent href "#", friend list -> chat windows.
// Import socket.io client
import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";

// ===== Auth: chặn khách =====
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
const logoutTop = $("logout-top"); // visible logout button
const profileBtn = $("profile-btn");
const profileDropdown = $("profile-dropdown");
const messengerBtn = $("messenger-btn");
const messengerDropdown = $("messenger-dropdown");
const notifBtn = $("notif-btn");
const notifDropdown = $("notif-dropdown");
const notifBadge = $("notif-badge");
const friendsListEl = $("friends-list");
const chatWindowsRoot = $("chat-windows-root");

// prevent anchors with href="#" causing jump
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="#"]');
  if (a) e.preventDefault();
});

// show current user info
if ($("nav-username"))
  $("nav-username").textContent = currentUser.name || "Bạn";
if ($("nav-avatar"))
  $("nav-avatar").src =
    currentUser.avatar || `https://i.pravatar.cc/40?u=${currentUser._id}`;
if ($("left-avatar"))
  $("left-avatar").src =
    currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id}`;
if ($("create-avatar"))
  $("create-avatar").src =
    currentUser.avatar || `https://i.pravatar.cc/48?u=${currentUser._id}`;

// add small transition for theme toggling
document.documentElement.style.transition =
  "background 320ms ease, color 320ms ease";
setTimeout(() => {
  document.documentElement.style.transition = "";
}, 360);

// ===== Socket init w/ token (auth & query fallback) =====
let socket;
try {
  socket = io(API_URL, {
    transports: ["websocket", "polling"],
    auth: { token },
    query: { token },
  });
} catch (e) {
  console.warn("Socket init error:", e);
  socket = { on: () => {}, emit: () => {}, disconnect: () => {} };
}

// ===== helper =====
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, ">");
}
async function safeJson(res) {
  const txt = await res.text().catch(() => "");
  try {
    return JSON.parse(txt);
  } catch (e) {
    return txt;
  }
}
async function apiFetch(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token && !opts.skipAuth)
    opts.headers = { ...opts.headers, Authorization: `Bearer ${token}` };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await safeJson(res);
    const err = new Error(body?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// ===== Load posts (robust) =====
async function loadPosts() {
  if (!postsContainer) return;
  postsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Đang tải bài viết...</p>`;
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn("Private posts fetch failed, fallback to public fetch.");
      const pub = await fetch(`${API_URL}/api/posts`);
      if (!pub.ok) throw new Error("Không tải được bài (public fallback).");
      const j = await pub.json();
      renderPostsFromResponse(j);
      return;
    }
    const json = await res.json();
    renderPostsFromResponse(json);
  } catch (err) {
    console.error("loadPosts error:", err);
    postsContainer.innerHTML = `
      <div style="text-align:center;color:#c00;padding:12px">
        Không thể tải bài viết.<br/>
        <button id="retry-posts" class="btn">Thử lại</button>
        <button id="sample-posts" class="btn" style="margin-left:8px">Xem mẫu</button>
      </div>
    `;
    setTimeout(() => {
      const r = $("retry-posts");
      if (r) r.addEventListener("click", loadPosts);
      const s = $("sample-posts");
      if (s) s.addEventListener("click", showSamplePosts);
    }, 20);
  }
}

function renderPostsFromResponse(json) {
  let posts = [];
  if (!json) posts = [];
  else if (Array.isArray(json)) posts = json;
  else if (Array.isArray(json.posts)) posts = json.posts;
  else if (Array.isArray(json.data)) posts = json.data;
  else if (Array.isArray(json.result)) posts = json.result;
  else if (json.posts && Array.isArray(json.posts.data))
    posts = json.posts.data;
  else {
    for (const k of Object.keys(json || {})) {
      if (Array.isArray(json[k])) {
        posts = json[k];
        break;
      }
    }
  }

  if (!posts.length) {
    postsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Chưa có bài viết nào.</p>`;
    return;
  }

  postsContainer.innerHTML = "";
  try {
    posts = posts.slice().reverse();
  } catch (e) {}
  posts.forEach((p) => {
    try {
      const node = createPostNode(p);
      postsContainer.appendChild(node);
      setTimeout(() => node.classList.add("loaded"), 15);
    } catch (e) {
      console.warn("render post error", e);
    }
  });
  refreshFriendPoolFromPosts();
}
function showSamplePosts() {
  const sample = [
    {
      _id: "s1",
      createdAt: Date.now(),
      content: "Bài mẫu — server chưa phản hồi",
      user: {
        _id: "u1",
        name: "ZingMini",
        avatar: "https://i.pravatar.cc/44?u=1",
      },
    },
    {
      _id: "s2",
      createdAt: Date.now() - 3600000,
      content: "Bài mẫu 2",
      user: {
        _id: "u2",
        name: "Người A",
        avatar: "https://i.pravatar.cc/44?u=2",
      },
    },
  ];
  renderPostsFromResponse(sample);
}
loadPosts();

// ===== Create post (FormData) =====
if (postSubmit && postContent) {
  postSubmit.addEventListener("click", async (e) => {
    e.preventDefault();
    const content = postContent.value.trim();
    const file = postImage?.files?.[0] || null;
    if (!content && !file)
      return alert("Vui lòng nhập nội dung hoặc chọn ảnh!");
    const form = new FormData();
    form.append("content", content);
    if (file) form.append("image", file);

    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // DO NOT set Content-Type
        body: form,
      });
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.message || `Đăng bài thất bại (${res.status})`);
      }
      const newPostJson = await res.json();
      const realPost = newPostJson.post || newPostJson.data || newPostJson;
      const node = createPostNode(realPost);
      postsContainer.prepend(node);
      node.classList.add("loaded");
      postContent.value = "";
      if (postImage) postImage.value = "";
      if (mediaPreview) mediaPreview.innerHTML = "";
    } catch (err) {
      console.error("Create post error:", err);
      alert(err.message || "Không thể đăng bài. Kiểm tra console.");
    }
  });
}

// preview image/video
if (postImage && mediaPreview) {
  postImage.addEventListener("change", (e) => {
    mediaPreview.innerHTML = "";
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      if (file.type.startsWith("video/")) {
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
    fr.readAsDataURL(file);
  });
}

// ===== Render post =====
function createPostNode(post) {
  const id =
    post._id || post.id || `p_${Math.random().toString(36).slice(2, 8)}`;
  const time = new Date(post.createdAt || Date.now()).toLocaleString("vi-VN");
  const user = post.user ||
    post.author ||
    post.owner || { _id: "u_anon", name: post.name || "Ẩn danh", avatar: "" };
  const avatar =
    user.avatar || `https://i.pravatar.cc/44?u=${user._id || user.id || "x"}`;
  const content = post.content || post.text || "";

  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = id;
  div.innerHTML = `
    <div class="post-header">
      <img src="${escapeHtml(avatar)}" alt="${escapeHtml(
    user.name || "Người dùng"
  )}" data-id="${escapeHtml(user._id || user.id || "")}" />
      <div>
        <div style="font-weight:700">${escapeHtml(
          user.name || "Người dùng"
        )}</div>
        <div class="small">${escapeHtml(time)}</div>
      </div>
    </div>
    <div class="post-content">
      <p>${escapeHtml(content)}</p>
      ${post.image ? renderMediaHtml(post.image) : ""}
    </div>
    <div class="post-actions">
      <button class="btn like-btn">👍 Thích</button>
      <button class="btn comment-btn">💬 Bình luận</button>
    </div>
  `;

  const likeBtn = div.querySelector(".like-btn");
  likeBtn.addEventListener("click", () => {
    try {
      socket.emit("reaction", {
        postId: id,
        user: currentUser.name,
        reaction: "👍",
      });
    } catch (e) {
      console.warn(e);
    }
    likeBtn.classList.add("reaction-selected");
    likeBtn.textContent = "👍 • Bạn";
  });

  // avatar click opens chat window
  const img = div.querySelector("img[data-id]");
  if (img)
    img.addEventListener("click", () => {
      const fid = img.getAttribute("data-id");
      const fname = img.getAttribute("alt") || "Người dùng";
      if (fid) openChatWindow(fid, fname);
    });

  return div;
}
function renderMediaHtml(path) {
  if (!path) return "";
  const url =
    typeof path === "string" && path.startsWith("http")
      ? path
      : `${API_URL}${path}`;
  const ext = url.split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg"].includes(ext))
    return `<video controls src="${escapeHtml(
      url
    )}" style="width:100%;border-radius:8px;margin-top:8px"></video>`;
  return `<img src="${escapeHtml(
    url
  )}" style="width:100%;border-radius:8px;margin-top:8px" />`;
}

// ===== Friend pool derived from posts =====
let friendPool = {};
function refreshFriendPoolFromPosts() {
  friendPool = {};
  document.querySelectorAll(".post-card").forEach((pc) => {
    const img = pc.querySelector("img[data-id]");
    if (!img) return;
    const id = img.getAttribute("data-id");
    const name = img.getAttribute("alt") || "Bạn";
    const avatar = img.src;
    if (id) friendPool[id] = { _id: id, name, avatar };
  });
  renderFriendsList();
}
function renderFriendsList() {
  if (!friendsListEl) return;
  friendsListEl.innerHTML = "";
  const ids = Object.keys(friendPool);
  if (!ids.length) {
    friendsListEl.innerHTML = `<div class="small">Không có bạn online</div>`;
    return;
  }
  ids.slice(0, 12).forEach((id) => {
    const u = friendPool[id];
    const el = document.createElement("div");
    el.className = "s-item";
    el.innerHTML = `<img src="${escapeHtml(u.avatar)}" data-id="${escapeHtml(
      u._id
    )}" alt="${escapeHtml(u.name)}"/><div>${escapeHtml(u.name)}</div>`;
    el.addEventListener("click", () => openChatWindow(u._id, u.name));
    friendsListEl.appendChild(el);
  });
}
const postsObserver = new MutationObserver(refreshFriendPoolFromPosts);
if (postsContainer)
  postsObserver.observe(postsContainer, { childList: true, subtree: true });

// ===== Chat windows & socket handlers =====
const openChats = {};
function openChatWindow(friendId, friendName) {
  if (!chatWindowsRoot) return;
  if (openChats[friendId]) {
    chatWindowsRoot.prepend(openChats[friendId]);
    return;
  }
  const win = document.createElement("div");
  win.className = "chat-window";
  win.dataset.uid = friendId;
  win.innerHTML = `
    <div class="head"><div style="display:flex;align-items:center;gap:8px"><div>${escapeHtml(
      friendName
    )}</div></div>
      <div><button class="mini collapse">_</button><button class="mini close">×</button></div>
    </div>
    <div class="body"></div>
    <div class="foot"><input class="cw-input" placeholder="Nhập tin nhắn..."/><button class="cw-send btn">Gửi</button></div>
  `;
  chatWindowsRoot.prepend(win);
  chatWindowsRoot.style.pointerEvents = "auto";
  openChats[friendId] = win;
  const body = win.querySelector(".body");
  const input = win.querySelector(".cw-input");
  const sendBtn = win.querySelector(".cw-send");
  const closeBtn = win.querySelector(".close");
  const collapseBtn = win.querySelector(".collapse");

  // try load history
  (async () => {
    try {
      const msgs = await apiFetch(
        `${API_URL}/api/messages/${currentUser._id}/${friendId}`
      );
      if (Array.isArray(msgs))
        msgs.forEach((m) =>
          appendChatMessage(
            body,
            m.from === currentUser._id ? currentUser.name : m.userName || "Họ",
            m.text,
            m.from === currentUser._id ? "you" : "them"
          )
        );
      else if (Array.isArray(msgs.data))
        msgs.data.forEach((m) =>
          appendChatMessage(
            body,
            m.from === currentUser._id ? currentUser.name : m.userName || "Họ",
            m.text,
            m.from === currentUser._id ? "you" : "them"
          )
        );
    } catch (e) {}
  })();

  sendBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    try {
      socket.emit("private_chat", {
        from: currentUser._id,
        to: friendId,
        text,
        userName: currentUser.name,
      });
    } catch (e) {}
    appendChatMessage(body, currentUser.name, text, "you");
    input.value = "";
    try {
      await apiFetch(`${API_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: currentUser._id,
          to: friendId,
          text,
          userName: currentUser.name,
        }),
      });
    } catch (e) {}
  });

  closeBtn.addEventListener("click", () => {
    win.remove();
    delete openChats[friendId];
  });
  collapseBtn.addEventListener("click", () => {
    const b = win.querySelector(".body");
    const f = win.querySelector(".foot");
    const hidden = b.style.display === "none";
    b.style.display = hidden ? "block" : "none";
    f.style.display = hidden ? "flex" : "none";
  });
}
function appendChatMessage(bodyEl, user, text, cls = "them") {
  const el = document.createElement("div");
  el.className = `message ${cls}`;
  el.innerHTML = `<b>${escapeHtml(user)}:</b> ${escapeHtml(text)}`;

  // Thêm tin nhắn mới lên trên đầu
  if (bodyEl.firstChild) bodyEl.insertBefore(el, bodyEl.firstChild);
  else bodyEl.appendChild(el);

  // Tự động cuộn lên trên để thấy tin mới
  bodyEl.scrollTop = 0;
}

// socket events
if (socket && socket.on) {
  socket.on("connect", () => console.log("socket connected", socket.id));
  socket.on("disconnect", () => console.log("socket disconnected"));
  socket.on("private_chat", (msg) => {
    const otherId = msg.from === currentUser._id ? msg.to : msg.from;
    const otherName = msg.userName || "Bạn";
    if (!openChats[otherId]) openChatWindow(otherId, otherName);
    const body = openChats[otherId].querySelector(".body");
    appendChatMessage(
      body,
      msg.userName || otherName,
      msg.text,
      msg.from === currentUser._id ? "you" : "them"
    );
    if (notifBadge) {
      notifBadge.classList.remove("hidden");
      notifBadge.textContent =
        (parseInt(notifBadge.textContent || "0") || 0) + 1;
    }
  });
  socket.on("reaction", (r) => {
    const node = document.querySelector(
      `.post-card[data-post-id="${r.postId}"]`
    );
    if (node) {
      const likeBtn = node.querySelector(".like-btn");
      if (likeBtn) {
        likeBtn.textContent = `${r.reaction} • ${
          r.user === currentUser.name ? "Bạn" : r.user
        }`;
        likeBtn.classList.add("reaction-selected");
      }
    }
  });
  socket.on("connect_error", (err) =>
    console.warn("socket connect_error", err)
  );
}

// ===== UI: profile dropdown toggle + logout button (top) =====
if (profileBtn) {
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (profileDropdown) profileDropdown.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".profile-wrap") && profileDropdown)
      profileDropdown.classList.add("hidden");
  });
}
if (logoutTop) {
  logoutTop.addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm("Bạn có muốn đăng xuất?")) return;
    try {
      socket.disconnect();
    } catch (e) {}
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    location.href = "index.html";
  });
}

// messenger dropdown lazy populate
if (messengerBtn && messengerDropdown) {
  messengerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    messengerDropdown.classList.toggle("hidden");
    if (
      !messengerDropdown.classList.contains("hidden") &&
      messengerDropdown.innerHTML.trim() === ""
    ) {
      messengerDropdown.innerHTML = "";
      const ids = Object.keys(friendPool);
      if (!ids.length) {
        messengerDropdown.innerHTML = `<div class="small">Không có liên hệ</div>`;
        return;
      }
      ids.slice(0, 6).forEach((id) => {
        const u = friendPool[id];
        const item = document.createElement("div");
        item.className = "card";
        item.style.display = "flex";
        item.style.gap = "8px";
        item.style.alignItems = "center";
        item.innerHTML = `<img src="${escapeHtml(
          u.avatar
        )}" style="width:36px;height:36px;border-radius:50%"/><div style="flex:1">${escapeHtml(
          u.name
        )}</div><button class="btn open-chat" data-id="${escapeHtml(
          u._id
        )}">Chat</button>`;
        const btn = item.querySelector(".open-chat");
        btn.addEventListener("click", () => openChatWindow(u._id, u.name));
        messengerDropdown.appendChild(item);
      });
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".icon-wrap") && messengerDropdown)
      messengerDropdown.classList.add("hidden");
  });
}

// notif dropdown
if (notifBtn && notifDropdown) {
  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle("hidden");
    if (!notifDropdown.classList.contains("hidden")) {
      if (notifBadge) {
        notifBadge.classList.add("hidden");
        notifBadge.textContent = "0";
      }
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".icon-wrap") && notifDropdown)
      notifDropdown.classList.add("hidden");
  });
}

// expose debug helpers
window.__ZINGMINI__ = {
  reloadPosts: loadPosts,
  showFriends: () => console.log(friendPool),
  socketId: () => socket && socket.id,
  openChatWindow,
};

// done
