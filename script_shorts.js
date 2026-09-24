// === SHORTS SCRIPT ===
// ZingMini Short Reels Feature (TikTok-style)
// Author: ChatGPT x ZingMini
document.addEventListener("DOMContentLoaded", () => {
  // === NÚT QUAY LẠI HOME ===
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

  // === THEME ===
  const isDark = localStorage.getItem("zingmini_theme") === "dark" || localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark-mode", isDark);

  // === LOAD SHORTS ===
  loadShorts();

  // === SỰ KIỆN TOÀN CỤC ===
  document.addEventListener("click", (e) => {
    // ❤️ LIKE
    const likeButton = e.target.closest(".like-btn");
    if (likeButton) {
      const btn = likeButton;
      const countEl = btn.nextElementSibling;
      let count = parseInt(countEl.textContent) || 0;

      if (btn.classList.toggle("liked")) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 20.3 4.9 13.5A5.2 5.2 0 0 1 12 6.1a5.2 5.2 0 0 1 7.1 7.4z"/></svg>';
        count++;
      } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.8 8.8c0 5-8.8 10.3-8.8 10.3S3.2 13.8 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7z"/></svg>';
        count--;
      }
      countEl.textContent = count;
    }

    // 💬 COMMENT
    if (e.target.closest(".comment-btn")) {
      const popup = document.getElementById("commentPopup");
      const uploadForm = document.getElementById("uploadShortForm");

      if (popup) popup.classList.add("show");
      if (uploadForm) uploadForm.style.display = "none"; // ẩn form upload
    }

    // ↗️ SHARE
    if (e.target.closest(".share-btn")) {
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
          short.userAvatar ||
          short.userId?.avatar ||
          "https://i.pravatar.cc/150?u=guest"
        }" class="short-avatar"/>
        <div class="short-user">@${
          short.userName || short.userId?.username || "Người dùng"
        }</div>
      </div>

      <div class="short-actions">
        <button class="short-btn like-btn" aria-label="Thích"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 8.8c0 5-8.8 10.3-8.8 10.3S3.2 13.8 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7z"/></svg></button>
        <div class="short-count likes">${short.likes || 0}</div>

        <button class="short-btn comment-btn" aria-label="Bình luận"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-4-.9L4 20l1.3-3.4A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5z"/></svg></button>
        <div class="short-count comments">${short.comments || 0}</div>

        <button class="short-btn share-btn" aria-label="Chia sẻ"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17 17 7M9 7h8v8"/></svg></button>
      </div>
    </div>
  `;
  // 🎧 Click video để bật/tắt tiếng
  const video = item.querySelector("video");
  video.addEventListener("click", () => {
    video.muted = !video.muted;
    video.muted
      ? video.setAttribute("title", "Bật tiếng 🔇")
      : video.setAttribute("title", "Tắt tiếng 🔊");
  });

  return item;
}

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

    data.forEach((short) => {
      container.appendChild(createShortItem(short));
    });

    setupScrollPlayback();
  } catch (err) {
    console.error("❌ Lỗi tải shorts:", err);
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
  const fileNameEl = document.getElementById("shortFileName");

  if (!uploadBtn) return;

  if (videoInput && fileNameEl) {
    videoInput.addEventListener("change", () => {
      const file = videoInput.files && videoInput.files[0];
      fileNameEl.textContent = file ? file.name : "Chưa chọn tệp";
      fileNameEl.title = file ? file.name : "";
    });
  }

  uploadBtn.addEventListener("click", async () => {
    const file = videoInput.files[0];
    if (!file) {
      alert("🎥 Vui lòng chọn một video để đăng!");
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    formData.append("description", captionInput.value.trim());

    // ✅ Thêm thông tin user từ localStorage (nếu có)
    const userId = localStorage.getItem("userId");
    const userName = localStorage.getItem("username");
    const userAvatar = localStorage.getItem("avatar");

    if (userId) formData.append("userId", userId);
    if (userName) formData.append("userName", userName);
    if (userAvatar) formData.append("userAvatar", userAvatar);

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
        if (fileNameEl) {
          fileNameEl.textContent = "Chưa chọn tệp";
          fileNameEl.title = "";
        }

        const newItem = createShortItem(data.short);
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
        if (entry.isIntersecting) entry.target.play();
        else entry.target.pause();
      });
    },
    { threshold: 0.6 }
  );
  videos.forEach((video) => observer.observe(video));
}

// === POPUP BÌNH LUẬN (ẨN/HIỆN FORM UPLOAD SHORT) ===
document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("commentPopup");
  const closeBtn = document.getElementById("closeComment");
  const sendBtn = document.getElementById("sendComment");
  const input = document.getElementById("commentInput");
  const list = document.getElementById("commentList");
  const uploadForm = document.getElementById("uploadShortForm");

  if (!popup || !closeBtn || !sendBtn) return;

  closeBtn.addEventListener("click", () => {
    popup.classList.remove("show");
    if (uploadForm) uploadForm.style.removeProperty("display"); // hiện lại form upload
  });

  sendBtn.addEventListener("click", () => {
    if (input.value.trim()) {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = input.value;
      list.appendChild(div);
      input.value = "";
    }
  });
});
