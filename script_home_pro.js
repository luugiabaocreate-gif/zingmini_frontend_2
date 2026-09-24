// script_home_pro.js — FINAL (posts newest on top, chat newest on top, no-duplicate realtime)
// Full features: load posts, create post (backend returns array), realtime chat (no duplicate),
// reactions, logout, theme toggle, friends list -> open chat windows.
// Import socket.io client (ESM)
import io from "https://cdn.socket.io/4.6.1/socket.io.esm.min.js";

const API_URL = "https://zingmini-backend-2.onrender.com";

// ===== Auth check =====
const token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
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
const profileBtn = $("profile-btn");
const profileDropdown = $("profile-dropdown");
const messengerBtn = $("messenger-btn");
const messengerDropdown = $("messenger-dropdown");
const notifBtn = $("notif-btn");
const notifDropdown = $("notif-dropdown");
const notifBadge = $("notif-badge");
const friendsListEl = $("friends-list");
const chatWindowsRoot = $("chat-windows-root");
// ===== SHORTS DOM REFS =====
const navShorts = $("nav-shorts"); // nút trong top nav
const shortsSection = $("shorts-section"); // toàn khung shorts
const shortsContainer = $("shortsContainer"); // nơi render các short
const shortInput = $("shortInput"); // file input (upload)
const shortDesc = $("shortDesc"); // mô tả (optional)
const uploadShortBtn = $("uploadShortBtn"); // nút upload
// helper: normal feed (posts)
const normalFeed = document.querySelector(".feed-list");

// prevent anchors with href="#" causing jump
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="#"]');
  if (a) e.preventDefault();
});

// show current user info if elements exist
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

// tiny theme transition (CSS untouched)
document.documentElement.style.transition =
  "background 320ms ease, color 320ms ease";
setTimeout(() => {
  document.documentElement.style.transition = "";
}, 360);

// ---------------- Theme (persist to localStorage) ----------------
// Add this right after your tiny theme transition block.
(function initThemeToggle() {
  const KEY = "zingmini_theme"; // localStorage key
  // button ref (you already declared toggleThemeBtn earlier)
  const btn = toggleThemeBtn || document.getElementById("toggle-theme");

  // prefer dark if user OS prefers & no saved value
  const systemPrefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  // load saved or fallback
  const saved = localStorage.getItem(KEY);
  const initial = saved ? saved : systemPrefersDark ? "dark" : "light";

  function applyTheme(theme) {
    if (theme === "dark") {
      document.body.classList.add("dark");
      document.documentElement.classList.add("dark"); // in case some rules target html
      if (btn) btn.setAttribute("aria-pressed", "true");
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'; // switch to light
    } else {
      document.body.classList.remove("dark");
      document.documentElement.classList.remove("dark");
      if (btn) btn.setAttribute("aria-pressed", "false");
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2z"/></svg>'; // switch to dark
    }
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {
      /* ignore */
    }
  }

  // initialize
  applyTheme(initial);

  // wire up button
  if (btn) {
    btn.addEventListener("click", (e) => {
      const next = document.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
      // optional: dispatch event so other modules can react
      window.dispatchEvent(
        new CustomEvent("theme:changed", { detail: { theme: next } })
      );
    });
  } else {
    // If button not present, still allow toggle via keyboard shortcut (Ctrl+J) for dev convenience
    window.addEventListener("keydown", (ev) => {
      if (ev.ctrlKey && ev.key.toLowerCase() === "j") {
        const next = document.body.classList.contains("dark")
          ? "light"
          : "dark";
        applyTheme(next);
        window.dispatchEvent(
          new CustomEvent("theme:changed", { detail: { theme: next } })
        );
      }
    });
  }
})();

// ===== Socket.io init with token (auth + query fallback) =====
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

