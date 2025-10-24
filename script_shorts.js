const container = document.getElementById("shorts-container");

async function loadShorts() {
  try {
    const res = await fetch("https://zingmini-backend.onrender.com/api/posts/shorts"); 
    const shorts = await res.json();

    shorts.forEach(short => {
      const item = document.createElement("div");
      item.className = "short-item";

      const video = document.createElement("video");
      video.src = short.videoUrl;
      video.controls = false;
      video.autoplay = false;
      video.loop = true;
      video.muted = true;

      item.appendChild(video);
      container.appendChild(item);
    });

    setupScrollPlayback();
  } catch (err) {
    console.error("Lỗi tải shorts:", err);
  }
}

function setupScrollPlayback() {
  const videos = document.querySelectorAll("video");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.play();
      } else {
        entry.target.pause();
      }
    });
  }, { threshold: 0.6 });

  videos.forEach(v => observer.observe(v));
}

document.getElementById("back-home").onclick = () => {
  window.location.href = "home.html";
};

loadShorts();
