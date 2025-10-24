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
        <img src="${short.userAvatar || 'https://i.pravatar.cc/50'}" class="short-avatar"/>
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
async function loadShorts() {
  const container = document.getElementById("shortsContainer");
  container.innerHTML = "";

  // DEMO dữ liệu tạm
  const shorts = [
    {
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      userName: "alice",
      userAvatar: "https://i.pravatar.cc/150?u=alice",
      likes: 23,
      comments: 5,
    },
    {
      videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
      userName: "bob",
      userAvatar: "https://i.pravatar.cc/150?u=bob",
      likes: 40,
      comments: 8,
    },
    {
      videoUrl: "https://videos.pexels.com/video-files/856846/856846-hd_1920_1080_24fps.mp4",
      userName: "carol",
      userAvatar: "https://i.pravatar.cc/150?u=carol",
      likes: 67,
      comments: 15,
    },
  ];

  shorts.forEach((short) => container.appendChild(createShortItem(short)));

  setupScrollPlayback();
}

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
