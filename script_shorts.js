// === SHORTS SCRIPT ===
// ZingMini Short Reels Feature (TikTok-style)
// Author: ChatGPT x ZingMini
// === NÚT QUAY LẠI HOME ===
document.addEventListener("DOMContentLoaded", () => {
  // Nếu chưa có nút back-home thì thêm vào
  if (!document.querySelector(".back-home")) {
    const backBtn = document.createElement("button");
    backBtn.className = "back-home";
    backBtn.innerHTML = "🏠";
    backBtn.title = "Quay lại Home";
    backBtn.addEventListener("click", () => {
      window.location.href = "home.html";
    });
    document.body.appendChild(backBtn);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("shortsContainer");
  if (!container) return;

  // Load theme từ localStorage (theo home)
  const isDark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark-mode", isDark);

  loadShorts();

  // === Xử lý click tương tác toàn cục ===
  document.addEventListener("click", (e) => {
    // ❤️ LIKE
    if (e.target.classList.contains("like-btn")) {
      const btn = e.target;
      const countEl = btn.nextElementSibling;
      let count = parseInt(countEl.textContent) || 0;

      if (btn.classList.toggle("liked")) {
        btn.textContent = "❤️";
        count++;
      } else {
        btn.textContent = "🤍";
        count--;
      }
      countEl.textContent = count;
    }

    // 💬 COMMENT
    if (e.target.classList.contains("comment-btn")) {
      alert("💬 Mở khung bình luận (sẽ nối API sau)");
    }

    // ↗️ SHARE
    if (e.target.classList.contains("share-btn")) {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => alert("🔗 Link short đã được sao chép!"));
    }
  });
});

// === TẠO ITEM SHORT ===
function createShortItem(short) {
  const item = document.createElement("div");
  item.className = "short-item";
  item.innerHTML = `
    <video src="${short.videoUrl}" muted autoplay loop playsinline></video>

    <div class="short-overlay">
      <div class="short-info">
        <img src="${
          short.userAvatar || "https://i.pravatar.cc/50"
        }" class="short-avatar"/>
        <div class="short-user">@${short.userName || "Ẩn danh"}</div>
      </div>

      <div class="short-actions">
        <button class="short-btn like-btn">🤍</button>
        <div class="short-count likes">${short.likes || 0}</div>

        <button class="short-btn comment-btn">💬</button>
        <div class="short-count comments">${short.comments || 0}</div>

        <button class="short-btn share-btn">↗️</button>
      </div>
    </div>
  `;
  return item;
}

// === TẢI SHORTS DEMO ===
// === TẢI SHORTS TỪ BACKEND ===
async function loadShorts() {
  const container = document.getElementById("shortsContainer");
  container.innerHTML = `<div class="loading">⏳ Đang tải video...</div>`;

  try {
    const res = await fetch(
      "https://zingmini-backend-2.onrender.com/api/getShorts"
    );
    const data = await res.json();

    container.innerHTML = "";

    if (!Array.isArray(data) || !data.length) {
      container.innerHTML =
        "<p class='no-shorts'>Chưa có video nào được đăng.</p>";
      return;
    }

    data.forEach((short) => container.appendChild(createShortItem(short)));
    setupScrollPlayback();
  } catch (err) {
    console.error("Lỗi tải shorts:", err);
    container.innerHTML = "<p class='error'>❌ Không thể tải video!</p>";
  }
}

// === UPLOAD SHORT FUNCTIONALITY ===
document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadShortBtn");
  const videoInput = document.getElementById("shortVideoInput");
  const captionInput = document.getElementById("shortCaption");
  const statusEl = document.getElementById("uploadStatus");
  const container = document.getElementById("shortsContainer");

  if (!uploadBtn) return;

  uploadBtn.addEventListener("click", async () => {
    const file = videoInput.files[0];
    if (!file) {
      alert("🎥 Vui lòng chọn một video để đăng!");
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    formData.append("caption", captionInput.value.trim());
    // TODO: nếu bạn có auth: formData.append("userId", userId);

    statusEl.textContent = "⏳ Đang tải video lên...";
    uploadBtn.disabled = true;

    try {
      const res = await fetch(
        "https://zingmini-backend-2.onrender.com/api/uploadShort",
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();

      if (data && data.success && data.short && data.short.videoUrl) {
        statusEl.textContent = "✅ Đăng short thành công!";
        captionInput.value = "";
        videoInput.value = "";

        // Lấy short thật từ phản hồi backend
        const newItem = createShortItem({
          videoUrl: data.short.videoUrl,
          userName: "Ẩn danh",
          userAvatar: "https://i.pravatar.cc/150?u=guest",
          likes: 0,
          comments: 0,
        });

        container.prepend(newItem);
      } else {
        statusEl.textContent = "❌ Lỗi khi đăng short.";
        console.error("Upload short lỗi:", data);
      }
    } catch (err) {
      console.error("Lỗi upload short:", err);
      statusEl.textContent = "❌ Upload thất bại.";
    } finally {
      uploadBtn.disabled = false;
      setTimeout(() => (statusEl.textContent = ""), 3000);
    }
  });
});

// === CHẠY TỰ ĐỘNG VIDEO NÀO Ở TRONG KHUNG ===
function setupScrollPlayback() {
  const videos = document.querySelectorAll(".short-item video");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.play();
        } else {
          entry.target.pause();
        }
      });
    },
    { threshold: 0.6 }
  );

  videos.forEach((video) => observer.observe(video));
}
