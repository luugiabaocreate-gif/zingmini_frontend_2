// 🌐 API + Socket config
const API_URL = "https://zingmini-backend-2.onrender.com";
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// Useful helpers
const $ = (id) => document.getElementById(id);
const fmtTime = (t) => {
  try {
    return new Date(t).toLocaleString();
  } catch (e) {
    return "N/A";
  }
};

// ---------------- Socket logs ----------------
socket.on("connect", () => console.log("✅ Socket connected:", socket.id));
socket.on("connect_error", (err) =>
  console.error("❌ Socket connect error:", err.message)
);

// Receive chat messages
socket.on("chat", (msg) => {
  addMessageToChat(msg);
});

// Realtime like/comment listeners
socket.on("like", (data) => {
  // update UI like count if exists
  const el = document.querySelector(`[data-post-like="${data.postId}"]`);
  if (el) {
    let count = Number(el.dataset.count || 0);
    // if the user already liked on this client, we should not double-count.
    // Here we just increment for simplicity (server persistence recommended).
    el.dataset.count = String(count + 1);
    el.innerText = `❤ ${el.dataset.count}`;
    el.classList.add("liked");
    sparkle(el);
  }
  notify({ title: data.user + " vừa thích 1 bài viết", type: "like" });
});

socket.on("comment", (data) => {
  // append comment if post exists in DOM
  const commentsWrap = document.querySelector(`#comments-${data.postId}`);
  if (commentsWrap) {
    const c = document.createElement("div");
    c.className = "comment";
    c.innerHTML = `<strong>${escapeHtml(data.user)}:</strong> ${escapeHtml(
      data.text
    )}`;
    commentsWrap.appendChild(c);
  }
  notify({ title: data.user + " đã bình luận", type: "comment" });
});

socket.on("notification", (n) => {
  notify({ title: n.title || "Thông báo", type: n.type || "info" });
});

// ---------------- UI Helpers ----------------
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function sparkle(el) {
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.12)" },
      { transform: "scale(1)" },
    ],
    { duration: 420, easing: "ease" }
  );
}
function notify({
  title = "Thông báo",
  body = "",
  type = "info",
  timeout = 3500,
}) {
  const w = $("toastWrapper");
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<strong>${escapeHtml(
    title
  )}</strong><div style="font-size:0.85rem;margin-top:4px">${escapeHtml(
    body
  )}</div>`;
  w.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 400);
  }, timeout);
  // update badge
  const b = $("notifBadge");
  if (b) {
    b.style.display = "inline-block";
    const v = Number(b.innerText || "0") + 1;
    b.innerText = v;
  }
}

// ---------------- Load user ----------------
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
    $("profileName").textContent = data.name || "Người dùng";
    $("profileAvatar").src = data.avatar || "https://i.imgur.com/AVT0a.png";
  } catch (err) {
    console.warn("loadUser:", err.message);
    // If cannot load user, allow limited UI but show guest
    currentUser = null;
    $("profileName").textContent = "Khách";
    $("profileAvatar").src = "https://i.imgur.com/AVT0a.png";
  }
}
loadUser();

// ---------------- Stories / suggestions / games (demo) ----------------
const stories = [
  { name: "Linh", img: "https://i.imgur.com/XC8ZbZC.jpg" },
  { name: "Huy", img: "https://i.imgur.com/5ZQbB3k.jpg" },
  { name: "An", img: "https://i.imgur.com/zCw6zZC.jpg" },
  { name: "Minh", img: "https://i.imgur.com/6dT0Rsy.jpg" },
];
$("storyBox").innerHTML = stories
  .map(
    (s) =>
      `<div class="story" title="${escapeHtml(s.name)}"><img src="${
        s.img
      }" alt="${escapeHtml(s.name)}"/><div>${escapeHtml(s.name)}</div></div>`
  )
  .join("");

const suggestions = [
  { name: "Trang", img: "https://i.imgur.com/2vS8t4h.jpg" },
  { name: "Đạt", img: "https://i.imgur.com/Tjz5UB1.jpg" },
  { name: "Phương", img: "https://i.imgur.com/VnC8I8V.jpg" },
];
$("suggestBox").innerHTML = suggestions
  .map(
    (p) => `
  <div class="suggest-item">
    <div class="suggest-info">
      <img src="${p.img}" />
      <span>${p.name}</span>
    </div>
    <button class="add-friend">Kết bạn</button>
  </div>`
  )
  .join("");

const games = [
  { name: "Zing Farm", img: "https://i.imgur.com/dzWl3V7.png" },
  { name: "Gunny", img: "https://i.imgur.com/0LKBgGR.png" },
  { name: "Boom", img: "https://i.imgur.com/twZCh6O.png" },
];
$("gameList").innerHTML = games
  .map(
    (g) => `
  <div class="game-item" title="${escapeHtml(g.name)}">
    <img class="game-thumb" src="${g.img}"/>
    <div>${g.name}</div>
  </div>`
  )
  .join("");

