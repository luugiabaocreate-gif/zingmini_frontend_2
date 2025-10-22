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
      if (btn) btn.textContent = "🌞"; // sun = switch to light
    } else {
      document.body.classList.remove("dark");
      document.documentElement.classList.remove("dark");
      if (btn) btn.setAttribute("aria-pressed", "false");
      if (btn) btn.textContent = "🌙"; // moon = switch to dark
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
    .replace(/>/g, ">");
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
      if (file.type.startsWith("video/")) form.append("video", file);
      else form.append("image", file);
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
    } catch (e) {}
    likeBtn.classList.add("reaction-selected");
    likeBtn.textContent = "👍 • Bạn";
  });

  // === THÊM ĐOẠN NÀY SAU LIKE ===
  const commentBtn = div.querySelector(".comment-btn");
  commentBtn.addEventListener("click", () => {
    openCommentBox(id);
  });

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

// ===== UI: profile dropdown + logout =====
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
  leftToggle.addEventListener("click", () => {
    leftCol.classList.toggle("show");
    rightCol?.classList.remove("show");
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
const avatarInput = document.getElementById("avatar-input");
const uploadAvatarBtn = document.getElementById("upload-avatar-btn");

if (avatarInput && uploadAvatarBtn) {
  uploadAvatarBtn.addEventListener("click", async () => {
    const file = avatarInput.files?.[0];
    if (!file) return alert("Vui lòng chọn ảnh trước!");

    const form = new FormData();
    form.append("avatar", file);

    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser._id}`, {
        method: "PUT",
        // Không set 'Content-Type' khi dùng FormData
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const body = await (async () => {
          try {
            return await res.json();
          } catch (e) {
            return { message: `HTTP ${res.status}` };
          }
        })();
        throw new Error(
          body?.message || `Không thể cập nhật ảnh (${res.status})`
        );
      }

      const json = await res.json();
      console.log("🧩 JSON từ backend:", json);

      // backend trả { success: true, avatar: '...', user: {...} } hoặc user trong json.user
      let newUrl =
        json?.user?.avatar || json?.avatar || json?.user?.avatarUrl || null;

      // chuẩn hoá (convert http -> https, hoặc relative -> full)
      newUrl = normalizeAvatarUrl(newUrl);

      if (!newUrl) {
        console.warn("⚠️ Không tìm thấy URL ảnh trong phản hồi:", json);
        return alert("⚠️ Cập nhật ảnh không thành công (không có url).");
      }

      // cập nhật localStorage.currentUser (ghi đè avatar)
      try {
        const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const updatedUser = { ...stored, avatar: newUrl };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));
        currentUser = updatedUser;
      } catch (e) {
        console.warn("Không thể lưu currentUser vào localStorage:", e);
      }

      // cập nhật UI: các avatar "static"
      ["left-avatar", "nav-avatar", "create-avatar"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.src = newUrl;
      });

      // cập nhật ảnh trong posts / friends list / messages (nếu dùng same URL)
      document.querySelectorAll("img").forEach((img) => {
        // nếu src bằng trước đó (local copy) -> thay
        if (
          img.src &&
          currentUser.avatar &&
          img.src.includes(currentUser.avatar)
        ) {
          img.src = newUrl;
        }
      });

      // cập nhật avatar trong chat window headers nếu có
      document.querySelectorAll(".chat-window .head img").forEach((img) => {
        if (img.dataset && img.dataset.id === currentUser._id) {
          img.src = newUrl;
        }
      });

      alert("✅ Ảnh đại diện đã được cập nhật!");
      // --- ĐỒNG BỘ ẢNH MỚI CHO TOÀN TRANG ---
      try {
        // Cập nhật avatar trong toàn bộ bài viết, danh sách bạn bè, bình luận, chat
        document.querySelectorAll("img[data-id]").forEach((img) => {
          if (
            img.dataset.id === currentUser._id ||
            img.dataset.id === String(currentUser._id)
          ) {
            img.src = newUrl;
          }
        });

        // Cập nhật cả những ảnh không có data-id nhưng đang hiển thị avatar cũ
        document.querySelectorAll("img").forEach((img) => {
          if (
            img.src &&
            currentUser.avatar &&
            img.src.includes(currentUser.avatar)
          ) {
            img.src = newUrl;
          }
        });

        // Cập nhật avatar trong các cửa sổ chat
        document.querySelectorAll(".chat-window .head img").forEach((img) => {
          if (img.dataset?.id === currentUser._id) {
            img.src = newUrl;
          }
        });

        // Cập nhật dữ liệu trong friendPool (để Messenger và danh sách bạn bè đồng bộ)
        if (window.friendPool) {
          Object.keys(friendPool).forEach((id) => {
            if (id === currentUser._id) {
              friendPool[id].avatar = newUrl;
            }
          });
        }

        console.log("✅ Avatar synced across posts, chats, and friends!");
      } catch (err) {
        console.warn("⚠️ Lỗi khi đồng bộ avatar:", err);
      }
    } catch (e) {
      console.error("❌ Upload avatar error:", e);
      alert("Lỗi khi tải ảnh lên server: " + (e.message || ""));
    }
  });
}
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
/********************************************************************
 * 🌟 EXTENSION — ONLINE STATUS + FILE/VIDEO POST SUPPORT
 * ✅ Bổ sung, không chạm code cũ
 ********************************************************************/

// ====== ONLINE FRIENDS (hiện chấm xanh sáng ở cuối tên) ======
if (typeof socket !== "undefined" && currentUser?._id) {
  socket.on("connect", () => {
    socket.emit("user_online", { userId: currentUser._id });
  });

  socket.on("online_users", (list) => {
    if (!Array.isArray(list)) return;
    document.querySelectorAll("#friends-list .s-item").forEach((item) => {
      const nameDiv = item.querySelector("div:last-child");
      if (!nameDiv) return;
      const userName = nameDiv.textContent.trim();
      const isOnline = list.includes(userName);
      let dot = nameDiv.querySelector(".online-dot");
      if (isOnline && !dot) {
        dot = document.createElement("span");
        dot.className = "online-dot";
        nameDiv.appendChild(dot);
      } else if (!isOnline && dot) {
        dot.remove();
      }
    });
  });
}

// ====== ĐĂNG BÀI MỚI: hỗ trợ video + file ======
// const API_URL = "https://zingmini-backend-2.onrender.com";
// const token = localStorage.getItem("token");
// const postSubmit = document.getElementById("post-submit");
// const postImage = document.getElementById("post-image");
// const postContent = document.getElementById("post-content");
// const mediaPreview = document.getElementById("media-preview");
// const postsContainer = document.getElementById("posts-container");

// Xem trước file
if (postImage && mediaPreview) {
  postImage.addEventListener("change", (e) => {
    const file = e.target.files[0];
    mediaPreview.innerHTML = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video")) {
      mediaPreview.innerHTML = `<video src="${url}" controls></video>`;
    } else if (file.type.startsWith("image")) {
      mediaPreview.innerHTML = `<img src="${url}" alt="preview">`;
    } else {
      mediaPreview.innerHTML = `<div>📎 ${file.name}</div>`;
    }
  });
}

// Gửi bài
if (postSubmit) {
  postSubmit.addEventListener("click", async () => {
    const content = postContent.value.trim();
    const file = postImage.files[0];
    if (!content && !file) return alert("Hãy nhập nội dung hoặc chọn file!");

    const form = new FormData();
    form.append("content", content);
    if (file) form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Đăng thất bại");

      alert("Đăng bài thành công!");
      postContent.value = "";
      postImage.value = "";
      mediaPreview.innerHTML = "";

      loadFeed();
    } catch (err) {
      console.error("Lỗi khi đăng:", err);
      alert("Lỗi khi đăng bài!");
    }
  });
}

// Tải feed
async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const posts = await res.json();
    if (!Array.isArray(posts)) return;
    postsContainer.innerHTML = posts
      .map(
        (p) => `
      <div class="post-card loaded">
        <div class="post-header">
          <img src="${p.avatar || "https://i.pravatar.cc/48"}" />
          <div><b>${
            p.userName || "Người dùng"
          }</b><br><span class="small">${new Date(
          p.createdAt || Date.now()
        ).toLocaleString("vi-VN")}</span></div>
        </div>
        <div class="post-content">
          <p>${p.content || ""}</p>
          ${
            p.file
              ? p.file.match(/\.(jpg|jpeg|png|gif)$/i)
                ? `<img src="${p.file}" alt="">`
                : p.file.match(/\.(mp4|webm|ogg)$/i)
                ? `<video src="${p.file}" controls></video>`
                : `<a class="file-link" href="${
                    p.file
                  }" target="_blank">📎 ${p.file.split("/").pop()}</a>`
              : ""
          }
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    console.error("Lỗi tải feed:", err);
  }
}

loadFeed();
