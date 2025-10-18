/* script_home_pro.js — ZingMini Premium 2025
   - loadUser() calls /api/auth/me using token in localStorage
   - loadFeed() GET /api/posts sorted newest-first
   - createPost() POST multipart/form-data with Authorization header
   - optimistic UI for like/comment; socket emits for broadcast
   - chat popup realtime using socket.io (no-duplicate for self)
   - notification (toast + badge + sound)
*/

/* ---------------- config ---------------- */
const API_URL = "https://zingmini-backend-2.onrender.com";
const socket = io(API_URL, { transports: ["websocket", "polling"] });

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
};
const fmtTime = (t) => {
  try {
    return new Date(t).toLocaleString();
  } catch (e) {
    return "N/A";
  }
};

/* ---------------- sound ---------------- */
function playTing() {
  try {
    const a = new Audio(
      "https://cdn.pixabay.com/download/audio/2022/03/15/audio_0b7d2d2b9d.mp3?filename=message-pop-14792.mp3"
    );
    a.volume = 0.28;
    a.play().catch(() => {});
  } catch {}
}

/* ---------------- toasts/notify ---------------- */
function showToast(opts) {
  const wrapper = $("toastWrapper");
  if (!wrapper) return;
  const el = document.createElement("div");
  el.className = "toast";
  if (typeof opts === "string")
    el.innerHTML = `<strong>${escapeHtml(opts)}</strong>`;
  else
    el.innerHTML = `<strong>${escapeHtml(
      opts.title || "Thông báo"
    )}</strong><div style="font-size:0.85rem">${escapeHtml(
      opts.body || ""
    )}</div>`;
  wrapper.appendChild(el);
  // badge
  const badge = $("notifBadge");
  if (badge) {
    badge.style.display = "inline-block";
    badge.innerText = Number(badge.innerText || "0") + 1;
  }
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
  }, 3600);
}

/* ---------------- user load ---------------- */
let currentUser = null;
async function loadUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token");
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data || !data.email) throw new Error("Not authenticated");
    currentUser = data;
    $("profileName").textContent = data.name || data.username || "Người dùng";
    $("profileMeta").textContent = data.title || "";
    $("profileAvatar").src = data.avatar || "https://i.imgur.com/AVT0a.png";
    // publish presence
    socket.emit(
      "userOnline",
      currentUser.name || currentUser.username || "Khách"
    );
    return true;
  } catch (err) {
    console.warn("loadUser:", err.message);
    currentUser = null;
    $("profileName").textContent = "Khách";
    $("profileAvatar").src = "https://i.imgur.com/AVT0a.png";
    return false;
  }
}

/* ---------------- socket handlers ---------------- */
socket.on("connect", () => console.log("✅ socket connected:", socket.id));
socket.on("connect_error", (err) =>
  console.error("❌ socket connect error:", err.message)
);

// chat: avoid double display for self
socket.on("chat", (msg) => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const myName = (stored && (stored.name || stored.username)) || null;
    if (myName && msg.user === myName) return; // ignore server echo of our own message
    appendChatMessage(msg, false);
    playTing();
  } catch (e) {
    console.warn("chat handling err:", e.message);
    appendChatMessage(msg, false);
    playTing();
  }
});

// like/comment/newPost/notification handlers
socket.on("like", (data) => {
  const el = document.querySelector(`[data-post-like="${data.postId}"]`);
  if (el) {
    let c = Number(el.dataset.count || 0) + 1;
    el.dataset.count = c;
    el.innerText = `❤ ${c}`;
    el.classList.add("liked");
    el.animate(
      [
        { transform: "scale(1.0)" },
        { transform: "scale(1.08)" },
        { transform: "scale(1.0)" },
      ],
      { duration: 300 }
    );
  }
  showToast({ title: `${data.user} vừa thích 1 bài viết` });
});

socket.on("comment", (data) => {
  const wrap = $(`comments-${data.postId}`);
  if (wrap) {
    const d = document.createElement("div");
    d.className = "comment";
    d.innerHTML = `<strong>${escapeHtml(data.user)}</strong>: ${escapeHtml(
      data.text
    )}`;
    wrap.appendChild(d);
  }
  showToast({ title: `${data.user} vừa bình luận` });
});

socket.on("newPost", (post) => {
  const norm = normalizePost(post);
  addPostToFeed(norm, true);
  showToast({ title: `${norm.username} vừa đăng bài` });
});

