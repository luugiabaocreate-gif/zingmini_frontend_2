/* script_home_pro.js — ZingMini Full Enhanced
   - Keep: createPost (multipart + token), loadFeed sort newest first
   - Realtime: chat (no-dup from self), like, comment, newPost, notification, online users
   - UI: profile modal edit, stories, suggestions, games, friend list
   - Effects: sound, toast, bubble animations
*/

const API_URL = "https://zingmini-backend-2.onrender.com";
const socket = io(API_URL, { transports: ["websocket", "polling"] });

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => { if (s === null || s === undefined) return ""; return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); };
const fmtTime = (t) => { try { return new Date(t).toLocaleString(); } catch { return "N/A"; } };

/* ---------------- sound ---------------- */
function playTing(){
  try {
    const a = new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_0b7d2d2b9d.mp3?filename=message-pop-14792.mp3");
    a.volume = 0.32; a.play().catch(()=>{});
  } catch {}
}

/* ---------------- toasts ---------------- */
function showNotification(n){
  const wrapper = $("toastWrapper");
  if(!wrapper) return;
  const el = document.createElement("div"); el.className="toast";
  if(typeof n === "string") el.innerHTML = `<strong>${escapeHtml(n)}</strong>`; else el.innerHTML = `<strong>${escapeHtml(n.title||"Thông báo")}</strong><div style="font-size:0.85rem">${escapeHtml(n.body||"")}</div>`;
  wrapper.appendChild(el);
  const badge = $("notifBadge");
  if(badge){ badge.style.display="inline-block"; badge.innerText = Number(badge.innerText||"0") + 1; }
  setTimeout(()=>{ el.style.opacity = "0"; setTimeout(()=>el.remove(),400); }, 3500);
}

/* ---------------- user load ---------------- */
let currentUser = null;
async function loadUser(){
  try {
    const token = localStorage.getItem("token");
    if(!token) throw new Error("No token");
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }});
    const data = await res.json();
    if(!data || !data.email) throw new Error("Not auth");
    currentUser = data;
    $("profileName").textContent = data.name || data.username || "Người dùng";
    $("profileAvatar").src = data.avatar || "https://i.imgur.com/AVT0a.png";
    // emit online
    socket.emit("userOnline", (data.name || data.username || "Khách"));
  } catch(e){
    console.warn("loadUser:", e.message);
    currentUser = null;
    $("profileName").textContent = "Khách";
    $("profileAvatar").src = "https://i.imgur.com/AVT0a.png";
  }
}
loadUser();

/* ---------------- socket handlers ---------------- */
socket.on("connect", ()=>console.log("socket connected", socket.id));
socket.on("connect_error", (err)=>console.error("socket err", err.message));

// chat — avoid double display from own echo
socket.on("chat", (msg) => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const myName = (stored && (stored.name || stored.username)) || null;
    if(myName && msg.user === myName) return; // ignore echo
    appendChatMessage(msg, false);
    playTing();
  } catch(e){
    console.warn("chat handler:", e.message);
    appendChatMessage(msg, false);
    playTing();
  }
});

// like/comment/newPost/notification/online
socket.on("like", (d) => {
  // update like UI if exists
  const el = document.querySelector(`[data-post-like="${d.postId}"]`);
  if(el){ const c = Number(el.dataset.count||0) + 1; el.dataset.count = c; el.innerText = `❤ ${c}`; el.classList.add("liked"); el.animate([{transform:"scale(1.0)"},{transform:"scale(1.08)"},{transform:"scale(1.0)"}],{duration:320}); }
  showNotification({title:`${d.user} vừa thích một bài viết`});
});
socket.on("comment", (d) => {
  const box = $(`comments-${d.postId}`);
  if(box){ const c = document.createElement("div"); c.className="comment"; c.innerHTML = `<strong>${escapeHtml(d.user)}</strong>: ${escapeHtml(d.text)}`; box.appendChild(c); }
  showNotification({title:`${d.user} vừa bình luận`});
});
socket.on("newPost", (p) => {
  const norm = normalizePost(p);
  addPostToFeed(norm, true);
  showNotification({title:`${norm.username} vừa đăng bài mới`});
});
socket.on("notification", (n) => showNotification(n));
socket.on("onlineUsers", (list) => {
  const ul = $("friendsList"); if(!ul) return; ul.innerHTML = "";
  list.forEach(name => { const li = document.createElement("li"); li.innerHTML = `<span class="dot" style="opacity:1"></span>${escapeHtml(name)}`; ul.appendChild(li); });
});

