// 💬 ZingMini Classic Home Script – Realtime & UI Control (FIXED FINAL)

const API_URL = "https://zingmini-backend-2.onrender.com"; // backend Render
const socket = io(API_URL);

// ===== CHECK TOKEN =====
const token = localStorage.getItem("token");
if (!token) {
  alert("Vui lòng đăng nhập lại!");
  location.href = "index.html";
}
let currentUser = null;

// ============ LOAD USER ============
async function loadUser() {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data && data.email) {
      currentUser = data;
      document.getElementById("profileName").textContent =
        data.name || "Người dùng";
      document.getElementById("profileAvatar").src =
        data.avatar || "https://i.imgur.com/AVT0a.png";
    } else {
      alert("Vui lòng đăng nhập lại!");
      location.href = "index.html";
    }
  } catch (err) {
    console.error("Lỗi load user:", err);
    location.href = "index.html";
  }
}
loadUser();

// ============ ĐĂNG BÀI ============
async function createPost() {
  const text = document.getElementById("statusInput").value.trim();
  const file = document.getElementById("imageInput").files[0];
  if (!text && !file) return alert("Viết gì đó hoặc chọn ảnh nhé!");

  const formData = new FormData();
  formData.append("content", text);
  if (file) formData.append("image", file);

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const post = await res.json();
    if (post && post._id) {
      addPostToFeed(post, true);
      document.getElementById("statusInput").value = "";
      document.getElementById("imageInput").value = "";
    } else {
      alert("Đăng bài thất bại!");
    }
  } catch (err) {
    alert("Lỗi đăng bài: " + err.message);
  }
}

// ============ HIỂN THỊ BÀI VIẾT ============
async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const data = await res.json();
    const feed = document.getElementById("feed");
    feed.innerHTML = "";
    data.reverse().forEach((p) => addPostToFeed(p, false));
  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
  }
}

function addPostToFeed(post, prepend = false) {
  const feed = document.getElementById("feed");
  const div = document.createElement("div");
  div.className = "post";
  div.innerHTML = `
    <div class="post-header">
      <img src="${post.user?.avatar || "https://i.imgur.com/AVT0a.png"}" />
      <span>${post.user?.name || "Ẩn danh"}</span>
    </div>
    <div class="post-content">${post.content || ""}</div>
    ${
      post.image
        ? `<div class="post-img-wrap"><img src="${post.image}" /></div>`
        : ""
    }
  `;
  if (prepend) feed.prepend(div);
  else feed.appendChild(div);
}
loadFeed();

// ============ STORY DEMO ============
const stories = [
  { name: "Linh", img: "https://i.imgur.com/XC8ZbZC.jpg" },
  { name: "Huy", img: "https://i.imgur.com/5ZQbB3k.jpg" },
  { name: "An", img: "https://i.imgur.com/zCw6zZC.jpg" },
  { name: "Minh", img: "https://i.imgur.com/6dT0Rsy.jpg" },
];
document.getElementById("storyBox").innerHTML = stories
  .map(
    (s) =>
      `<div class="story"><img src="${s.img}" alt="${s.name}"/><div>${s.name}</div></div>`
  )
  .join("");

// ============ GỢI Ý KẾT BẠN ============
const suggestions = [
  { name: "Trang", img: "https://i.imgur.com/2vS8t4h.jpg" },
  { name: "Đạt", img: "https://i.imgur.com/Tjz5UB1.jpg" },
  { name: "Phương", img: "https://i.imgur.com/VnC8I8V.jpg" },
];
document.getElementById("suggestBox").innerHTML = suggestions
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

// ============ GAME LIST ============
const games = [
  { name: "Zing Farm", img: "https://i.imgur.com/dzWl3V7.png" },
  { name: "Gunny", img: "https://i.imgur.com/0LKBgGR.png" },
  { name: "Boom", img: "https://i.imgur.com/twZCh6O.png" },
];
document.getElementById("gameList").innerHTML = games
  .map(
    (g) => `
  <div class="game-item">
    <img class="game-thumb" src="${g.img}"/>
    <div>${g.name}</div>
  </div>`
  )
  .join("");

// ============ FRIENDS ONLINE DEMO ============
const friends = [
  { name: "Tuấn", online: true },
  { name: "Mai", online: true },
  { name: "Phúc", online: false },
];
document.getElementById("friendsList").innerHTML = friends
  .map(
    (f) =>
      `<li><span class="dot" style="opacity:${f.online ? 1 : 0.3}"></span>${
        f.name
      }</li>`
  )
  .join("");

// ============ CHAT REALTIME ============
const chatBody = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  const msg = { user: currentUser?.name || "Ẩn danh", text };
  socket.emit("chat", msg);
  chatInput.value = "";
}

socket.on("chat", (msg) => {
  const div = document.createElement("div");
  div.className = "msg";
  if (msg.user === currentUser?.name) div.classList.add("self");
  div.innerHTML = `<strong>${msg.user}:</strong> ${
    msg.text
  }<span class="time">${new Date().toLocaleTimeString()}</span>`;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;

  if (msg.user !== currentUser?.name) {
    document.querySelector(".chat-header").style.background =
      "linear-gradient(90deg,#ff99c8,#a58cff)";
    setTimeout(() => {
      document.querySelector(".chat-header").style.background =
        "linear-gradient(90deg,#6ea8ff,#a58cff)";
    }, 1200);
  }
});

// ============ LOGOUT ============
function logout() {
  localStorage.removeItem("token");
  location.href = "index.html";
}
