const container = document.getElementById("shorts-container");

async function loadShorts() {
  try {
    const shorts = [
      { videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
      { videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" },
      { videoUrl: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4" },
    ];

    shorts.forEach((short) => {
      const item = document.createElement("div");
      item.className = "short-item";

      const video = document.createElement("video");
      video.src = short.videoUrl;
      video.controls = false;
      video.autoplay = true;
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

  videos.forEach((v) => observer.observe(v));
}

document.getElementById("back-home").onclick = () => {
  window.location.href = "home.html";
};

loadShorts();