/* ---------------- chat UI ---------------- */
function buildChatPopup(){
  const root = $("chatContainer"); if(!root) return;
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
  $("chatInput").addEventListener("keypress", (e)=>{ if(e.key==="Enter") sendMessage(); });
}
buildChatPopup();

function appendChatMessage(msg, self){
  const box = $("chatMessages"); if(!box) return;
  const wrapper = document.createElement("div"); wrapper.className = "msg " + (self ? "self" : "other");
  const bubble = document.createElement("div"); bubble.className = "bubble";
  bubble.innerHTML = `<strong>${escapeHtml(msg.user)}</strong>: ${escapeHtml(msg.text)}`;
  bubble.style.maxWidth = "78%";
  const meta = document.createElement("div"); meta.className = "chat-time"; meta.textContent = fmtTime(msg.ts || msg.time || Date.now());
  wrapper.appendChild(bubble); wrapper.appendChild(meta);
  box.appendChild(wrapper); box.scrollTop = box.scrollHeight;
}

function sendMessage(){
  const input = $("chatInput"); if(!input) return;
  const text = input.value.trim(); if(!text) return;
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  const name = (stored && (stored.name || stored.username)) || "Ẩn danh";
  const msg = { user: name, text, ts: Date.now() };
  // append locally as self
  appendChatMessage(msg, true);
  // emit
  socket.emit("chat", msg);
  input.value = "";
}

/* ---------------- feed handling ---------------- */
function normalizePost(p){
  return {
    _id: p._id || p.id || String(Math.random()).slice(2),
    content: p.content || "",
    createdAt: p.createdAt || p.created_at || p.ts || Date.now(),
    username: (p.user && (p.user.name || p.user.username)) || p.username || "Ẩn danh",
    user: p.user || { name:(p.user && p.user.name) || p.username || "Người dùng", avatar: (p.user && p.user.avatar) || p.avatar || "https://i.imgur.com/AVT0a.png" },
    image: p.imageUrl || p.image || p.image_path || null
  };
}

async function loadFeed(){
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const arr = await res.json();
    arr.sort((a,b)=> new Date(b.createdAt||b.created_at||b.ts||Date.now()) - new Date(a.createdAt||a.created_at||a.ts||Date.now()));
    $("feed").innerHTML = "";
    arr.forEach(p => addPostToFeed(normalizePost(p), false));
  } catch(e){ console.error("loadFeed", e); }
}
loadFeed();

function addPostToFeed(post, top=true){
  const feed = $("feed"); if(!feed) return;
  const div = document.createElement("div"); div.className = "post animate-pop";
  const id = post._id;
  const imageHtml = post.image ? `<div class="post-img-wrap"><img src="${post.image}" alt="img"/></div>` : "";
  div.innerHTML = `
    <div class="post-header">
      <img src="${post.user.avatar || 'https://i.imgur.com/AVT0a.png'}" />
      <div>
        <div style="font-weight:700">${escapeHtml(post.username)}</div>
        <div style="font-size:0.8rem;color:#666">${escapeHtml(fmtTime(post.createdAt))}</div>
      </div>
      <div style="margin-left:auto;cursor:pointer;color:#888" onclick="openProfile('${escapeHtml(post.user._id||"")}')">Xem</div>
    </div>
    <div class="post-content">${escapeHtml(post.content)}</div>
    ${imageHtml}
    <div class="post-actions">
      <button class="action-btn like-btn" data-post-like="${id}" data-count="0" onclick="handleLike('${id}')">❤ 0</button>
      <button class="action-btn comment-toggle" onclick="toggleComments('${id}')">💬 Bình luận</button>
      <button class="action-btn share-btn" onclick="handleShare('${id}')">⤴ Chia sẻ</button>
    </div>
    <div id="comments-${id}" class="comments" style="display:none"></div>
  `;
  if(top){ feed.prepend(div); div.animate([{background:"#fff7ff"},{background:"transparent"}],{duration:1200}); }
  else feed.appendChild(div);
}

