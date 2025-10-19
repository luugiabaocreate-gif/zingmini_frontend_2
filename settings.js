const notifEl = document.getElementById("toggle-notif");
const fullEl = document.getElementById("toggle-fullname");
const saveBtn = document.getElementById("save-settings");

// load
notifEl.checked = localStorage.getItem("zm_notif") === "1";
fullEl.checked = localStorage.getItem("zm_fullname") === "1";

saveBtn.addEventListener("click", () => {
  localStorage.setItem("zm_notif", notifEl.checked ? "1" : "0");
  localStorage.setItem("zm_fullname", fullEl.checked ? "1" : "0");
  alert("Đã lưu cài đặt");
});