// ===== Helpers =====
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return JSON.parse(t);
  } catch (e) {
    return t;
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

// ===== POSTS: load & render (newest on top) =====
async function loadPosts() {
  if (!postsContainer) return;
  postsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Đang tải bài viết...</p>`;
  try {
    // try private first
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    renderPostsFromResponse(json);
  } catch (err) {
    console.warn("Private posts fetch failed, trying public...", err);
    try {
      const pub = await fetch(`${API_URL}/api/posts`);
      if (!pub.ok) throw new Error("Không tải được bài (public fallback).");
      const j = await pub.json();
      renderPostsFromResponse(j);
    } catch (e) {
      console.error("loadPosts error:", e);
      postsContainer.innerHTML = `<div style="text-align:center;color:#c00;padding:12px">Không thể tải bài viết.<br/><button id="retry-posts" class="btn">Thử lại</button></div>`;
      setTimeout(() => {
        const r = $("retry-posts");
        if (r) r.addEventListener("click", loadPosts);
      }, 20);
    }
  }
}

function renderPostsFromResponse(json) {
  let posts = [];
  if (!json) posts = [];
  else if (Array.isArray(json)) posts = json;
  else if (Array.isArray(json.posts)) posts = json.posts;
  else if (Array.isArray(json.data)) posts = json.data;
  else {
    // search for first array
    for (const k of Object.keys(json || {}))
      if (Array.isArray(json[k])) {
        posts = json[k];
        break;
      }
  }

  // ensure newest first (we will display with newest on top)
  // try {
  //  posts = posts.slice().reverse();
  // } catch (e) {}

  postsContainer.innerHTML = "";
  if (!posts.length) {
    postsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Chưa có bài viết nào.</p>`;
    return;
  }

  posts.forEach((p) => {
    try {
      const node = createPostNode(p);
      postsContainer.appendChild(node);
      setTimeout(() => node.classList.add("loaded"), 10);
    } catch (err) {
      console.warn("render post error:", err);
    }
  });

  refreshFriendPoolFromPosts();
}
loadPosts();
// ===== LOAD & RENDER SHORTS =====
async function loadShorts() {
  if (!shortsContainer) return;
  try {
    shortsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Đang tải Shorts...</p>`;
    const res = await fetch(`${API_URL}/api/getShorts`);
    if (!res.ok) throw new Error("Không tải được shorts");
    const data = await res.json();
    if (!Array.isArray(data)) {
      // nếu backend trả object, cố gắng lấy array trực tiếp
      const arr = data.shorts || data.data || data.items || [];
      renderShorts(arr);
      return;
    }
    renderShorts(data);
  } catch (err) {
    console.error("loadShorts error:", err);
    shortsContainer.innerHTML = `<div style="text-align:center;color:#c00;padding:12px">Không thể tải Shorts.</div>`;
  }
}

// helper render function (separate để tidy)
function renderShorts(list) {
  if (!shortsContainer) return;
  if (!list || !list.length) {
    shortsContainer.innerHTML = `<p style="text-align:center;color:#777;padding:12px">Chưa có Short nào.</p>`;
    return;
  }
  // render cards (simple grid; you can later style into full-screen swipe)
  shortsContainer.innerHTML = "";
  list.forEach((s) => {
    const div = document.createElement("div");
    div.className = "short-card";
    // video source may already be absolute (cloudinary) or relative
    const src =
      s.videoUrl || s.video || (s.videoUrl && `${API_URL}${s.videoUrl}`);
    div.innerHTML = `
      <video src="${escapeHtml(
        src
      )}" controls playsinline preload="metadata" style="width:100%;height:auto;display:block;border-radius:8px;object-fit:cover"></video>
      <div style="padding:8px;font-size:13px;color:var(--text-color,#183b6d)">${escapeHtml(
        s.description || s.caption || ""
      )}</div>
    `;
    shortsContainer.appendChild(div);
  });
}

// When backend's POST /api/posts returns an array (confirmed) we re-render from that array
async function createPostHandler() {
  if (!postSubmit || !postContent) return;
  postSubmit.addEventListener("click", async (e) => {
    e.preventDefault();
    const content = postContent.value.trim();
    const file = postImage?.files?.[0] || null;
    if (!content && !file)
      return alert("Vui lòng nhập nội dung hoặc chọn ảnh!");

    const form = new FormData();
    form.append("content", content);
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["mp4", "mov", "avi", "webm"].includes(ext)) {
        form.append("video", file); // gửi video vào field "video"
      } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
        form.append("image", file); // gửi ảnh vào field "image"
      } else {
        form.append("file", file); // các file khác: pdf, zip...
      }
    }

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

      const json = await res.json();
      // backend returns array of posts — render from response so newest is on top
      if (Array.isArray(json)) {
        renderPostsFromResponse(json);
      } else if (json.posts || json.data) {
        renderPostsFromResponse(json);
      } else {
        // fallback: insert single returned post at top
        const realPost = json.post || json.data || json;
        const node = createPostNode(realPost);
        postsContainer.prepend(node);
        setTimeout(() => node.classList.add("loaded"), 10);
      }

      // clear inputs
      postContent.value = "";
      if (postImage) postImage.value = "";
      if (mediaPreview) mediaPreview.innerHTML = "";
    } catch (err) {
      console.error("Create post error:", err);
      alert(err.message || "Không thể đăng bài. Kiểm tra console.");
    }
  });
}
createPostHandler();

// preview image/video
if (postImage && mediaPreview) {
  postImage.addEventListener("change", (e) => {
    mediaPreview.innerHTML = "";
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    if (["mp4", "mov", "avi", "webm"].includes(ext)) {
      const v = document.createElement("video");
      v.controls = true;
      v.src = URL.createObjectURL(file);
      v.style.maxWidth = "220px";
      mediaPreview.appendChild(v);
    } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.style.maxWidth = "220px";
      mediaPreview.appendChild(img);
    } else {
      const link = document.createElement("div");
      link.textContent = `📎 ${file.name}`;
      link.style.color = "#007bff";
      mediaPreview.appendChild(link);
    }
  });
}

// render post node
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
      ${
        post.video
          ? `<video controls src="${escapeHtml(
              post.video
            )}" style="width:100%;border-radius:8px;margin-top:8px"></video>`
          : post.image
          ? `<img src="${escapeHtml(
              post.image
            )}" style="width:100%;border-radius:8px;margin-top:8px" />`
          : post.file
          ? `<a href="${escapeHtml(post.file)}" target="_blank">📎 ${escapeHtml(
              post.file.split("/").pop()
            )}</a>`
          : ""
      }

    </div>
    <div class="post-actions">
  <button class="btn like-btn">👍 Thích</button>
  <button class="btn comment-btn">💬 Bình luận</button>
  ${
    post.user &&
    (post.user._id === currentUser._id || post.user === currentUser._id)
      ? `<button class="btn delete-post-btn" data-id="${id}">🗑️ Xóa</button>`
      : ""
  }
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
    } catch (e) {}
    likeBtn.classList.add("reaction-selected");
    likeBtn.innerHTML = '<span aria-hidden="true">♡</span> Bạn';
  });

  // === THÊM ĐOẠN NÀY SAU LIKE ===
  const commentBtn = div.querySelector(".comment-btn");
  commentBtn.addEventListener("click", () => {
    openCommentBox(id);
  });

  const deleteBtn = div.querySelector(".delete-post-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Bạn có chắc muốn xóa bài viết này không?")) return;
      try {
        const res = await fetch(`${API_URL}/api/posts/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          alert("✅ Đã xóa bài viết!");
          div.remove();
        } else {
          alert(data.message || "Không thể xóa bài viết!");
        }
      } catch (err) {
        console.error("Lỗi xóa post:", err);
        alert("Không thể xóa bài viết!");
      }
    });
  }

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

// ===== FRIENDS pool derived from posts =====
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
    el.innerHTML = `
  <img src="${escapeHtml(u.avatar)}" data-id="${escapeHtml(
      u._id
    )}" alt="${escapeHtml(u.name)}"/>
  <div style="flex:1;display:flex;align-items:center;justify-content:space-between">
    <span>${escapeHtml(u.name)}</span>
    ${u.online ? '<span class="online-dot" title="Đang online"></span>' : ""}
  </div>