socket.on("notification", (n) => {
  showToast(n);
});

socket.on("onlineUsers", (list) => {
  const ul = $("friendsList");
  if (!ul) return;
  ul.innerHTML = "";
  list.forEach((name) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="opacity:1"></span>${escapeHtml(
      name
    )}`;
    ul.appendChild(li);
  });
});

/* ---------------- chat popup UI ---------------- */
function buildChatPopup() {
  const root = $("chatContainer");
  if (!root) return;
  root.innerHTML = `
    <div class="chat-popup" id="chatPopup">
      <div class="title">
        <div>💬 Chat ZingMini</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="online-dot" style="width:8px;height:8px;border-radius:50%;background:#2ecc71"></div>
          <button class="action-btn" id="minimizeChat">−</button>
        </div>
      </div>
      <div class="messages" id="chatMessages"></div>
      <div class="controls">
        <input id="chatInput" placeholder="Gửi tin nhắn..." />
        <button class="btn primary" id="chatSendBtn">Gửi</button>
      </div>
    </div>
  `;
  $("chatSendBtn").addEventListener("click", sendMessage);
  $("chatInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}
buildChatPopup();

function appendChatMessage(msg, self) {
  const box = $("chatMessages");
  if (!box) return;
  const wrapper = document.createElement("div");
  wrapper.className = "msg " + (self ? "self" : "other");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<strong>${escapeHtml(msg.user)}</strong>: ${escapeHtml(
    msg.text
  )}`;
  bubble.style.maxWidth = "78%";
  const meta = document.createElement("div");
  meta.className = "chat-time";
  meta.textContent = fmtTime(msg.ts || msg.time || Date.now());
  wrapper.appendChild(bubble);
  wrapper.appendChild(meta);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
}

function sendMessage() {
  const input = $("chatInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  const userName = (stored && (stored.name || stored.username)) || "Ẩn danh";
  const msg = { user: userName, text, ts: Date.now() };
  // append locally as self
  appendChatMessage(msg, true);
  // emit to server
  socket.emit("chat", msg);
  input.value = "";
}

/* ---------------- feed helpers ---------------- */
function normalizePost(p) {
  return {
    _id: p._id || p.id || String(Math.random()).slice(2),
    content: p.content || "",
    createdAt: p.createdAt || p.created_at || p.ts || Date.now(),
    username:
      (p.user && (p.user.name || p.user.username)) || p.username || "Ẩn danh",
    user: p.user || {
      name: (p.user && p.user.name) || p.username || "Người",
      avatar:
        (p.user && p.user.avatar) ||
        p.avatar ||
        "https://i.imgur.com/AVT0a.png",
    },
    image: p.imageUrl || p.image || p.image_path || null,
  };
}

async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const arr = await res.json();
    arr.sort(
      (a, b) =>
        new Date(b.createdAt || b.created_at || b.ts || Date.now()) -
        new Date(a.createdAt || a.created_at || a.ts || Date.now())
    );
    $("feed").innerHTML = "";
    arr.forEach((p) => addPostToFeed(normalizePost(p), false));
  } catch (e) {
    console.error("loadFeed error", e);
  }
}
loadFeed();

function addPostToFeed(post, top = true) {
  const feed = $("feed");
  if (!feed) return;
  const template = $("post-template");
  let node;
  if (template && template.content) {
    node = template.content.firstElementChild.cloneNode(true);
  } else {
    node = document.createElement("div");
    node.className = "post";
    node.innerHTML = `<div class="post-header"><img class="post-avatar"/><div class="post-meta"><div class="post-username"></div><div class="post-time"></div></div></div><div class="post-content"></div>`;
  }

  const id = post._id;
  node.querySelector(".post-avatar").src =
    post.user.avatar || "https://i.imgur.com/AVT0a.png";
  node.querySelector(".post-username").textContent =
    post.username || post.user.name;
  node.querySelector(".post-time").textContent = fmtTime(post.createdAt);
  node.querySelector(".post-content").innerHTML = escapeHtml(post.content);
  const imgWrap = node.querySelector(".post-img-wrap");
  if (post.image && imgWrap)
    imgWrap.innerHTML = `<img src="${post.image}" alt="img" />`;
  else if (imgWrap) imgWrap.innerHTML = "";

  // wire action buttons
  const likeBtn = node.querySelector(".like-btn");
  if (likeBtn) {
    likeBtn.dataset.postLike = id;
    likeBtn.dataset.count = likeBtn.dataset.count || "0";
    likeBtn.innerText = `❤ ${likeBtn.dataset.count}`;
    likeBtn.onclick = () => handleLike(id);
  }
  const commentToggle = node.querySelector(".comment-toggle");
  if (commentToggle) commentToggle.onclick = () => toggleComments(id);
  const shareBtn = node.querySelector(".share-btn");
  if (shareBtn) shareBtn.onclick = () => handleShare(id);

  const commentsBox = node.querySelector(".comments");
  if (commentsBox) commentsBox.id = `comments-${id}`;

  if (top) {
    feed.prepend(node);
    node.animate([{ background: "#fffdef" }, { background: "transparent" }], {
      duration: 900,
    });
  } else {
    feed.appendChild(node);
  }
}

/* ---------------- create post ---------------- */
async function createPost() {
  const content = $("statusInput").value.trim();
  const imageInput = $("imageInput");
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  if (!token || !userStored) return alert("Bạn cần đăng nhập để đăng bài!");
  if (!content && (!imageInput || !imageInput.files.length))
    return alert("Viết gì đó hoặc chọn ảnh!");
  const fd = new FormData();
  fd.append("content", content);
  fd.append("userId", userStored._id);
  if (imageInput && imageInput.files[0])
    fd.append("image", imageInput.files[0]);
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Post error:", txt);
      return alert("Không thể đăng bài. Hãy thử đăng nhập lại.");
    }
    const post = await res.json();
    const norm = normalizePost(post);
    addPostToFeed(norm, true);
    socket.emit("newPost", norm);
    $("statusInput").value = "";
    if (imageInput) imageInput.value = "";
  } catch (e) {
    console.error("createPost", e);
    alert("Lỗi mạng khi đăng bài");
  }
}