/* ---------------- create post ---------------- */
async function createPost(){
  const content = $("statusInput").value.trim();
  const imgEl = $("imageInput");
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user")||"null");
  if(!token || !userStored) return alert("Bạn cần đăng nhập để đăng bài!");
  if(!content && (!imgEl || !imgEl.files.length)) return alert("Viết gì đó hoặc chọn ảnh!");

  const fd = new FormData(); fd.append("content", content); fd.append("userId", userStored._id);
  if(imgEl && imgEl.files[0]) fd.append("image", imgEl.files[0]);
  try {
    const res = await fetch(`${API_URL}/api/posts`, { method:"POST", headers: { Authorization:`Bearer ${token}` }, body: fd });
    if(!res.ok){ const txt = await res.text(); console.error("post err", txt); return alert("Không thể đăng bài. Đăng nhập lại?"); }
    const data = await res.json();
    const norm = normalizePost(data);
    addPostToFeed(norm, true);
    socket.emit("newPost", norm);
    $("statusInput").value=""; if(imgEl) imgEl.value="";
  } catch(e){ console.error("createPost", e); alert("Lỗi mạng khi đăng bài"); }
}

/* ---------------- likes/comments ---------------- */
async function handleLike(postId){
  const btn = document.querySelector(`[data-post-like="${postId}"]`);
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user")||"null");
  if(btn){ let c = Number(btn.dataset.count||0)+1; btn.dataset.count = c; btn.innerText = `❤ ${c}`; btn.classList.add("liked"); }
  socket.emit("like", { postId, user: (userStored && (userStored.name||userStored.username)) || "Ẩn danh" });
  if(token){
    try{ await fetch(`${API_URL}/api/posts/${postId}/like`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" } }); } catch(e){ console.warn("like API", e.message); }
  }
}

function toggleComments(postId){
  const box = $(`comments-${postId}`); if(!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
  if(box && !box.querySelector(".comment-input")){
    const wrapper = document.createElement("div"); wrapper.style.display="flex"; wrapper.style.gap="8px"; wrapper.style.marginTop="8px";
    wrapper.innerHTML = `<input class="comment-input" placeholder="Viết bình luận..." style="flex:1;padding:8px;border-radius:8px;border:1px solid #eee"/><button class="action-btn">Gửi</button>`;
    wrapper.querySelector("button").addEventListener("click", ()=>{ const txt = wrapper.querySelector("input").value.trim(); submitComment(postId, txt); wrapper.querySelector("input").value=""; });
    box.prepend(wrapper);
  }
}

async function submitComment(postId, text){
  if(!text || !text.trim()) return;
  const token = localStorage.getItem("token");
  const userStored = JSON.parse(localStorage.getItem("user")||"null");
  const box = $(`comments-${postId}`);
  if(box){ const el = document.createElement("div"); el.className="comment"; el.innerHTML = `<strong>${escapeHtml((userStored && (userStored.name||userStored.username)) || "Ẩn danh")}</strong>: ${escapeHtml(text)`; box.appendChild(el); }
  socket.emit("comment", { postId, user:(userStored && (userStored.name||userStored.username))||"Ẩn danh", text });
  if(token){
    try { await fetch(`${API_URL}/api/posts/${postId}/comment`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body: JSON.stringify({ text }) }); } catch(e){ console.warn("comment api", e.message); }
  }
}

/* ---------------- share/profile ---------------- */
function handleShare(postId){ navigator.clipboard?.writeText(location.href+`?post=${postId}`); showNotification("Đã sao chép link bài viết"); }
function openProfile(userId){
  const modal = $("profileModal"); const details = $("profileDetails"); modal.style.display="flex";
  const stored = JSON.parse(localStorage.getItem("user")||"null");
  if(stored && (!userId || stored._id === userId)){
    details.innerHTML = `<img src="${stored.avatar || 'https://i.imgur.com/AVT0a.png'}" style="width:80px;height:80px;border-radius:50%"/><h3>${escapeHtml(stored.name||stored.username||'Người dùng')}</h3><p>${escapeHtml(stored.email||'')}</p>`;
  } else {
    details.innerHTML = `<img src="https://i.imgur.com/AVT0a.png" style="width:80px;height:80px;border-radius:50%"/><h3>Người dùng</h3><p>Không có thông tin</p>`;
  }
}
function closeProfile(){ $("profileModal").style.display="none"; }

/* ---------------- demos: stories/suggest/games/friends ---------------- */
(function populateDemo(){
  const stories = [{name:"Linh",img:"https://i.imgur.com/XC8ZbZC.jpg"},{name:"Huy",img:"https://i.imgur.com/5ZQbB3k.jpg"},{name:"An",img:"https://i.imgur.com/zCw6zZC.jpg"}];
  $("storyBox").innerHTML = stories.map(s=>`<div class="story"><img src="${s.img}" /><div>${escapeHtml(s.name)}</div></div>`).join("");
  const suggestions = [{name:"Trang",img:"https://i.imgur.com/2vS8t4h.jpg"},{name:"Đạt",img:"https://i.imgur.com/Tjz5UB1.jpg"}];
  $("suggestBox").innerHTML = suggestions.map(p=>`<div class="suggest-item"><div class="suggest-info"><img src="${p.img}" /><span>${escapeHtml(p.name)}</span></div><button class="add-friend">Kết bạn</button></div>`).join("");
  const games = [{name:"Zing Farm",img:"https://i.imgur.com/dzWl3V7.png"},{name:"Gunny",img:"https://i.imgur.com/0LKBgGR.png"}];
  $("gameList").innerHTML = games.map(g=>`<div class="game-item"><img class="game-thumb" src="${g.img}"/><div>${escapeHtml(g.name)}</div></div>`).join("");
  const friends = [{name:"Tuấn",online:true},{name:"Mai",online:true},{name:"Phúc",online:false}];
  $("friendsList").innerHTML = friends.map(f=>`<li><span class="dot" style="opacity:${f.online?1:0.3}"></span>${escapeHtml(f.name)}</li>`).join("");
})();

/* ---------------- wire UI buttons ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // post
  const pbtn = $("postBtn"); if(pbtn) pbtn.addEventListener("click", createPost);
  // edit profile open
  const ep = $("editProfileBtn"); if(ep) ep.addEventListener("click", ()=>{$("profileModal").style.display="flex"; const stored = JSON.parse(localStorage.getItem("user")||"null"); if(stored){ $("editName").value = stored.name || ""; $("editEmail").value = stored.email || ""; $("editAvatar").value = stored.avatar || ""; }});
  // save profile
  const save = $("saveProfileBtn"); if(save) save.addEventListener("click", async ()=>{
    const vname = $("editName").value.trim(); const vavatar = $("editAvatar").value.trim();
    const token = localStorage.getItem("token"); if(!token) return alert("Bạn cần đăng nhập");
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { method:"PUT", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body: JSON.stringify({ name:vname, avatar:vavatar }) });
      if(!res.ok) { const t = await res.text(); console.error("save profile", t); return alert("Không thay đổi được"); }
      const d = await res.json();
      localStorage.setItem("user", JSON.stringify(d));
      loadUser();
      $("profileModal").style.display="none";
      showNotification("Cập nhật hồ sơ thành công");
    } catch(e){ console.error("saveProfile", e); alert("Lỗi lưu thông tin"); }
  });
  // cancel profile
  const cancel = $("cancelProfileBtn"); if(cancel) cancel.addEventListener("click", ()=>{$("profileModal").style.display="none";});
  // logout
  const lobtn = $("logoutBtn"); if(lobtn) lobtn.addEventListener("click", ()=>{ localStorage.removeItem("token"); localStorage.removeItem("user"); location.href="index.html"; });
  // notif clear
  const nb = $("notifBtn"); if(nb) nb.addEventListener("click", ()=>{ const b=$("notifBadge"); if(b){ b.style.display="none"; b.innerText="0"; } showNotification("Đã xem thông báo");});
  // minimize chat
  document.addEventListener("click", (e)=>{ if(e.target && e.target.id === "minimizeChat"){ const cp = $("chatPopup"); if(cp) cp.style.display = cp.style.display === "none" ? "flex" : "none"; }});
  // navbar effects preserved
  document.querySelectorAll(".nav-btn").forEach(btn=>{ btn.addEventListener("mouseenter", ()=>btn.classList.add("animate-fade")); btn.addEventListener("mouseleave", ()=>btn.classList.remove("animate-fade")); });
});