// ---------------- Friends demo ----------------
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

// ---------------- Feed handling ----------------
async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const data = await res.json();
    const feed = $("feed");
    feed.innerHTML = "";

    // support multiple possible timestamp fields
    data.sort((a, b) => {
      const ta = new Date(
        a.createdAt || a.created_at || a.ts || Date.now()
      ).getTime();
      const tb = new Date(
        b.createdAt || b.created_at || b.ts || Date.now()
      ).getTime();
      return tb - ta;
    });

    data.forEach((p) => addPostToFeed(p, false));
  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
  }
}

// createPost with token + formData (image)
async function createPost() {
  const content = $("statusInput").value.trim();
  const imageInput = $("imageInput");
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !userStored) return alert("Bạn cần đăng nhập để đăng bài!");
  if (!content && !imageInput.files.length)
    return alert("Viết gì đó hoặc chọn ảnh!");

  const formData = new FormData();
  formData.append("content", content);
  formData.append("userId", userStored._id);
  if (imageInput.files[0]) formData.append("image", imageInput.files[0]);

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Post error:", txt);
      return alert("Không thể đăng bài. Hãy thử đăng nhập lại.");
    }
    const post = await res.json();

    // Normalize fields for our UI
    const norm = {
      _id: post._id || post.id || String(Math.random()).slice(2),
      content: post.content || "",
      createdAt: post.createdAt || post.created_at || Date.now(),
      username:
        (post.user && (post.user.name || post.user.username)) ||
        post.username ||
        (userStored && (userStored.name || userStored.username)) ||
        "Ẩn danh",
      userId: (post.user && post.user._id) || post.userId || userStored._id,
      image: post.imageUrl || post.image || post.image_path || null,
    };

    // clear inputs
    $("statusInput").value = "";
    $("imageInput").value = "";

    // Add to feed and broadcast notification
    addPostToFeed(norm, true);
    socket.emit("notification", {
      type: "post",
      title: `${norm.username} vừa đăng 1 bài viết`,
      postId: norm._id,
      ts: Date.now(),
    });
  } catch (err) {
    console.error("Lỗi createPost:", err);
    alert("Lỗi mạng khi đăng bài.");
  }
}

// addPostToFeed: builds HTML with Like/Comment actions
function addPostToFeed(post, isNew = false) {
  const feed = $("feed");
  const div = document.createElement("div");
  div.className = "post";
  const id = post._id || post.id || String(Math.random()).slice(2);
  const username =
    post.username ||
    (post.user && (post.user.name || post.user.username)) ||
    "Ẩn danh";
  const time = fmtTime(
    post.createdAt || post.created_at || post.ts || Date.now()
  );
  const content = escapeHtml(post.content || "");
  const imageHtml = post.image
    ? `<div class="post-img-wrap"><img src="${post.image}" alt="img" /></div>`
    : "";

  div.innerHTML = `
    <div class="post-header" style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${
          post.avatar || "https://i.imgur.com/AVT0a.png"
        }" style="width:36px;height:36px;border-radius:50%;border:2px solid #a58cff"/>
        <div>
          <div style="font-weight:700">${escapeHtml(username)}</div>
          <div style="font-size:0.8rem;color:#666">${escapeHtml(time)}</div>
        </div>
      </div>
      <div style="font-size:0.9rem;color:#888;cursor:pointer" onclick="openProfile('${escapeHtml(
        post.userId || post.user?._id || ""
      )}')">Xem</div>
    </div>
    <div class="post-content" style="margin-top:8px">${content}</div>
    ${imageHtml}
    <div class="post-actions">
      <button class="action-btn like-btn" data-post-like="${id}" data-count="0" onclick="handleLike('${id}')">❤ 0</button>
      <button class="action-btn comment-toggle" onclick="toggleComments('${id}')">💬 Bình luận</button>
      <button class="action-btn share-btn" onclick="handleShare('${id}')">⤴ Chia sẻ</button>
    </div>
    <div id="comments-${id}" class="comments" style="display:none">
      <div style="display:flex;gap:8px;margin-top:8px">
        <input placeholder="Viết bình luận..." id="comment-input-${id}" style="flex:1;padding:8px;border-radius:8px;border:1px solid #eee"/>
        <button class="action-btn" onclick="submitComment('${id}')">Gửi</button>
      </div>
      <div class="comment-list" id="comment-list-${id}" style="margin-top:8px"></div>
    </div>
  `;

  if (isNew) {
    feed.prepend(div);
    // slight highlight animation
    div.animate([{ background: "#fff7ff" }, { background: "transparent" }], {
      duration: 1200,
    });
  } else {
    feed.appendChild(div);
  }
}

