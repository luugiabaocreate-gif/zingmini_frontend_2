// ===================== script_home_pro.js =====================

// Kiểm tra user đã login chưa
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
if (!currentUser) {
  window.location.href = "index.html";
}

// ===================== FEED =====================
// Thêm username vào bài viết (nếu muốn)
document.querySelectorAll(".post-card .username").forEach((el) => {
  el.innerText += ` (${currentUser.username})`;
});

// Like/Comment demo
document.querySelectorAll(".post-actions button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.innerText === "Like") {
      btn.style.color = "#0ff";
    } else if (btn.innerText === "Comment") {
      const comment = prompt("Nhập bình luận của bạn:");
      if (comment) {
        alert(`Bạn đã bình luận: ${comment}`);
      }
    } else if (btn.innerText === "Share") {
      alert("Đã share bài viết!");
    }
  });
});

// ===================== CHAT REALTIME DEMO =====================
const chatBox = document.getElementById("chat-box");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatClose = document.getElementById("chat-close");

// Đóng/Mở chat
chatClose.addEventListener("click", () => {
  chatBox.style.display = "none";
});
chatBox.addEventListener("click", () => {
  chatBox.style.display = "flex";
});

// Gửi tin nhắn
chatSend.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg) return;

  // Thêm tin nhắn của user vào chat box
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerText = `${currentUser.username}: ${msg}`;
  chatMessages.appendChild(div);

  chatInput.value = "";
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Demo bot trả lời
  setTimeout(() => {
    const botDiv = document.createElement("div");
    botDiv.classList.add("message");
    botDiv.innerText = `ZingMini Bot: Bạn vừa gửi "${msg}"`;
    chatMessages.appendChild(botDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 1000);
}