`;
    el.addEventListener("click", () => openChatWindow(u._id, u.name));
    friendsListEl.appendChild(el);
  });
}
const postsObserver = new MutationObserver(refreshFriendPoolFromPosts);
if (postsContainer)
  postsObserver.observe(postsContainer, { childList: true, subtree: true });

// ===== CHAT: windows, history, send, receive =====
// We'll keep newest messages on TOP. Ensure history loads newest-first, and live messages inserted at top.
// To avoid duplicate echoes, maintain a short-lived recentSent map per chat with texts + timestamps.

const openChats = {};
const recentSent = {}; // { chatId: [{text, ts}] }  // used to ignore server-echo duplicates within 2s

function recordSent(chatId, text) {
  if (!recentSent[chatId]) recentSent[chatId] = [];
  recentSent[chatId].push({ text, ts: Date.now() });
  // prune older than 5s
  recentSent[chatId] = recentSent[chatId].filter(
    (x) => Date.now() - x.ts < 5000
  );
}
function isRecentSentEcho(chatId, text) {
  if (!recentSent[chatId]) return false;
  return recentSent[chatId].some(
    (x) => x.text === text && Date.now() - x.ts <= 3000
  );
}

// Append message NEWEST AT BOTTOM (Messenger-style)
function appendChatMessage(
  bodyEl,
  user,
  text,
  cls = "them",
  options = { temporary: false }
) {
  const el = document.createElement("div");
  el.className = `message ${cls}`;
  el.innerHTML = `<b>${escapeHtml(user)}:</b> ${escapeHtml(text)}`;
  // append at bottom
  bodyEl.appendChild(el);
  // auto-scroll to bottom
  bodyEl.scrollTop = bodyEl.scrollHeight;
  // optional fade-in for temporary messages
  if (options.temporary) {
    el.style.opacity = "0.7";
    setTimeout(() => (el.style.opacity = "1"), 600);
  }
}

// open chat window (if exists, bring to top)
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
    <div class="head">
      <div style="display:flex;align-items:center;gap:8px">
        <div>${escapeHtml(friendName)}</div>
        <button class="btn btn-voice" title="Gọi thoại">📞</button>
        <button class="btn btn-video" title="Gọi video">📹</button>
      </div>
      <div>
        <button class="mini collapse">_</button>
        <button class="mini close">×</button>
      </div>
    </div>
    <div class="body"></div>
    <div class="foot">
      <input class="cw-input" placeholder="Nhập tin nhắn..."/>
      <button class="cw-send btn">Gửi</button>
    </div>
  `;
  chatWindowsRoot.prepend(win);
  chatWindowsRoot.style.pointerEvents = "auto";
  openChats[friendId] = win;
  const body = win.querySelector(".body");
  const input = win.querySelector(".cw-input");
  const sendBtn = win.querySelector(".cw-send");
  const closeBtn = win.querySelector(".close");
  const collapseBtn = win.querySelector(".collapse");
  // 🎧 Nút gọi thoại
  const voiceBtn = win.querySelector(".btn-voice");
  voiceBtn.addEventListener("click", () => {
    startVoiceCall(friendId, friendName);
  });
  // 🎥 Nút gọi video (chưa triển khai)
  const videoBtn = win.querySelector(".btn-video");
  videoBtn.addEventListener("click", () => {
    startVideoCall(friendId, friendName);
  });
  // load history — ensure newest-first display
  (async () => {
    try {
      const msgs = await apiFetch(
        `${API_URL}/api/messages/${currentUser._id}/${friendId}`
      );
      let arr = Array.isArray(msgs) ? msgs : msgs.data || msgs.messages || [];
      if (!Array.isArray(arr)) arr = [];
      // arr likely sorted oldest->newest; giữ nguyên để chat hiển thị tự nhiên (tin cũ trên, tin mới dưới)
      try {
        // arr = arr.slice().reverse(); // bỏ reverse
      } catch (e) {}
      arr.forEach((m) => {
        const cls = m.from === currentUser._id ? "you" : "them";
        const userName =
          m.from === currentUser._id ? currentUser.name : m.userName || "Họ";
        appendChatMessage(body, userName, m.text, cls);
      });
    } catch (e) {
      // ignore if endpoint not available
      console.warn("Could not load chat history:", e);
    }
  })();

  sendBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    // record sent text to avoid echo duplication
    recordSent(friendId, text);
    // optimistic UI: insert at top as temporary
    appendChatMessage(body, currentUser.name, text, "you", { temporary: true });
    input.value = "";
    // emit via socket (server should route to recipient and echo appropriately)
    try {
      socket.emit("private_chat", {
        from: currentUser._id,
        to: friendId,
        text,
        userName: currentUser.name,
      });
    } catch (e) {
      console.warn(e);
    }
    // persist via API (non-blocking)
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
    } catch (e) {
      /* ignore persist errors */
    }
  });

  closeBtn.addEventListener("click", () => {
    win.remove();
    delete openChats[friendId];
  });
  collapseBtn.addEventListener("click", () => {
    const b = win.querySelector(".body"),
      f = win.querySelector(".foot");
    const hidden = b.style.display === "none";
    b.style.display = hidden ? "block" : "none";
    f.style.display = hidden ? "flex" : "none";
  });
}

// socket handlers
if (socket && socket.on) {
  socket.on("connect", () => console.log("socket connected", socket.id));
  socket.on("disconnect", () => console.log("socket disconnected"));

  socket.on("private_chat", (msg) => {
    // msg: { from, to, text, userName }
    // ignore duplicates: if server echoes the message sent by this client, skip if we recently recorded same text
    const chatId = msg.from === currentUser._id ? msg.to : msg.from;
    const isEchoOfMine =
      msg.from === currentUser._id && isRecentSentEcho(chatId, msg.text);
    if (isEchoOfMine) {
      // consume and ignore echo (prune record)
      if (recentSent[chatId])
        recentSent[chatId] = recentSent[chatId].filter(
          (x) => x.text !== msg.text
        );
      return;
    }

    // nếu chat window chưa mở -> mở mới
    if (!openChats[chatId]) openChatWindow(chatId, msg.userName || "Bạn");

    // lấy lại body sau khi mở
    const body = openChats[chatId]?.querySelector(".body");
    if (!body) return;

    // append tin nhắn mới vào đúng khung đang mở (ở DƯỚI cùng)
    const cls = msg.from === currentUser._id ? "you" : "them";
    const userName =
      msg.from === currentUser._id ? currentUser.name : msg.userName || "Họ";

    const el = document.createElement("div");
    el.className = `message ${cls}`;
    el.innerHTML = `<b>${escapeHtml(userName)}:</b> ${escapeHtml(msg.text)}`;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;

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
        likeBtn.innerHTML = `<span aria-hidden="true">♡</span> ${r.user === currentUser.name ? "Bạn" : r.user}`;
        likeBtn.classList.add("reaction-selected");
      }
    }
  });

  socket.on("connect_error", (err) =>
    console.warn("socket connect_error", err)
  );
  // ===== Realtime: nhận danh sách user online =====
  socket.on("online_users", (ids) => {
    try {
      const set = new Set((ids || []).map(String));
      Object.keys(friendPool).forEach((id) => {
        friendPool[id].online = set.has(String(id));
      });
      // render lại danh sách
      renderFriendsList();
    } catch (e) {
      console.warn("online_users handler error:", e);
    }
  });
  // socket realtime: nhận short mới
  socket.on &&
    socket.on("newShort", (s) => {
      try {
        // nếu đang hiển thị shorts, prepend mới
        if (shortsContainer) {
          const div = document.createElement("div");
          div.className = "short-card";
          const src =
            s.videoUrl || s.video || (s.videoUrl && `${API_URL}${s.videoUrl}`);
          div.innerHTML = `
        <video src="${escapeHtml(
          src
        )}" controls playsinline preload="metadata" style="width:100%;height:auto;display:block;border-radius:8px;object-fit:cover"></video>
        <div style="padding:8px;font-size:13px;color:var(--text-color,#183b6d)">${escapeHtml(
          s.description || s.caption || ""
        )}</div>
      `;
          // insert on top
          shortsContainer.prepend(div);
        }
      } catch (err) {
        console.warn("socket newShort error:", err);
      }
    });
}

// ===== UI: profile dropdown + logout =====
if (profileBtn) {
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (profileDropdown) profileDropdown.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".profile-menu-wrap") && profileDropdown)
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
// ===== SHORTS NAV HANDLER =====
if (navShorts) {
  navShorts.addEventListener("click", (e) => {
    e.preventDefault();
    // bật active trên nav
    document
      .querySelectorAll(".nav-btn")
      .forEach((n) => n.classList.remove("active"));
    navShorts.classList.add("active");
    // ẩn feed cũ, hiện section short
    if (normalFeed) normalFeed.style.display = "none";
    if (shortsSection) {
      shortsSection.classList.remove("hidden");
      shortsSection.setAttribute("aria-hidden", "false");
    }
    // load list shorts
    if (typeof loadShorts === "function") loadShorts();
  });
}

// All done
// --- Chat auto-fix layout sync ---
const observer = new MutationObserver(() => {
  document.querySelectorAll(".chat-window .body").forEach((body) => {
    // đảm bảo cuộn xuống cuối cùng mỗi khi có tin nhắn mới
    body.scrollTop = body.scrollHeight;
    // ép browser tính lại layout (tránh render chồng)
    body.style.display = "none";
    void body.offsetHeight; // force reflow
    body.style.display = "";
  });
});
observer.observe(document.body, { childList: true, subtree: true });
/******************************************************
 * 🎧 VOICE CALL FEATURE — WebRTC + Socket.IO
 ******************************************************/
let currentPeer = null;
let localStream = null;
let remoteAudioEl = null;

