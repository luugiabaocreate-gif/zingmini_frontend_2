const API_URL = "https://zingmini-backend-2.onrender.com";

// ✅ Khởi tạo socket ổn định với Render
const socket = io(API_URL, {
  transports: ["websocket", "polling"],
});

// Kết nối socket log trạng thái
socket.on("connect", () => console.log("✅ Socket connected:", socket.id));
socket.on("connect_error", (err) =>
  console.error("❌ Socket connect error:", err.message)
);

// Khi có tin nhắn realtime gửi đến
socket.on("chat", (msg) => addMessageToChat(msg));

// ======================
// 🧩 Load bài đăng (mới nhất lên đầu)
// ======================
async function loadFeed() {
  try {
    const res = await fetch(`${API_URL}/api/posts`);
    const data = await res.json();
    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    // ✅ Mới nhất trước
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    data.forEach((p) => addPostToFeed(p, false));
  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
  }
}

// ======================
// 🧩 Hàm đăng bài (gọi trực tiếp từ nút trong HTML)
// ======================
async function createPost() {
  const content = document.getElementById("statusInput").value.trim();
  const imageInput = document.getElementById("imageInput");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return alert("Bạn cần đăng nhập để đăng bài!");
  if (!content && !imageInput.files.length)
    return alert("Hãy viết gì đó hoặc chọn ảnh!");

  const formData = new FormData();
  formData.append("content", content);
  formData.append("userId", user._id);
  if (imageInput.files[0]) {
    formData.append("image", imageInput.files[0]);
  }

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      method: "POST",
      body: formData,
    });
    const post = await res.json();

    // ✅ Xóa nội dung nhập
    document.getElementById("statusInput").value = "";
    imageInput.value = "";

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

  const imgPart = post.imageUrl
    ? `<img src="${post.imageUrl}" class="post-img" alt="Ảnh bài viết"/>`
    : "";

  div.innerHTML = `
    <div class="post-header">
      <span class="username">${post.username || "Ẩn danh"}</span>
      <span class="time">${new Date(post.createdAt).toLocaleString()}</span>
    </div>
    <div class="post-content">${post.content || ""}</div>
    ${imgPart}
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

  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight; // auto scroll xuống cuối
}

// ======================
// Gửi tin nhắn realtime
// ======================
function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  const user = JSON.parse(localStorage.getItem("user")) || {
    username: "Ẩn danh",
  };
  const msg = { user: user.username, text };

  socket.emit("chat", msg); // gửi lên server
  addMessageToChat(msg); // hiển thị ngay tại client

  input.value = "";
}

// ======================
// Sự kiện DOM
// ======================
document.addEventListener("DOMContentLoaded", () => {
  loadFeed();

  // Nút gửi chat realtime
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.addEventListener("click", sendMessage);

  // Nhấn Enter để gửi
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }
});
