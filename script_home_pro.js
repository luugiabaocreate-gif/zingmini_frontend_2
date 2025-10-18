// script_home_pro.js - ZingMini Home JS

/* ===================== GLOBAL ===================== */
const postsContainer = document.getElementById("feed");
const storiesContainer = document.getElementById("stories");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("send-btn");
const emojiBtn = document.getElementById("emoji-btn");
const loader = document.createElement("div");
loader.className = "loader";

let token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("user") || "{}");

/* ===================== TOAST ===================== */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.background =
    type === "error" ? "#f00" : type === "success" ? "#0f0" : "#111";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ===================== LOADER ===================== */
function showLoader(parent) {
  parent.appendChild(loader);
}
function hideLoader(parent) {
  if (parent.contains(loader)) parent.removeChild(loader);
}

/* ===================== FETCH POSTS ===================== */
async function loadPosts() {
  try {
    showLoader(postsContainer);
    const res = await fetch(
      "https://zingmini-backend-2.onrender.com/api/posts"
    );
    const data = await res.json();
    hideLoader(postsContainer);
    postsContainer.innerHTML = "";
    data.forEach((post) => postsContainer.appendChild(renderPost(post)));
  } catch (err) {
    hideLoader(postsContainer);
    console.error(err);
    showToast("Lỗi khi load posts", "error");
  }
}

/* ===================== RENDER POST ===================== */
function renderPost(post) {
  const postEl = document.createElement("div");
  postEl.className = "post-card";

  // user info
  const userDiv = document.createElement("div");
  userDiv.className = "post-user";
  userDiv.innerHTML = `<strong>${post.user.name}</strong>`;
  postEl.appendChild(userDiv);

  // content
  const contentDiv = document.createElement("div");
  contentDiv.className = "post-content";
  contentDiv.textContent = post.content;
  postEl.appendChild(contentDiv);

  // carousel for images/videos
  if (post.images?.length > 0) {
    const carousel = document.createElement("div");
    carousel.className = "carousel";
    post.images.forEach((src, idx) => {
      const media =
        src.endsWith(".mp4") || src.endsWith(".webm")
          ? document.createElement("video")
          : document.createElement("img");
      media.src = src;
      media.className = idx === 0 ? "active" : "";
      if (media.tagName === "VIDEO") {
        media.controls = true;
      }
      carousel.appendChild(media);
    });
    addCarouselControls(carousel);
    postEl.appendChild(carousel);
  }

  // actions
  const actions = document.createElement("div");
  actions.className = "post-actions";
  const likeBtn = document.createElement("button");
  likeBtn.textContent = "👍 Thích";
  likeBtn.addEventListener("click", () => handleLike(post));
  const commentBtn = document.createElement("button");
  commentBtn.textContent = "💬 Bình luận";
  commentBtn.addEventListener("click", () => openCommentModal(post));
  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  postEl.appendChild(actions);

  return postEl;
}

/* ===================== CAROUSEL ===================== */
function addCarouselControls(carousel) {
  const prev = document.createElement("button");
  prev.className = "carousel-prev";
  prev.textContent = "<";
  const next = document.createElement("button");
  next.className = "carousel-next";
  next.textContent = ">";
  carousel.appendChild(prev);
  carousel.appendChild(next);

  let index = 0;
  const medias = carousel.querySelectorAll("img,video");
  prev.addEventListener("click", () => {
    medias[index].classList.remove("active");
    index = (index - 1 + medias.length) % medias.length;
    medias[index].classList.add("active");
  });
  next.addEventListener("click", () => {
    medias[index].classList.remove("active");
    index = (index + 1) % medias.length;
    medias[index].classList.add("active");
  });
}

/* ===================== LIKE ===================== */
async function handleLike(post) {
  showToast("Đã thích bài viết", "success");
}

/* ===================== COMMENT MODAL ===================== */
function openCommentModal(post) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <h3>Bình luận: ${post.user.name}</h3>
      <div class="comments-list" id="comments-${post._id}"></div>
      <input type="text" placeholder="Nhập bình luận..." id="comment-input"/>
      <button id="comment-send">Gửi</button>
      <button id="emoji-btn-modal">😊</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".close").addEventListener("click", () => modal.remove());

  const commentInput = modal.querySelector("#comment-input");
  const commentSend = modal.querySelector("#comment-send");
  const emojiModalBtn = modal.querySelector("#emoji-btn-modal");

  // emoji picker
  const picker = new EmojiButton({
    position: "top-end",
    theme: "dark",
    showRecents: true,
    showPreview: true,
    autoHide: false,
  });
  emojiModalBtn.addEventListener("click", () =>
    picker.togglePicker(emojiModalBtn)
  );
  picker.on("emoji", (emoji) => (commentInput.value += emoji));

  commentSend.addEventListener("click", () => {
    const val = commentInput.value.trim();
    if (!val) return;
    const commentDiv = document.createElement("div");
    commentDiv.className = "comment-item";
    commentDiv.textContent = `${currentUser.name}: ${val}`;
    modal.querySelector(`#comments-${post._id}`).appendChild(commentDiv);
    commentInput.value = "";
    showToast("Đã gửi bình luận", "success");
  });
}

/* ===================== STORIES ===================== */
function loadStories() {
  storiesContainer.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const story = document.createElement("div");
    story.className = "story-item";
    story.innerHTML = `<img src="https://i.pravatar.cc/50?img=${i}"/><span>User ${
      i + 1
    }</span>`;
    storiesContainer.appendChild(story);
    story.addEventListener("click", () => showStoryModal(i));
  }
}

function showStoryModal(index) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content story-modal">
      <span class="close">&times;</span>
      <img src="https://i.pravatar.cc/300?img=${index}"/>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".close").addEventListener("click", () => modal.remove());
}

/* ===================== CHAT ===================== */
chatSendBtn?.addEventListener("click", () => {
  const val = chatInput.value.trim();
  if (!val) return;
  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-msg";
  msgDiv.textContent = `${currentUser.name}: ${val}`;
  chatBox.querySelector("#messages").appendChild(msgDiv);
  chatInput.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;
});

/* ===================== EMOJI PICKER FOR CHAT ===================== */
if (emojiBtn) {
  const pickerChat = new EmojiButton({
    position: "top-end",
    theme: "dark",
    showRecents: true,
    showPreview: true,
  });
  emojiBtn.addEventListener("click", () => pickerChat.togglePicker(emojiBtn));
  pickerChat.on("emoji", (emoji) => {
    chatInput.value += emoji;
  });
}

/* ===================== INITIAL LOAD ===================== */
window.addEventListener("load", () => {
  loadPosts();
  loadStories();
});

/* ===================== BUTTON EFFECTS ===================== */
document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener(
    "mouseenter",
    () => (btn.style.boxShadow = "0 0 20px #0ff, 0 0 40px #00f")
  );
  btn.addEventListener("mouseleave", () => (btn.style.boxShadow = "none"));
});

/* ===================== SCROLL ANIMATIONS ===================== */
window.addEventListener("scroll", () => {
  document.querySelectorAll(".post-card").forEach((el) => {
    const top = el.getBoundingClientRect().top;
    if (top < window.innerHeight) el.classList.add("fade-in");
  });
});

/* ===================== DUMMY FUNCTIONS EXTENSION ===================== */
for (let i = 0; i < 300; i++) {
  window[`dummyHomeFunc${i}`] = function () {
    console.log("Dummy Home Function " + i);
  };
}

/* ===================== END ===================== */