async function startVoiceCall(friendId, friendName) {
  if (!socket || !socket.connected) return alert("Socket chưa sẵn sàng!");
  if (currentPeer) return alert("Bạn đang trong một cuộc gọi khác!");

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:relay1.expressturn.com:3478",
        username: "efree",
        credential: "turnpassword",
      },
    ],
  });
  currentPeer = pc;

  // lấy micro
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert("Không thể truy cập micro: " + err.message);
    currentPeer = null;
    return;
  }

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate)
      socket.emit("call-ice", { to: friendId, candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    if (!remoteAudioEl) {
      remoteAudioEl = document.createElement("audio");
      remoteAudioEl.autoplay = true;
      remoteAudioEl.playsInline = true; // ✅ cho phép phát audio trên iPhone
      remoteAudioEl.controls = true; // ✅ hiển thị nút play nếu bị chặn autoplay
      remoteAudioEl.style.position = "fixed";
      remoteAudioEl.style.bottom = "10px";
      remoteAudioEl.style.left = "10px";
      remoteAudioEl.style.zIndex = "9999";
      document.body.appendChild(remoteAudioEl);
    }

    console.log("🔊 Nhận stream audio từ peer:", e.streams[0]);
    remoteAudioEl.srcObject = e.streams[0];

    const playAudio = async () => {
      try {
        await remoteAudioEl.play();
        console.log("🎧 Phát âm thanh thành công!");
      } catch (err) {
        console.warn("⚠️ Audio chưa phát được, chờ người dùng tương tác:", err);
      }
    };
    playAudio();
    document.body.addEventListener(
      "touchstart",
      async () => {
        if (remoteAudioEl && remoteAudioEl.paused) {
          try {
            await remoteAudioEl.play();
            console.log("🎧 Bắt đầu phát âm thanh sau khi người dùng chạm!");
          } catch (err) {
            console.warn("Không thể phát audio:", err);
          }
        }
      },
      { once: true }
    );
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("call-offer", {
    to: friendId,
    offer,
    from: currentUser._id,
    userName: currentUser.name,
  });

  alert(`📞 Đang gọi ${friendName}...`);
  // Thêm nút kết thúc cuộc gọi
  const endBtn = document.createElement("button");
  endBtn.textContent = "📴 Kết thúc cuộc gọi";
  endBtn.className = "btn end-call-btn";
  endBtn.style.position = "fixed";
  endBtn.style.bottom = "20px";
  endBtn.style.right = "20px";
  endBtn.style.zIndex = "9999";
  endBtn.style.padding = "10px 14px";
  endBtn.style.borderRadius = "10px";
  endBtn.style.background = "#ff4d4f";
  endBtn.style.color = "#fff";
  document.body.appendChild(endBtn);

  endBtn.addEventListener("click", () => {
    socket.emit("call-end", { to: friendId });
    endVoiceCall();
    endBtn.remove();
  });
}

// Nhận cuộc gọi
socket.on("call-offer", async (data) => {
  if (data.type === "video") return handleIncomingVideoCall(data);
  if (!confirm(`📞 ${data.userName} đang gọi bạn. Nhận cuộc gọi?`)) {
    socket.emit("call-end", { to: data.from });
    return;
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:relay1.expressturn.com:3478",
        username: "efree",
        credential: "turnpassword",
      },
    ],
  });
  currentPeer = pc;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert("Không thể mở micro: " + err.message);
    socket.emit("call-end", { to: data.from });
    return;
  }

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate)
      socket.emit("call-ice", { to: data.from, candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    if (!remoteAudioEl) {
      remoteAudioEl = document.createElement("audio");
      remoteAudioEl.autoplay = true;
      remoteAudioEl.playsInline = true; // ✅ cho phép phát audio trên iPhone
      remoteAudioEl.controls = true; // ✅ hiển thị nút play nếu bị chặn autoplay
      remoteAudioEl.style.position = "fixed";
      remoteAudioEl.style.bottom = "10px";
      remoteAudioEl.style.left = "10px";
      remoteAudioEl.style.zIndex = "9999";
      document.body.appendChild(remoteAudioEl);
    }

    console.log("🔊 Nhận stream audio từ peer:", e.streams[0]);
    remoteAudioEl.srcObject = e.streams[0];

    const playAudio = async () => {
      try {
        await remoteAudioEl.play();
        console.log("🎧 Phát âm thanh thành công!");
      } catch (err) {
        console.warn("⚠️ Audio chưa phát được, chờ người dùng tương tác:", err);
      }
    };
    playAudio();
    document.body.addEventListener(
      "touchstart",
      async () => {
        if (remoteAudioEl && remoteAudioEl.paused) {
          try {
            await remoteAudioEl.play();
            console.log("🎧 Bắt đầu phát âm thanh sau khi người dùng chạm!");
          } catch (err) {
            console.warn("Không thể phát audio:", err);
          }
        }
      },
      { once: true }
    );
  };

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("call-answer", { to: data.from, answer });
});

// Nhận phản hồi
socket.on("call-answer", async (data) => {
  if (currentPeer) {
    await currentPeer.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  }
});

// ICE candidates
socket.on("call-ice", async (data) => {
  if (currentPeer && data.candidate) {
    try {
      await currentPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.warn("ICE error:", e);
    }
  }
});

// Kết thúc
socket.on("call-end", () => {
  endVoiceCall();
  document.querySelector(".end-call-btn")?.remove();
});

function endVoiceCall() {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (currentPeer) {
    currentPeer.close();
    currentPeer = null;
  }
  if (remoteAudioEl) {
    remoteAudioEl.remove();
    remoteAudioEl = null;
  }
  alert("📴 Cuộc gọi đã kết thúc");
}

// ESC = kết thúc cuộc gọi
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && currentPeer) {
    socket.emit("call-end", { to: null });
    endVoiceCall();
  }
});