/* ---------------- like/comment handlers ---------------- */
async function handleLike(postId) {
  const btn = document.querySelector(`[data-post-like="${postId}"]`);
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  if (btn) {
    let c = Number(btn.dataset.count || "0") + 1;
    btn.dataset.count = c;
    btn.innerText = `❤ ${c}`;
    btn.classList.add("liked");
    try {
      btn.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.08)" },
          { transform: "scale(1)" },
        ],
        { duration: 300 }
      );
    } catch {}
  }
  socket.emit("like", {
    postId,
    user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh",
  });
  if (token) {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.warn("Like API failed:", e.message);
    }
  }
}

function toggleComments(postId) {
  const box = $(`comments-${postId}`);
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
  if (box && !box.querySelector(".comment-input")) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "8px";
    wrapper.style.marginTop = "8px";
    wrapper.innerHTML = `<input class="comment-input" placeholder="Viết bình luận..." style="flex:1;padding:8px;border-radius:8px;border:1px solid #eee"/><button class="action-btn">Gửi</button>`;
    wrapper.querySelector("button").addEventListener("click", () => {
      const val = wrapper.querySelector("input").value.trim();
      submitComment(postId, val);
      wrapper.querySelector("input").value = "";
    });
    box.prepend(wrapper);
  }
}

async function submitComment(postId, text) {
  if (!text || !text.trim()) return;
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  const box = $(`comments-${postId}`);
  if (box) {
    const el = document.createElement("div");
    el.className = "comment";
    el.innerHTML = `<strong>${escapeHtml(
      (userStored && (userStored.name || userStored.username)) || "Ẩn danh"
    )}</strong>: ${escapeHtml(text)}`;
    box.appendChild(el);
  }
  socket.emit("comment", {
    postId,
    user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh",
    text,
  });
  if (token) {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
    } catch (e) {
      console.warn("Comment API failed:", e.message);
    }
  }
}

/* ---------------- profile modal save ---------------- */
async function saveProfileChanges() {
  const name = $("editName").value.trim();
  const avatar = $("editAvatar").value.trim();
  const token = localStorage.getItem("token");
  if (!token) return alert("Bạn cần đăng nhập để sửa hồ sơ");
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, avatar }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("save profile err", txt);
      return alert("Không thể lưu thay đổi");
    }
    const d = await res.json();
    localStorage.setItem("user", JSON.stringify(d));
    await loadUser();
    $("profileModal").style.display = "none";
    showToast("Cập nhật hồ sơ thành công");
  } catch (e) {
    console.error("saveProfile", e);
    alert("Lỗi khi lưu hồ sơ");
  }
}

