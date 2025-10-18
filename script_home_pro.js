/* script_home_pro.js — ZingMini Premium 2025
   - single script for both auth page and home page
   - API_URL points to backend (edit if necessary)
   - Uses socket.io for realtime: chat, newPost, like, comment, notification, presence
*/

const API_URL = "https://zingmini-backend-2.onrender.com";
const socket = io(API_URL, { transports: ["websocket", "polling"] });

// helpers
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => (s === null || s === undefined ? "" : String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
const fmtTime = (t) => { try { return new Date(t).toLocaleString(); } catch { return "N/A"; } };

// play small ding
function playTing() {
  try {
    const a = new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_0b7d2d2b9d.mp3?filename=message-pop-14792.mp3");
    a.volume = 0.25;
    a.play().catch(()=>{});
  } catch {}
}

// ------------------ AUTH PAGE LOGIC (index.html) ------------------
function initAuthPage() {
  // tabs
  const loginTab = $("loginTab"), registerTab = $("registerTab");
  const loginForm = $("loginForm"), registerForm = $("registerForm");
  if (!loginTab || !registerTab) return;

  function showLogin() { loginTab.classList.add("active"); registerTab.classList.remove("active"); loginForm.classList.add("active"); registerForm.classList.remove("active"); }
  function showRegister() { registerTab.classList.add("active"); loginTab.classList.remove("active"); registerForm.classList.add("active"); loginForm.classList.remove("active"); }
  loginTab.addEventListener("click", showLogin);
  registerTab.addEventListener("click", showRegister);
  $("goRegister")?.addEventListener("click", showRegister);
  $("goLogin")?.addEventListener("click", showLogin);

  // handle auth calls
  async function doLogin(e) {
    e.preventDefault();
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value.trim();
    if (!email || !password) return alert("Nhập email và mật khẩu");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi đăng nhập");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "home.html";
    } catch (err) { alert("Đăng nhập thất bại: " + err.message); }
  }

  async function doRegister(e) {
    e.preventDefault();
    const name = $("regName").value.trim();
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value.trim();
    if (!name || !email || !password) return alert("Nhập đủ thông tin");
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi đăng ký");
      alert("Đăng ký thành công! Vui lòng đăng nhập.");
      showLogin();
    } catch (err) { alert("Đăng ký lỗi: " + err.message); }
  }

  loginForm?.addEventListener("submit", doLogin);
  registerForm?.addEventListener("submit", doRegister);
}

// ------------------ HOME PAGE LOGIC (home.html) ------------------
let currentUser = null;

async function loadUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token");
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }});
    const data = await res.json();
    if (!data || !data.email) throw new Error("Not authenticated");
    currentUser = data;
    $("profileName") && ($("profileName").textContent = data.name || data.username || "Người dùng");
    $("profileMeta") && ($("profileMeta").textContent = data.title || "");
    $("profileAvatar") && ($("profileAvatar").src = data.avatar || "https://i.imgur.com/AVT0a.png");
    // tell server presence
    socket.emit("userOnline", currentUser.name || currentUser.username || "Khách");
    return true;
  } catch (err) {
    console.warn("loadUser:", err.message);
    currentUser = null;
    $("profileName") && ($("profileName").textContent = "Khách");
    $("profileAvatar") && ($("profileAvatar").src = "https://i.imgur.com/AVT0a.png");
    return false;
  }
}

// feed
function normalizePost(p) {
  return {
    _id: p._id || p.id || String(Math.random()).slice(2),
    content: p.content || "",
    createdAt: p.createdAt || p.created_at || p.ts || Date.now(),
    username: (p.user && (p.user.name || p.user.username)) || p.username || "Ẩn danh",
    user: p.user || { name: (p.user && p.user.name) || p.username || "Người", avatar: (p.user && p.user.avatar) || p.avatar || "https://i.imgur.com/AVT0a.png"},
    image: p.imageUrl || p.image || p.image_path || null
  };
}

async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const data = await res.json();
    const feed = $("feed");
    if (!Array.isArray(data)) { feed.innerHTML = "<div>Không có bài viết</div>"; return; }
    data.sort((a,b)=> new Date(b.createdAt || b.created_at || b.ts || Date.now()) - new Date(a.createdAt || a.created_at || a.ts || Date.now()));
    feed.innerHTML = "";
    data.forEach(p => addPostToFeed(normalizePost(p), false));
  } catch (err) { console.error("loadFeed err", err); }
}