// ==== HIỆN / LƯU / TẢI LẠI BÌNH LUẬN ====
async function openCommentBox(postId) {
  const postCard = document.querySelector(`[data-post-id="${postId}"]`);
  if (!postCard) return;

  // nếu đang mở thì đóng lại
  let existing = postCard.querySelector(".comment-box");
  if (existing) {
    existing.remove();
    return;
  }

  // khung bình luận
  const box = document.createElement("div");
  box.className = "comment-box";
  box.style.marginTop = "10px";
  box.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center">
      <img src="${
        currentUser.avatar || `https://i.pravatar.cc/36?u=${currentUser._id}`
      }"
           style="width:36px;height:36px;border-radius:50%" />
      <input class="comment-input" placeholder="Viết bình luận..."
             style="flex:1;padding:6px;border:1px solid #d7eefe;border-radius:8px"/>
      <button class="btn send-comment">Gửi</button>
    </div>
    <div class="comment-list" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>
  `;
  postCard.appendChild(box);

  const input = box.querySelector(".comment-input");
  const sendBtn = box.querySelector(".send-comment");
  const list = box.querySelector(".comment-list");

  // 🧩 Bước 1: tải các comment có sẵn
  try {
    const comments = await apiFetch(`${API_URL}/api/comments/post/${postId}`);
    if (Array.isArray(comments) && comments.length) {
      comments.forEach((c) => {
        const item = document.createElement("div");
        item.style.padding = "4px 6px";
        item.style.background = "#f6fbff";
        item.style.borderRadius = "6px";
        item.innerHTML = `<b>${escapeHtml(
          c.userName || "Ẩn danh"
        )}:</b> ${escapeHtml(c.text)}`;
        list.appendChild(item);
      });
    }
  } catch (err) {
    console.warn("Không thể tải bình luận:", err);
  }

  // 🧩 Bước 2: gửi comment mới
  sendBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    const temp = document.createElement("div");
    temp.style.padding = "4px 6px";
    temp.style.background = "#f6fbff";
    temp.style.borderRadius = "6px";
    temp.innerHTML = `<b>${escapeHtml(currentUser.name)}:</b> ${escapeHtml(
      text
    )}`;
    list.appendChild(temp);
    input.value = "";

    try {
      const res = await apiFetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId,
          text,
          userName: currentUser.name,
          userId: currentUser._id,
        }),
      });
      console.log("✅ Bình luận đã lưu:", res);
    } catch (err) {
      console.warn("❌ Lỗi khi lưu bình luận:", err);
    }
  });
}

// ==== MENU SIDEBAR ACTIONS ====

// Lấy danh sách tất cả liên kết trong menu trái
document.querySelectorAll(".left-menu a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const label = link.textContent.trim();

    switch (label) {
      case "Trang cá nhân":
        window.location.href = "profile.html"; // chuyển sang trang cá nhân
        break;
      case "Bảng tin":
        window.location.href = "feed.html"; // trang tổng hợp tin tức
        break;
      case "Game":
        window.location.href = "games.html"; // hiển thị danh sách game
        break;
      case "Quản trị":
        window.location.href = "admin.html"; // giao diện admin riêng
        break;
      case "Cài đặt":
        window.location.href = "settings.html"; // trang cài đặt tài khoản
        break;
      case "Truyện tranh":
        window.open("https://nettruyenzn.com/", "_blank");
        break;
      default:
        alert("Chức năng đang phát triển!");
    }
  });
});
// === Toggle menu hai bên trên mobile ===
const leftToggle = document.querySelector(".menu-toggle-left");
const rightToggle = document.querySelector(".menu-toggle-right");
const leftCol = document.querySelector(".left-col");
const rightCol = document.querySelector(".right-col");

if (leftToggle && leftCol) {
  const closeMobileMenus = () => {
    leftCol.classList.remove("show");
    rightCol?.classList.remove("show");
    document.body.classList.remove("mobile-menu-open");
  };

  leftToggle.addEventListener("click", () => {
    const open = !leftCol.classList.contains("show");
    leftCol.classList.toggle("show", open);
    rightCol?.classList.remove("show");
    document.body.classList.toggle("mobile-menu-open", open);
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 760 || !leftCol.classList.contains("show")) return;
    if (!leftCol.contains(event.target) && !leftToggle.contains(event.target)) closeMobileMenus();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMobileMenus();
  });
}

if (rightToggle && rightCol) {
  rightToggle.addEventListener("click", () => {
    rightCol.classList.toggle("show");
    leftCol?.classList.remove("show");
  });
}
// === Logout cho mobile ===
document.getElementById("logout-mobile")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "index.html";
});
// === Logout cho mobile ===
document.getElementById("logout-mobile")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "index.html";
});

document.getElementById("zing-shop-btn")?.addEventListener("click", () => {
  window.location.href = "shop.html";
});

// === Ẩn nút đăng xuất trên mobile khi bật chat ===
function isMobile() {
  return window.innerWidth <= 768; // ngưỡng cho mobile
}

function updateLogoutVisibilityMobile() {
  const logoutBtn = document.getElementById("logout-mobile");
  if (!logoutBtn) return;
  const hasChat = document.querySelectorAll(".chat-window").length > 0;
  // ẩn chỉ khi đang ở mobile và có cửa sổ chat mở
  if (isMobile()) {
    logoutBtn.style.display = hasChat ? "none" : "block";
  } else {
    logoutBtn.style.display = "block"; // desktop luôn hiện
  }
}

// Quan sát thay đổi số lượng chat
const mobileChatObserver = new MutationObserver(updateLogoutVisibilityMobile);
mobileChatObserver.observe(document.body, { childList: true, subtree: true });

// Cập nhật ngay khi load trang
window.addEventListener("resize", updateLogoutVisibilityMobile);
window.addEventListener("load", updateLogoutVisibilityMobile);

/************************************************************
 *  Normalize avatar URL + safe fetch current user + upload
 ************************************************************/

// Chuẩn hoá URL avatar: đảm bảo https + chuyển /uploads/... -> full URL
function normalizeAvatarUrl(raw) {
  if (!raw) return null;
  // nếu backend trả path tương đối '/uploads/..'
  if (raw.startsWith("/")) {
    return `${API_URL}${raw}`;
  }
  // nếu backend trả http (bị mixed content), chuyển sang https
  if (raw.startsWith("http://")) {
    try {
      const u = new URL(raw);
      u.protocol = "https:";
      return u.toString();
    } catch (e) {
      // fallback: replace
      return raw.replace(/^http:/, "https:");
    }
  }
  // nếu đã là https hoặc bất cứ absolute url, giữ nguyên
  return raw;
}

// Thử fetch user mới từ server; nếu lỗi 404 hoặc endpoint không tồn tại -> fallback dùng localStorage
async function fetchAndStoreCurrentUser() {
  if (!currentUser || !currentUser._id) return currentUser;

  try {
    // Thử endpoint chính (yêu cầu token)
    const res = await fetch(`${API_URL}/api/users/${currentUser._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // === Nếu token hết hạn hoặc mất token, fallback sang /api/users/public/:id ===
    if (!res.ok) {
      console.warn("⚠️ Token có thể hết hạn, thử tải public profile...");
      const res2 = await fetch(
        `${API_URL}/api/users/public/${currentUser._id}`
      );
      const data2 = await res2.json();
      if (data2?.success && data2?.user) {
        if (data2.user.avatar)
          data2.user.avatar = normalizeAvatarUrl(data2.user.avatar);
        localStorage.setItem("currentUser", JSON.stringify(data2.user));
        console.log("✅ Avatar đã được đồng bộ lại qua public API.");
        // Cập nhật UI avatar ngay
        ["left-avatar", "nav-avatar", "create-avatar"].forEach((id) => {
          const el = document.getElementById(id);
          if (el && data2.user.avatar) el.src = data2.user.avatar;
        });
        return data2.user;
      } else {
        console.warn(
          "⚠️ Không thể tải public profile, dùng localStorage thay thế."
        );
        return currentUser;
      }
    }

    // === Nếu token hợp lệ (200 OK) ===
    const j = await res.json();
    const userObj = j?.user ? j.user : j;
    if (!userObj) return currentUser;

    // Chuẩn hoá avatar URL
    if (userObj.avatar) userObj.avatar = normalizeAvatarUrl(userObj.avatar);

    // Chuẩn hoá avatar URL nếu backend trả về (relative -> absolute)
    if (userObj.avatar) userObj.avatar = normalizeAvatarUrl(userObj.avatar);

    // === BẢO VỆ: nếu localStorage đã có avatar mới dạng /uploads/... thì giữ cái đó, không ghi đè ===
    try {
      const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (
        stored &&
        stored.avatar &&
        String(stored.avatar).startsWith("/uploads/")
      ) {
        userObj.avatar = stored.avatar;
      }
    } catch (e) {
      console.warn("⚠️ Parse currentUser lỗi:", e);
    }

    // Lưu lại và cập nhật biến global currentUser
    // Chuẩn hoá avatar URL nếu backend trả về (relative -> absolute)
    if (userObj.avatar) userObj.avatar = normalizeAvatarUrl(userObj.avatar);

    // === BẢO VỆ: nếu localStorage đã có avatar mới (dạng /uploads/...) thì giữ lại, không ghi đè ===
    try {
      const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (
        stored &&
        stored.avatar &&
        (stored.avatar.startsWith("/uploads/") ||
          stored.avatar.includes("/uploads/"))
      ) {
        userObj.avatar = stored.avatar;
      }
    } catch (e) {
      console.warn("⚠️ Lỗi đọc localStorage currentUser:", e);
    }

    // Lưu lại và cập nhật biến module currentUser
    if (userObj.avatar) userObj.avatar = normalizeAvatarUrl(userObj.avatar);

    // Giữ avatar local nếu đã có và đang là /uploads/...
    try {
      const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (stored && stored.avatar && stored.avatar.includes("/uploads/")) {
        userObj.avatar = stored.avatar;
      }
    } catch (e) {}
    // Chuẩn hoá avatar nếu backend trả về
    if (userObj.avatar) {
      if (userObj.avatar.startsWith("/")) {
        userObj.avatar = `${API_URL}${userObj.avatar}`;
      } else if (userObj.avatar.startsWith("http://")) {
        userObj.avatar = userObj.avatar.replace("http://", "https://");
      }
    } else {
      userObj.avatar = `${API_URL}/uploads/default_avatar.png`;
    }

    localStorage.setItem("currentUser", JSON.stringify(userObj));
    console.log("✅ Avatar lưu cuối cùng:", userObj.avatar);
    currentUser = userObj;
    return userObj;
  } catch (err) {
    console.warn("fetchAndStoreCurrentUser error:", err);
    return currentUser;
  }
}

