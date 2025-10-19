// script_home_pro.js — FINAL (posts newest on top, chat newest on top, no-duplicate realtime)
// Full features: load posts, create post (backend returns array), realtime chat (no duplicate),
// reactions, logout, theme toggle, friends list -> open chat windows.
// Import socket.io client (ESM)
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
function openCommentBox(postId) {
  const postCard = document.querySelector(`[data-post-id="${postId}"]`);
  if (!postCard) return;

  // kiểm tra nếu đã có comment box thì ẩn/hiện
  let box = postCard.querySelector(".comment-box");
  if (box) {
    box.remove();
    return;
  }

  // tạo khung bình luận
  box = document.createElement("div");
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
    <div class="comment-list" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
  `;

  postCard.appendChild(box);

  const input = box.querySelector(".comment-input");
  const sendBtn = box.querySelector(".send-comment");
  const list = box.querySelector(".comment-list");

  sendBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    const item = document.createElement("div");
    item.style.padding = "4px 6px";
    item.style.background = "#f6fbff";
    item.style.borderRadius = "6px";
    item.innerHTML = `<b>${currentUser.name}:</b> ${escapeHtml(text)}`;
    list.appendChild(item);
    input.value = "";

    // gửi về backend nếu có API
    try {
      await apiFetch(`${API_URL}/api/comments/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
    } catch (e) {
      console.warn("Comment save failed:", e);
    }
  });
}