function addPostToFeed(post, toTop=true) {
  const feed = $("feed");
  if (!feed) return;
  const div = document.createElement("div");
  div.className = "post animate-pop";
  const id = post._id;
  const avatar = post.user.avatar || "https://i.imgur.com/AVT0a.png";
  const username = escapeHtml(post.username || post.user.name);
  const time = fmtTime(post.createdAt);
  const content = escapeHtml(post.content || "");
  const imageHtml = post.image ? `<div class="post-img-wrap"><img src="${post.image}" alt="post image" /></div>` : "";
  div.innerHTML = `
    <div class="post-header">
      <img src="${avatar}" alt="av"/>
      <div>
        <div style="font-weight:700">${username}</div>
        <div style="font-size:0.85rem;color:var(--muted)">${escapeHtml(time)}</div>
      </div>
      <div style="margin-left:auto;cursor:pointer;color:var(--muted)" onclick="openProfile('${escapeHtml(post.user._id || "")}')">Xem</div>
    </div>
    <div class="post-content">${content}</div>
    ${imageHtml}
    <div class="post-actions">
      <button class="action-btn like-btn" data-post-like="${id}" data-count="0">❤ 0</button>
      <button class="action-btn comment-toggle">💬 Bình luận</button>
      <button class="action-btn share-btn">⤴ Chia sẻ</button>
    </div>
    <div id="comments-${id}" class="comments" style="display:none"></div>
  `;
  // attach handlers
  const likeBtn = div.querySelector(".like-btn");
  likeBtn && (likeBtn.onclick = ()=>handleLike(id));
  const commentToggle = div.querySelector(".comment-toggle");
  commentToggle && (commentToggle.onclick = ()=>toggleComments(id));
  const shareBtn = div.querySelector(".share-btn");
  shareBtn && (shareBtn.onclick = ()=>handleShare(id));

  if (toTop) { feed.prepend(div); div.animate([{background:"#0b243a"},{background:"transparent"}],{duration:900}); }
  else feed.appendChild(div);
}