// ---------------- Like / Comment handlers ----------------
async function handleLike(postId) {
  const likeBtn = document.querySelector(`[data-post-like="${postId}"]`);
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  // optimistic UI
  if (likeBtn) {
    let count = Number(likeBtn.dataset.count || "0") + 1;
    likeBtn.dataset.count = String(count);
    likeBtn.innerText = `❤ ${count}`;
    likeBtn.classList.add("liked");
    sparkle(likeBtn);
  }

  // emit realtime to others
  socket.emit("like", {
    postId,
    user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh",
  });

  // attempt to call backend endpoint (if implemented). ignore error but console.log it
  if (token) {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.warn(
        "Like API failed (ok to ignore if not implemented):",
        err.message
      );
    }
  }
}

function toggleComments(postId) {
  const box = $(`comments-${postId}`);
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function submitComment(postId) {
  const input = $(`comment-input-${postId}`);
  const text = input ? input.value.trim() : "";
  if (!text) return;

  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  // optimistic append
  const list = $(`comment-list-${postId}`);
  if (list) {
    const el = document.createElement("div");
    el.className = "comment";
    el.innerHTML = `<strong>${escapeHtml(
      (userStored && (userStored.name || userStored.username)) || "Ẩn danh"
    )}:</strong> ${escapeHtml(text)}`;
    list.appendChild(el);
  }
  input.value = "";

  // emit to others
  socket.emit("comment", {
    postId,
    user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh",
    text,
  });

  // attempt to POST to backend
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
    } catch (err) {
      console.warn(
        "Comment API failed (ok to ignore if not implemented):",
        err.message
      );
    }
  }
}

// ---------------- Chat UI (popup) ----------------
function buildChatPopup() {
  const root = $("chatContainer");
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
        <input id="chatInput" placeholder="Gửi tin nhắn..." style="flex:1;padding:8px;border-radius:8px;border:1px solid #eee"/>
        <button class="btn primary" id="chatSendBtn">Gửi</button>
      </div>
    </div>
  `;
  // events
  $("chatSendBtn").addEventListener("click", sendMessage);
  $("chatInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}
buildChatPopup();

function addMessageToChat(msg) {
  const box = $("chatMessages");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "msg";
  div.style.marginBottom = "8px";
  const mine =
    currentUser && msg.user === (currentUser.name || currentUser.username);
  div.style.alignSelf = mine ? "flex-end" : "flex-start";
  div.innerHTML = `<strong>${escapeHtml(msg.user)}:</strong> ${escapeHtml(
    msg.text
  )} <div style="font-size:0.75rem;color:#888;margin-top:4px">${fmtTime(
    msg.ts || Date.now()
  )}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// sendMessage emits socket chat (and optionally posts to server)
function sendMessage() {
  const input = $("chatInput");
  const text = input.value.trim();
  if (!text) return;
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const user =
    (userStored && (userStored.name || userStored.username)) || "Ẩn danh";
  const msg = { user, text, ts: Date.now() };

  // emit to server
  socket.emit("chat", msg);
  // also local append
  addMessageToChat(msg);
  input.value = "";
}

// ---------------- Profile modal ----------------
function openProfile(userId) {
  // For demo, we show stored user or a small profile card
  const modal = $("profileModal");
  const details = $("profileDetails");
  modal.style.display = "block";
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  if (userStored && (userStored._id === userId || !userId)) {
    details.innerHTML = `
      <img src="${
        userStored.avatar || "https://i.imgur.com/AVT0a.png"
      }" style="width:80px;height:80px;border-radius:50%"/>
      <h3>${escapeHtml(
        userStored.name || userStored.username || "Người dùng"
      )}</h3>
      <p>${escapeHtml(userStored.email || "")}</p>
    `;
  } else {
    // fetch user from backend (if route exists) - fallback to placeholder
    details.innerHTML = `
      <img src="https://i.imgur.com/AVT0a.png" style="width:80px;height:80px;border-radius:50%"/>
      <h3>Người dùng</h3>
      <p>Không có thông tin chi tiết</p>
    `;
  }
}
function closeProfile() {
  $("profileModal").style.display = "none";
}

// ---------------- Share / other small handlers ----------------
function handleShare(postId) {
  navigator.clipboard?.writeText(location.href + `?post=${postId}`);
  notify({
    title: "Đã sao chép link bài viết",
    body: "Bạn có thể dán gửi cho bạn bè",
  });
}

// ---------------- Logout ----------------
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "index.html";
}

// ---------------- Init ----------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadUser(); // try to load again (ensures profile shows)
  loadFeed();

  // notif button clears badge
  const nb = $("notifBtn");
  if (nb) {
    nb.addEventListener("click", () => {
      const b = $("notifBadge");
      if (b) {
        b.style.display = "none";
        b.innerText = "0";
      }
      notify({ title: "Đã xem thông báo" });
    });
  }
});