/* ---------------- share/profile helpers ---------------- */
function handleShare(postId) {
  navigator.clipboard?.writeText(location.href + `?post=${postId}`);
  showToast("Đã sao chép link bài viết");
}
function openProfile(userId) {
  const modal = $("profileModal");
  const details = modal.querySelector(".modal-card");
  modal.style.display = "flex";
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  if (stored && (!userId || stored._id === userId)) {
    $("editName").value = stored.name || stored.username || "";
    $("editEmail").value = stored.email || "";
    $("editAvatar").value = stored.avatar || "";
  } else {
    // fallback display (basic)
    $("editName").value = "";
    $("editEmail").value = "";
    $("editAvatar").value = "";
  }
}
function closeProfile() {
  $("profileModal").style.display = "none";
}

/* ---------------- demos: stories/suggestions/games/friends ---------------- */
(function populateDemos() {
  const stories = [
    { name: "Linh", img: "https://i.imgur.com/XC8ZbZC.jpg" },
    { name: "Huy", img: "https://i.imgur.com/5ZQbB3k.jpg" },
    { name: "An", img: "https://i.imgur.com/zCw6zZC.jpg" },
  ];
  $("storyBox").innerHTML = stories
    .map(
      (s) =>
        `<div class="story"><img src="${s.img}" /><div>${escapeHtml(
          s.name
        )}</div></div>`
    )
    .join("");
  const suggestions = [
    { name: "Trang", img: "https://i.imgur.com/2vS8t4h.jpg" },
    { name: "Đạt", img: "https://i.imgur.com/Tjz5UB1.jpg" },
    { name: "Phương", img: "https://i.imgur.com/VnC8I8V.jpg" },
  ];
  $("suggestBox").innerHTML = suggestions
    .map(
      (p) =>
        `<div class="suggest-item"><div class="suggest-info"><img src="${
          p.img
        }"/><span>${escapeHtml(
          p.name
        )}</span></div><button class="add-friend">Kết bạn</button></div>`
    )
    .join("");
  const games = [
    { name: "Zing Farm", img: "https://i.imgur.com/dzWl3V7.png" },
    { name: "Gunny", img: "https://i.imgur.com/0LKBgGR.png" },
  ];
  $("gameList").innerHTML = games
    .map(
      (g) =>
        `<div class="game-item"><img class="game-thumb" src="${
          g.img
        }"/><div>${escapeHtml(g.name)}</div></div>`
    )
    .join("");
  const friends = [
    { name: "Tuấn", online: true },
    { name: "Mai", online: true },
    { name: "Phúc", online: false },
  ];
  $("friendsList").innerHTML = friends
    .map(
      (f) =>
        `<li><span class="dot" style="opacity:${
          f.online ? 1 : 0.3
        }"></span>${escapeHtml(f.name)}</li>`
    )
    .join("");
})();

/* ---------------- init & wiring ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadUser();
  // wire post button
  const postBtn = $("postBtn");
  if (postBtn) postBtn.addEventListener("click", createPost);
  // chat controls
  const nb = $("notifBtn");
  if (nb)
    nb.addEventListener("click", () => {
      const b = $("notifBadge");
      if (b) {
        b.style.display = "none";
        b.innerText = "0";
      }
      showToast("Đã xem thông báo");
    });
  // profile modal wiring
  const ep = $("editProfileBtn");
  if (ep)
    ep.addEventListener("click", () => {
      $("profileModal").style.display = "flex";
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (stored) {
        $("editName").value = stored.name || "";
        $("editEmail").value = stored.email || "";
        $("editAvatar").value = stored.avatar || "";
      }
    });
  const save = $("saveProfileBtn");
  if (save) save.addEventListener("click", saveProfileChanges);
  const cancel = $("cancelProfileBtn");
  if (cancel)
    cancel.addEventListener("click", () => {
      $("profileModal").style.display = "none";
    });
  const logout = $("logoutBtn");
  if (logout)
    logout.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "index.html";
    });
  // minimize chat
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "minimizeChat") {
      const cp = $("chatPopup");
      if (cp) cp.style.display = cp.style.display === "none" ? "flex" : "none";
    }
  });
  // feed load
  loadFeed();
});