// create post (with image upload fallback)
async function createPost() {
  const content = $("statusInput").value.trim();
  const fileInput = $("imageInput");
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  if (!token || !userStored) return alert("Bạn cần đăng nhập để đăng bài!");
  if (!content && (!fileInput || !fileInput.files.length)) return alert("Viết gì đó hoặc chọn ảnh!");

  // try FormData path first
  const fd = new FormData();
  fd.append("content", content);
  fd.append("userId", userStored._id);
  if (fileInput && fileInput.files[0]) fd.append("image", fileInput.files[0]);

  try {
    const res = await fetch(`${API_URL}/api/posts`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!res.ok) {
      // if 500 or server cannot accept multipart, fallback to JSON with base64 (if file small) or without image
      const text = await res.text();
      console.warn("Post error (multipart):", text);
      // fallback: if there's an image, warn and continue without it
      const fallbackBody = { content, userId: userStored._id };
      const res2 = await fetch(`${API_URL}/api/posts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(fallbackBody) });
      if (!res2.ok) { const t = await res2.text(); console.error("Fallback post failed:", t); return alert("Không thể đăng bài (server lỗi)."); }
      const post = await res2.json();
      const norm = normalizePost(post);
      addPostToFeed(norm, true);
      socket.emit("newPost", norm);
      $("statusInput").value = ""; fileInput.value = "";
      return;
    }
    const post = await res.json();
    const norm = normalizePost(post);
    addPostToFeed(norm, true);
    socket.emit("newPost", norm);
    $("statusInput").value = ""; fileInput.value = "";
  } catch (err) {
    console.error("createPost err:", err);
    alert("Lỗi khi đăng bài: " + (err.message || ""));
  }
}

// likes/comments
async function handleLike(postId) {
  const btn = document.querySelector(`[data-post-like="${postId}"]`);
  const userStored = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  if (btn) {
    let c = Number(btn.dataset.count || "0") + 1;
    btn.dataset.count = c;
    btn.innerText = `❤ ${c}`;
    btn.classList.add("liked");
    try { btn.animate([{transform:"scale(1)"},{transform:"scale(1.08)"},{transform:"scale(1)"}], { duration: 260 }); } catch {}
  }
  socket.emit("like", { postId, user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh" });
  if (token) {
    try { await fetch(`${API_URL}/api/posts/${postId}/like`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }); } catch (e) { console.warn("Like API failed:", e.message); }
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
    wrapper.innerHTML = `<input class="comment-input" placeholder="Viết bình luận..." style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03)"/><button class="action-btn">Gửi</button>`;
    wrapper.querySelector("button").addEventListener("click", ()=> {
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
    el.innerHTML = `<strong>${escapeHtml((userStored && (userStored.name || userStored.username)) || "Ẩn danh")}</strong>: ${escapeHtml(text)}`;
    box.appendChild(el);
  }
  socket.emit("comment", { postId, user: (userStored && (userStored.name || userStored.username)) || "Ẩn danh", text });
  if (token) {
    try { await fetch(`${API_URL}/api/posts/${postId}/comment`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); } catch (e) { console.warn("Comment API failed:", e.message); }
  }
}

// share / profile open
function handleShare(postId) { navigator.clipboard?.writeText(location.href + `?post=${postId}`); showToast("Đã sao chép link bài viết"); }
function openProfile(userId) {
  $("profileModal").style.display = "flex";
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  if (stored && (!userId || stored._id === userId)) {
    $("editName").value = stored.name || "";
    $("editEmail").value = stored.email || "";
    $("editAvatar").value = stored.avatar || "";
  } else {
    $("editName").value = "";
    $("editEmail").value = "";
    $("editAvatar").value = "";
  }
}
function closeProfile() { $("profileModal").style.display = "none"; }

function showToast(msg) { const wrapper = $("toastWrapper"); if(!wrapper) return; const el = document.createElement("div"); el.className = "toast"; el.innerHTML = `<strong>${escapeHtml(msg)}</strong>`; wrapper.appendChild(el); setTimeout(()=>{ el.style.opacity = "0"; setTimeout(()=>el.remove(),300); }, 3200); }

// ----------------- chat popup -----------------
function buildChatPopup() {
  const root = $("chatContainer");
  if (!root) return;
  root.innerHTML = `
    <div class="chat-popup" id="chatPopup">
      <div class="title">
        <div>💬 Chat ZingMini</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="online-dot" style="width:8px;height:8px;border-radius:50%;background:#2ee6a4"></div>
          <button class="action-btn" id="minimizeChat">−</button>
        </div>
      </div>
      <div class="messages" id="chatMessages"></div>
      <div class="controls">
        <input id="chatInput" placeholder="Nhập tin nhắn..." />
        <button id="chatSendBtn" class="btn primary">Gửi</button>
      </div>
    </div>
  `;
  $("chatSendBtn").addEventListener("click", sendMessage);
  $("chatInput").addEventListener("keypress", (e)=>{ if (e.key === "Enter") sendMessage(); });
}
buildChatPopup();

function appendChatMessage(msg, isSelf) {
  const box = $("chatMessages");
  if (!box) return;
  const wrapper = document.createElement("div");
  wrapper.className = "msg " + (isSelf ? "self" : "other");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<strong>${escapeHtml(msg.user)}</strong>: ${escapeHtml(msg.text)}`;
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
  const name = (stored && (stored.name || stored.username)) || "Ẩn danh";
  const msg = { user: name, text, ts: Date.now() };
  // append locally (self)
  appendChatMessage(msg, true);
  // emit
  socket.emit("chat", msg);
  input.value = "";
}

// socket handlers for realtime (avoid echo duplicates)
socket.on("chat", (msg) => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const myName = (stored && (stored.name || stored.username)) || null;
    if (myName && msg.user === myName) return; // ignore server echo
    appendChatMessage(msg, false);
    playTing();
  } catch (e) {
    appendChatMessage(msg, false);
    playTing();
  }
});

socket.on("newPost", (p) => {
  const post = normalizePost(p);
  addPostToFeed(post, true);
  showToast(`${post.username} vừa đăng bài`);
});

socket.on("like", (d) => {
  const el = document.querySelector(`[data-post-like="${d.postId}"]`);
  if (el) { let c = Number(el.dataset.count || 0) + 1; el.dataset.count = c; el.innerText = `❤ ${c}`; el.classList.add("liked"); }
  showToast(`${d.user} đã thích 1 bài viết`);
});

socket.on("comment", (d) => {
  const box = $(`comments-${d.postId}`); if (box) { const el = document.createElement("div"); el.className = "comment"; el.innerHTML = `<strong>${escapeHtml(d.user)}</strong>: ${escapeHtml(d.text)}`; box.appendChild(el); }
  showToast(`${d.user} vừa bình luận`);
});

socket.on("notification", (n) => showToast(n.title || n || "Thông báo"));

socket.on("onlineUsers", (list) => {
  const ul = $("friendsList"); if (!ul) return; ul.innerHTML = ""; list.forEach(name => { const li = document.createElement("li"); li.innerHTML = `<span class="dot"></span>${escapeHtml(name)}`; ul.appendChild(li); });
});

// ---------------- init wiring ----------------
document.addEventListener("DOMContentLoaded", async () => {
  // detect which page: if auth form exists => initAuthPage
  if ($("loginForm") && $("registerForm")) {
    try { initAuthPage(); } catch (e) { console.error("initAuthPage", e); }
    return;
  }

  // else assume home page
  await loadUser();
  buildChatPopup();
  loadFeed();

  // wire buttons
  $("postBtn")?.addEventListener("click", createPost);
  $("editProfileBtn")?.addEventListener("click", ()=>{ $("profileModal").style.display = "flex"; const stored = JSON.parse(localStorage.getItem("user") || "null"); if (stored) { $("editName").value = stored.name || ""; $("editEmail").value = stored.email || ""; $("editAvatar").value = stored.avatar || ""; }});
  $("saveProfileBtn")?.addEventListener("click", async ()=> {
    // save via API (PUT /api/auth/me) — backend must support
    const name = $("editName").value.trim();
    const avatar = $("editAvatar").value.trim();
    const token = localStorage.getItem("token");
    if (!token) return alert("Bạn cần đăng nhập");
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { method: "PUT", headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify({ name, avatar }) });
      if (!res.ok) { const t = await res.text(); console.error("save profile err", t); return alert("Không thể lưu thông tin"); }
      const d = await res.json();
      localStorage.setItem("user", JSON.stringify(d));
      await loadUser();
      $("profileModal").style.display = "none";
      showToast("Cập nhật hồ sơ thành công");
    } catch (e) { console.error("saveProfile", e); alert("Lỗi lưu hồ sơ"); }
  });
  $("cancelProfileBtn")?.addEventListener("click", ()=> $("profileModal").style.display = "none");
  $("logoutBtn")?.addEventListener("click", ()=> { localStorage.removeItem("token"); localStorage.removeItem("user"); location.href = "index.html"; });
  $("notifBtn")?.addEventListener("click", ()=> { const b = $("notifBadge"); if (b) { b.style.display = "none"; b.innerText = "0"; } showToast("Đã xem thông báo"); });

  // small demo populate suggestions/games/stories
  (function populateDemos(){
    const stories = [{name:"Linh",img:"https://i.imgur.com/XC8ZbZC.jpg"},{name:"Huy",img:"https://i.imgur.com/5ZQbB3k.jpg"},{name:"An",img:"https://i.imgur.com/zCw6zZC.jpg"}];
    $("storyBox").innerHTML = stories.map(s=>`<div class="story"><img src="${s.img}" /><div>${escapeHtml(s.name)}</div></div>`).join("");
    const suggestions = [{name:"Trang",img:"https://i.imgur.com/2vS8t4h.jpg"},{name:"Đạt",img:"https://i.imgur.com/Tjz5UB1.jpg"}];
    $("suggestBox").innerHTML = suggestions.map(p=>`<div class="suggest-item"><div class="suggest-info"><img src="${p.img}"/><span>${escapeHtml(p.name)}</span></div><button class="add-friend btn small btn-outline">Kết bạn</button></div>`).join("");
    const games = [{name:"Zing Farm",img:"https://i.imgur.com/dzWl3V7.png"},{name:"Gunny",img:"https://i.imgur.com/0LKBgGR.png"}];
    $("gameList").innerHTML = games.map(g=>`<div class="game-item"><img class="game-thumb" src="${g.img}"/><div>${escapeHtml(g.name)}</div></div>`).join("");
  })();
});