// gọi 1 lần khi load (không bắt buộc, an toàn)
fetchAndStoreCurrentUser()
  .then((u) => {
    if (!u) return;
    // cập nhật currentUser biến trong module (nếu cần)
    // NOTE: biến currentUser được khai báo const ở đầu -> để cập nhật UI sử dụng object lưu trong localStorage
    // cập nhật UI avatar nếu cần
    try {
      const stored = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (stored && stored.avatar) {
        ["left-avatar", "nav-avatar", "create-avatar"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.src = stored.avatar;
        });
      }
    } catch (e) {}
  })
  .catch(() => {});

// === Upload avatar handler (thay thế đoạn cũ hoàn toàn) ===
// === Upload avatar handler (ổn định, đồng bộ & không mất sau reload) ===
const avatarInput = document.getElementById("avatar-input");
const uploadAvatarBtn = document.getElementById("upload-avatar-btn");
const avatarFileName = document.getElementById("avatar-file-name");

if (avatarInput && avatarFileName) {
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    avatarFileName.textContent = file ? file.name : "Chưa chọn tệp";
    avatarFileName.title = file ? file.name : "";
  });
}

if (avatarInput && uploadAvatarBtn) {
  uploadAvatarBtn.addEventListener("click", async () => {
    const file = avatarInput.files?.[0];
    if (!file) return alert("Vui lòng chọn ảnh trước!");

    const form = new FormData();
    form.append("avatar", file);

    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser._id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("📦 Kết quả upload:", data);

      const newUrl = data.user?.avatar || data.avatar;
      if (!newUrl) return alert("Không nhận được URL avatar mới từ server!");

      const finalUrl = newUrl.startsWith("http")
        ? newUrl
        : `${API_URL}${newUrl}`;

      // === Cập nhật localStorage.currentUser ===
      const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const updatedUser = { ...stored, avatar: finalUrl };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      currentUser = updatedUser;

      // === Cập nhật UI ngay lập tức ===
      ["left-avatar", "nav-avatar", "create-avatar"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.src = finalUrl;
      });
      if (avatarFileName) {
        avatarFileName.textContent = "Đã chọn ảnh";
        avatarFileName.title = "";
      }

      // === Đồng bộ ảnh trong toàn hệ thống ===
      document.querySelectorAll("img[data-id]").forEach((img) => {
        if (
          img.dataset.id === currentUser._id ||
          img.dataset.id === String(currentUser._id)
        ) {
          img.src = finalUrl;
        }
      });

      alert("✅ Ảnh đại diện đã được cập nhật và lưu vĩnh viễn!");
    } catch (err) {
      console.error("❌ Upload avatar error:", err);
      alert("Lỗi khi tải ảnh: " + err.message);
    }
  });
}
// ===== UPLOAD SHORT HANDLER =====
if (uploadShortBtn && shortInput) {
  uploadShortBtn.addEventListener("click", async () => {
    const file = shortInput.files?.[0];
    const desc = shortDesc?.value?.trim() || "";
    if (!file) return alert("Vui lòng chọn video!");

    // basic frontend validation (size, type)
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["mp4", "webm", "mov", "ogg", "mkv"].includes(ext)) {
      return alert("Vui lòng chọn file video (mp4/webm/etc).");
    }
    // optional: limit size to e.g. 60MB
    const maxBytes = 60 * 1024 * 1024;
    if (file.size > maxBytes) return alert("Video quá lớn (max 60MB).");

    uploadShortBtn.disabled = true;
    uploadShortBtn.textContent = "Đang tải...";

    try {
      const form = new FormData();
      // backend expected field name: either "video" or "shortVideo" depending how you implemented server
      // In server instructions earlier we used field "video" for /api/uploadShort - ensure match
      form.append("video", file);
      form.append("description", desc);
      form.append(
        "userId",
        currentUser?._id ||
          (localStorage.getItem("currentUser") &&
            JSON.parse(localStorage.getItem("currentUser"))._id) ||
          "anonymous"
      );

      const res = await fetch(`${API_URL}/api/uploadShort`, {
        method: "POST",
        body: form,
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.message || "Upload failed");
      alert("✅ Đăng Short thành công!");
      // clear inputs
      shortInput.value = "";
      if (shortDesc) shortDesc.value = "";
      // reload shorts (prepend new short)
      if (typeof loadShorts === "function") loadShorts();
    } catch (err) {
      console.error("Upload short error:", err);
      alert("Lỗi khi upload Short: " + (err.message || err));
    } finally {
      uploadShortBtn.disabled = false;
      uploadShortBtn.textContent = "Đăng Short";
    }
  });
}

/******************************************************
 * 🟦 STORY REAL (24H + Realtime)
 ******************************************************/
const storyContainer = document.getElementById("storyContainer");
const storyInput = document.getElementById("storyInput");
const btnPostStory = document.getElementById("btnPostStory");

// Khi click vào dấu "+"
document
  .querySelector(".add-story .story-thumb")
  .addEventListener("click", () => storyInput.click());

// Khi chọn xong file -> hiện nút "Đăng"
storyInput.addEventListener("change", () => {
  if (storyInput.files && storyInput.files.length > 0) {
    btnPostStory.classList.remove("hidden");
  }
});

