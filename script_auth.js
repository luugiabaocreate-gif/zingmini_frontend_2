// ===================== script_auth.js =====================

// Lấy DOM
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const toggleForms = document.getElementById("toggle-forms");

// Chuyển giữa login và register
toggleForms.addEventListener("click", () => {
  loginForm.classList.toggle("hidden");
  registerForm.classList.toggle("hidden");
});

// Demo lưu user trong localStorage
function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "[]");
}

function saveUser(user) {
  const users = getUsers();
  users.push(user);
  localStorage.setItem("users", JSON.stringify(users));
}

// ===================== REGISTER =====================
registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;

  if (!username || !password) {
    alert("Vui lòng điền đầy đủ thông tin!");
    return;
  }

  const users = getUsers();
  if (users.find((u) => u.username === username)) {
    alert("Tên đăng nhập đã tồn tại!");
    return;
  }

  saveUser({ username, password });
  alert("Đăng ký thành công! Bạn có thể đăng nhập ngay.");
  registerForm.reset();
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});

// ===================== LOGIN =====================
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  const users = getUsers();
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
    window.location.href = "home.html";
  } else {
    alert("Tên đăng nhập hoặc mật khẩu không đúng!");
  }
});
