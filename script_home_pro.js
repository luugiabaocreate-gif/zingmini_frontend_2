/* ===== ZINGMINI CHAT v1 — lưu lịch sử MongoDB ===== */
async function loadChatHistory(friendId, bodyEl) {
  try {
    const res = await fetch(`${API_URL}/api/messages/${currentUser._id}/${friendId}`);
    const data = await res.json();
    bodyEl.innerHTML = "";
    data.forEach((m) => {
      const cls = m.from === currentUser._id ? "you" : "them";
      appendChatMessage(bodyEl, cls === "you" ? currentUser.name : "Họ", m.text, cls);
    });
  } catch (err) {
    console.error("Không tải được lịch sử chat:", err);
  }
}
