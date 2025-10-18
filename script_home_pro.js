// =====================
// ZingMini Home Logic (Realtime + Feed + Chat + Theme)
// =====================

import io from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";
const API = "https://zingmini-backend-2.onrender.com";
const socket = io(API);

// ==== Auth check ====
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!token || !user) {
  window.location.href = "index.html";
}

// ==== Logout ====
document.getElementById("logout-btn").onclick = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

// ==== Load Posts ====
const feed = document.getElementById("feed");
async function loadPosts() {
  feed.innerHTML = "<p>Đang tải bài viết...</p>";
  const res = await fetch(`${API}/api/posts`);
  const posts = await res.json();
  feed.innerHTML = "";
  posts.forEach(renderPost);
}
function renderPost(p) {
  const div = document.createElement("div");
  div.className = "post";
  div.innerHTML = `
    <div class="post-header">
      <img src="https://i.imgur.com/z6bZ8QF.png" alt="">
      <h4>${p.user?.name || "Người dùng"}</h4>
    </div>
    <div class="post-content">${p.content || ""}</div>
    ${p.image ? `<img class="post-image" src="${API}${p.image}" alt="">` : ""}
    <div class="post-actions">
      <button class="like-btn">👍 Thích</button>
      <button class="comment-btn">💬 Bình luận</button>
      <button class="share-btn">↗️ Chia sẻ</button>
    </div>
  `;
  feed.appendChild(div);
}
loadPosts();

// ==== Create Post ====
document.getElementById("post-btn").onclick = async () => {
  const content = document.getElementById("post-content").value.trim();
  const file = document.getElementById("post-image").files[0];
  if (!content && !file) return alert("Hãy viết gì đó hoặc chọn ảnh!");

  const fd = new FormData();
  fd.append("content", content);
  if (file) fd.append("image", file);

  try {
    const res = await fetch(`${API}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) throw new Error("Lỗi khi đăng bài");
    document.getElementById("post-content").value = "";
    document.getElementById("post-image").value = "";
    loadPosts();
  } catch (err) {
    console.error(err);
    alert("Đăng bài thất bại!");
  }
};

// ==== Friend List ====
const friendList = document.getElementById("friend-list");
const friends = ["ZingBot", "Minh", "Linh", "An", "Hà", "Khang"];
friends.forEach((f) => {
  const el = document.createElement("div");
  el.className = "friend-item";
  el.innerHTML = `<img src="https://i.imgur.com/z6bZ8QF.png"/><span>${f}</span>`;
  el.onclick = () => openChatBox(f);
  friendList.appendChild(el);
});

// ==== Multi Chat Boxes ====
const chatContainer = document.getElementById("chat-container");
const openChats = {};

function openChatBox(friend) {
  if (openChats[friend]) return; // đã mở
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    <div class="chat-header">
      <span>${friend}</span>
      <button class="close-chat">✖</button>
    </div>
    <div class="chat-messages" id="msgs-${friend}"></div>
    <div class="chat-input">
      <input type="text" id="input-${friend}" placeholder="Nhắn tin..."/>
      <button>Gửi</button>
    </div>
  `;
  chatContainer.appendChild(box);
  openChats[friend] = box;

  box.querySelector(".close-chat").onclick = () => {
    chatContainer.removeChild(box);
    delete openChats[friend];
  };

  const btn = box.querySelector("button");
  const input = box.querySelector("input");
  btn.onclick = () => sendMessage(friend, input.value);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage(friend, input.value);
  });
}

// ==== Chat Logic ====
function sendMessage(to, msg) {
  if (!msg.trim()) return;
  const box = document.getElementById(`msgs-${to}`);
  const div = document.createElement("div");
  div.textContent = `Bạn: ${msg}`;
  box.appendChild(div);
  socket.emit("chat_message", { from: user.name, to, msg });
  box.scrollTop = box.scrollHeight;
}

socket.on("chat_message", (data) => {
  const { from, msg } = data;
  if (!openChats[from]) openChatBox(from);
  const box = document.getElementById(`msgs-${from}`);
  const div = document.createElement("div");
  div.textContent = `${from}: ${msg}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});
/* =====================
   ZINGMINI RETRO EFFECTS
   ===================== */
window.addEventListener("DOMContentLoaded", () => {
  // Tạo màn hình loading
  const loader = document.createElement("div");
  loader.id = "zingmini-loader";
  loader.innerHTML = `<h1>ZingMini</h1>`;
  document.body.appendChild(loader);

  // Khi trang load xong -> hiện dần nội dung
  setTimeout(() => {
    document.body.style.opacity = "1";
  }, 1500);
});

/* Hiệu ứng chuyển sáng/tối mượt */
const toggleThemeSmooth = document.getElementById("toggle-theme");
if (toggleThemeSmooth) {
  toggleThemeSmooth.addEventListener("click", () => {
    document.body.style.transition =
      "background 0.6s ease, color 0.6s ease, opacity 0.5s ease";
  });
}
