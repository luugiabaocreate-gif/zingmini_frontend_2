const API_URL = "https://zingmini-backend-2.onrender.com";

// ✅ Tạo socket với fallback để Render hoạt động ổn định
const socket = io(API_URL, {
  transports: ["websocket", "polling"],
});

// Log trạng thái kết nối
socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});
socket.on("connect_error", (err) => {
  console.error("❌ Socket connect error:", err.message);
});

// Khi có tin nhắn realtime gửi đến
socket.on("chat", (msg) => {
  addMessageToChat(msg);
});

// ======================
// 🧩 Load bài đăng mới nhất lên đầu
// ======================
async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const data = await res.json();
    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    // ✅ Sắp xếp mới nhất trước
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    data.forEach((p) => addPostToFeed(p, false));
  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
  }
}

// ======================
// 🧩 Đăng bài
// ======================
async function handlePostSubmit(e) {
  e.preventDefault();
  const content = document.getElementById("postContent").value.trim();
  if (!content) return;

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return alert("Bạn cần đăng nhập để đăng bài!");

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, userId: user._id }),
    });
    const post = await res.json();
    document.getElementById("postContent").value = "";

    // ✅ Thêm bài mới lên đầu
    addPostToFeed(post, true);
  } catch (err) {
    console.error("Lỗi đăng bài:", err);
  }
}

// ======================
// 🧩 Hiển thị bài đăng
// ======================
function addPostToFeed(post, isNew = false) {
  const feed = document.getElementById("feed");
  const div = document.createElement("div");
  div.className = "post";

  div.innerHTML = `
    <div class="post-header">
      <span class="username">${post.username || "Người dùng ẩn danh"}</span>
      <span class="time">${new Date(post.createdAt).toLocaleString()}</span>
    </div>
    <div class="post-content">${post.content}</div>
  `;

  if (isNew) {
    feed.prepend(div); // mới nhất lên đầu
  } else {
    feed.appendChild(div);
  }
}

// ======================
// 💬 Chat Realtime
// ======================
function addMessageToChat(msg) {
  const chatBody = document.getElementById("chatBody");
  const div = document.createElement("div");
  div.className = "chat-message";

  div.innerHTML = `
    <strong>${msg.user || "Ẩn danh"}:</strong> ${msg.text}
  `;

  // ✅ Hiển thị tin nhắn mới nhất ở cuối
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight; // auto scroll
}

// ======================
// Gửi tin nhắn
// ======================
function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  const user = JSON.parse(localStorage.getItem("user")) || {
    username: "Ẩn danh",
  };
  const msg = { user: user.username, text };

  // Gửi realtime
  socket.emit("chat", msg);

  // Hiển thị luôn trên giao diện
  addMessageToChat(msg);

  input.value = "";
}

// ======================
// Khởi động ban đầu
// ======================
document.addEventListener("DOMContentLoaded", () => {
  loadFeed();

  const postForm = document.getElementById("postForm");
  if (postForm) postForm.addEventListener("submit", handlePostSubmit);

  const chatBtn = document.getElementById("chatSendBtn");
  if (chatBtn) chatBtn.addEventListener("click", sendMessage);
});