// Khi bấm "Đăng"
btnPostStory.addEventListener("click", async () => {
  const file = storyInput.files?.[0];
  if (!file) return alert("Vui lòng chọn ảnh hoặc video!");

  const formData = new FormData();
  formData.append("story", file);

  try {
    const res = await fetch(`${API_URL}/api/stories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Story đã được đăng!");
      storyInput.value = "";
      btnPostStory.classList.add("hidden");
      loadStories();
    } else {
      alert(data.message || "Không thể đăng story!");
    }
  } catch (err) {
    console.error("Lỗi đăng story:", err);
    alert("Không thể đăng story!");
  }
});

// Load danh sách story
async function loadStories() {
  try {
    const res = await fetch(`${API_URL}/api/stories`);
    const stories = await res.json();
    // Xoá tất cả story cũ (trừ story add)
    const addEl = document.querySelector(".add-story");
    storyContainer.innerHTML = "";
    storyContainer.appendChild(addEl);

    stories.forEach((s) => {
      const item = document.createElement("div");
      item.className = "story-item";

      // Lấy đúng field từ backend (field trong model là "type", không phải "mediaType")
      const isVideo = s.type === "video";
      let src = s.mediaUrl;

      // Nếu backend trả đường dẫn tương đối (trường hợp cũ), thêm domain API_URL vào
      if (src && src.startsWith("/")) {
        src = `${API_URL}${src}`;
      }

      const thumb = isVideo
        ? `<video src="${src}" muted playsinline preload="metadata"></video>`
        : `<img src="${src}" alt="story" />`;

      const canDelete =
        s.userId &&
        (s.userId._id === currentUser._id || s.userId === currentUser._id);

      item.innerHTML = `
  ${thumb}
  ${
    canDelete
      ? `<button class="delete-story-btn" data-id="${s._id}">🗑️</button>`
      : ""
  }
`;
      storyContainer.appendChild(item);

      // ⬇️ Thêm đoạn này NGAY SAU stories.forEach(...)
      storyContainer.querySelectorAll(".delete-story-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (!confirm("Bạn có chắc muốn xóa story này không?")) return;

          try {
            const res = await fetch(`${API_URL}/api/stories/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
              alert("✅ Đã xóa story!");
              btn.closest(".story-item").remove();
            } else {
              alert(data.message || "Không thể xóa story!");
            }
          } catch (err) {
            console.error("Lỗi xóa story:", err);
            alert("Không thể xóa story!");
          }
        });
      });

      /******************************************************
       * ✅ THÊM PHẦN XEM STORY CHI TIẾT (POPUP)
       ******************************************************/
      item.addEventListener("click", () => {
        const viewer = document.createElement("div");
        viewer.className = "story-viewer";
        viewer.style = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    `;

        const content = document.createElement(isVideo ? "video" : "img");
        content.src = src;
        content.style = `
      max-width: 90%;
      max-height: 90%;
      border-radius: 12px;
      object-fit: contain;
      background: #000;
    `;
        if (isVideo) {
          content.controls = true;
          content.autoplay = true;
        }

        // Nút đóng
        const closeBtn = document.createElement("div");
        closeBtn.textContent = "✖";
        closeBtn.style = `
      position: absolute;
      top: 20px;
      right: 30px;
      font-size: 28px;
      color: #fff;
      cursor: pointer;
    `;
        closeBtn.addEventListener("click", () => viewer.remove());

        viewer.appendChild(content);
        viewer.appendChild(closeBtn);
        document.body.appendChild(viewer);
      });
    });
  } catch (err) {
    console.warn("Không thể load story:", err);
  }
}

// Socket realtime
if (socket && socket.on) {
  socket.on("new-story", (s) => {
    const item = document.createElement("div");
    item.className = "story-item";
    const isVideo = s.type === "video";
    let src = s.mediaUrl;
    if (src && src.startsWith("/")) src = `${API_URL}${src}`;
    const thumb = isVideo
      ? `<video src="${src}" muted playsinline preload="metadata"></video>`
      : `<img src="${src}" alt="story" />`;
    item.innerHTML = thumb;
    storyContainer.appendChild(item);
  });
}

loadStories();

/******************************************************
 * 🎥 VIDEO CALL FEATURE — WebRTC + Socket.IO
 ******************************************************/
let currentVideoPeer = null;
let localVideoStream = null;

/**
 * Khởi tạo cuộc gọi video
 */
async function startVideoCall(friendId, friendName) {
  if (!socket || !socket.connected) return alert("Socket chưa sẵn sàng!");
  if (currentVideoPeer) return alert("Bạn đang trong một cuộc gọi video khác!");

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:zingmini-turn-server-2.onrender.com:3478",
        username: "user",
        credential: "password",
      },
    ],
  });
  currentVideoPeer = pc;

  try {
    localVideoStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
  } catch (err) {
    alert("Không thể truy cập camera/micro: " + err.message);
    currentVideoPeer = null;
    return;
  }

  // Thêm stream local
  localVideoStream
    .getTracks()
    .forEach((track) => pc.addTrack(track, localVideoStream));

  // Hiển thị video local
  const localEl = document.createElement("video");
  localEl.setAttribute("data-zm-video", "local");
  localEl.autoplay = true;
  localEl.muted = true;
  localEl.srcObject = localVideoStream;
  // LOCAL VIDEO (người gọi)
  localEl.style = `
  position: fixed;
  top: 20px;
  right: 20px;
  width: 160px;
  height: 120px;
  border-radius: 10px;
  z-index: 10001;
  object-fit: cover;
  background: #000;
`;
  document.body.appendChild(localEl);

  // Tạo video remote
  const remoteEl = document.createElement("video");
  remoteEl.setAttribute("data-zm-video", "remote");
  remoteEl.autoplay = true;
  remoteEl.playsInline = true;
  remoteEl.controls = true;
  // REMOTE VIDEO (người kia)
  remoteEl.style = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 320px;
  height: 240px;
  border-radius: 10px;
  z-index: 10000;
  object-fit: cover;
  background: #000;
`;
  document.body.appendChild(remoteEl);

  pc.ontrack = (e) => {
    console.log("📹 Nhận remote stream video:", e.streams[0]);
    remoteEl.srcObject = e.streams[0];
  };

  // Gửi ICE candidate
  pc.onicecandidate = (e) => {
    if (e.candidate)
      socket.emit("call-ice", {
        to: friendId,
        candidate: e.candidate,
        type: "video",
      });
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("call-offer", {
    to: friendId,
    offer,
    from: currentUser._id,
    userName: currentUser.name,
    type: "video",
  });

  alert(`🎥 Đang gọi video ${friendName}...`);

  // Nút kết thúc
  const endBtn = document.createElement("button");
  endBtn.textContent = "📴 Kết thúc video call";
  endBtn.className = "btn end-call-btn";
  endBtn.style.position = "fixed";
  endBtn.style.top = "20px";
  endBtn.style.right = "20px";
  endBtn.style.zIndex = "99999";
  endBtn.style.background = "#ff4d4f";
  endBtn.style.color = "#fff";
  document.body.appendChild(endBtn);

  endBtn.addEventListener("click", () => {
    socket.emit("call-end", { to: friendId });
    endVideoCall();
  });
}

/**
 * Kết thúc cuộc gọi video
 */
function endVideoCall() {
  if (localVideoStream) {
    localVideoStream.getTracks().forEach((t) => t.stop());
    localVideoStream = null;
  }
  if (currentVideoPeer) {
    currentVideoPeer.close();
    currentVideoPeer = null;
  }
  document
    .querySelectorAll("video[data-zm-video], .end-call-btn")
    .forEach((el) => el.remove());
  console.log("📴 Đã kết thúc video call");
}

/**
 * Xử lý khi nhận được cuộc gọi video
 */
async function handleIncomingVideoCall(data) {
  if (!confirm(`🎥 ${data.userName} đang gọi video bạn. Nhận không?`)) {
    socket.emit("call-end", { to: data.from });
    return;
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:zingmini-turn-server-2.onrender.com:3478",
        username: "user",
        credential: "password",
      },
    ],
  });
  currentVideoPeer = pc;

  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const localEl = document.createElement("video");
  localEl.setAttribute("data-zm-video", "local");
  localEl.autoplay = true;
  localEl.muted = true;
  localEl.srcObject = localStream;
  // LOCAL VIDEO (người gọi)
  localEl.style = `
  position: fixed;
  top: 20px;
  right: 20px;
  width: 160px;
  height: 120px;
  border-radius: 10px;
  z-index: 10001;
  object-fit: cover;
  background: #000;
`;
  document.body.appendChild(localEl);

  const remoteEl = document.createElement("video");
  remoteEl.setAttribute("data-zm-video", "remote");
  remoteEl.autoplay = true;
  remoteEl.playsInline = true;
  remoteEl.controls = true;
  // REMOTE VIDEO (người kia)
  remoteEl.style = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 320px;
  height: 240px;
  border-radius: 10px;
  z-index: 10000;
  object-fit: cover;
  background: #000;
`;
  document.body.appendChild(remoteEl);

  pc.ontrack = (e) => (remoteEl.srcObject = e.streams[0]);
  pc.onicecandidate = (e) =>
    e.candidate &&
    socket.emit("call-ice", {
      to: data.from,
      candidate: e.candidate,
      type: "video",
    });

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("call-answer", { to: data.from, answer, type: "video" });

  // Nút kết thúc
  const endBtn = document.createElement("button");
  endBtn.textContent = "📴 Kết thúc video call";
  endBtn.className = "btn end-call-btn";
  endBtn.style.position = "fixed";
  endBtn.style.top = "20px";
  endBtn.style.right = "20px";
  endBtn.style.zIndex = "99999";
  endBtn.style.background = "#ff4d4f";
  endBtn.style.color = "#fff";
  document.body.appendChild(endBtn);

  endBtn.addEventListener("click", () => {
    socket.emit("call-end", { to: data.from });
    endVideoCall();
  });
}

/**
 * Xử lý phản hồi từ socket cho voice & video
 */
socket.off("call-answer").on("call-answer", async (data) => {
  try {
    if (data.type === "video") {
      if (currentVideoPeer) {
        await currentVideoPeer.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    } else {
      if (currentPeer) {
        await currentPeer.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    }
  } catch (err) {
    console.warn("❌ Lỗi xử lý call-answer:", err);
  }
});

/**
 * Xử lý ICE candidate cho cả voice & video
 */
socket.off("call-ice").on("call-ice", async (data) => {
  if (!data || !data.candidate) return;
  try {
    if (data.type === "video" && currentVideoPeer) {
      await currentVideoPeer.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
    } else if (data.type !== "video" && currentPeer) {
      await currentPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {
    console.warn("⚠️ ICE candidate error:", err);
  }
});

/**
 * Khi kết thúc cuộc gọi (voice hoặc video)
 */
socket.off("call-end").on("call-end", () => {
  try {
    endVideoCall();
    endVoiceCall();
  } catch (err) {
    console.warn("❌ Lỗi khi kết thúc cuộc gọi:", err);
  }
});
/******************************************************
 * ⏪ NÚT TRỞ VỀ FEED HOME (tùy chọn)
 ******************************************************/
function addBackToFeedButton() {
  // kiểm tra xem có short container không (nếu có tức là đang ở chế độ Short)
  const shortSection = document.getElementById("shorts-section");
  if (!shortSection) return; // không phải trang Short thì bỏ qua

  // tạo nút quay lại
  const backBtn = document.createElement("button");
  backBtn.textContent = "⏪ Quay lại Trang chính";
  backBtn.className = "btn-back-home";
  backBtn.style.position = "fixed";
  backBtn.style.top = "20px";
  backBtn.style.left = "20px";
  backBtn.style.zIndex = "99999";
  backBtn.style.padding = "10px 14px";
  backBtn.style.borderRadius = "10px";
  backBtn.style.background = "#1e90ff";
  backBtn.style.color = "#fff";
  backBtn.style.border = "none";
  backBtn.style.cursor = "pointer";
  backBtn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  backBtn.style.fontWeight = "600";

  backBtn.addEventListener("click", () => {
    // trở về feed chính
    window.location.href = "home.html"; // hoặc feed.html nếu trang chính là feed
  });

  document.body.appendChild(backBtn);
}

// gọi hàm này khi trang short load xong
window.addEventListener("DOMContentLoaded", addBackToFeedButton);
window.addEventListener("resize", () => {
  const btn = document.querySelector(".btn-back-home");
  if (!btn) return;
  if (window.innerWidth < 768) {
    btn.style.fontSize = "12px";
    btn.style.padding = "6px 8px";
  } else {
    btn.style.fontSize = "14px";
    btn.style.padding = "10px 14px";
  }
});
document.getElementById("watch-btn")?.addEventListener("click", () => {
  window.location.href = "shorts.html";
});
/******************************************************
 * 🔹 Tích hợp chức năng "Quay lại Trang chính" vào logo ZM
 ******************************************************/
window.addEventListener("DOMContentLoaded", () => {
  // Ẩn chữ nút back cũ nhưng vẫn giữ DOM + logic
  const backBtn = document.querySelector(".btn-back-home");
  if (backBtn) backBtn.style.display = "none";

  // Thêm sự kiện click cho logo ZM
  const zmLogo = document.getElementById("zm-logo");
  if (zmLogo) {
    zmLogo.style.cursor = "pointer"; // đổi con trỏ khi hover
    zmLogo.addEventListener("click", () => {
      if (backBtn) {
        backBtn.click(); // trigger toàn bộ logic cũ
      } else {
        // fallback: nếu chưa tồn tại nút, chỉ chuyển về home
        window.location.href = "home.html";
      }
    });
  }
});
// 🔁 Gán chức năng "Quay lại Trang chính" vào logo ZM
window.addEventListener("DOMContentLoaded", () => {
  const zmLogo = document.getElementById("zm-logo");
  if (zmLogo) {
    zmLogo.style.cursor = "pointer"; // đổi con trỏ khi hover
    zmLogo.addEventListener("click", () => {
      window.location.href = "home.html"; // giữ nguyên chức năng quay lại
    });
  }

  // Ẩn nút "Quay lại Trang chính" cũ nếu có
  const backBtn = document.querySelector(".btn-back-home");
  if (backBtn) backBtn.style.display = "none";
});
