const API_URL = "https://zingmini-backend-2.onrender.com";

async function loadSellerProducts() {
  const res = await fetch(`${API_URL}/api/products`);
  const data = await res.json();
  const list = document.getElementById("sellerProducts");
  list.innerHTML = "";

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "product-card";
    div.innerHTML = `
      <img src="${p.image || "https://via.placeholder.com/200"}">
      <h3>${p.name}</h3>
      <p>${p.price.toLocaleString()}đ</p>
      <button onclick="deleteProduct('${p._id}')">Xóa</button>
    `;
    list.appendChild(div);
  });
}

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    name: name.value,
    description: description.value,
    price: price.value,
    stock: stock.value,
    category: category.value,
    image: image.value,
    seller: "66f2example00000000000000"
  };

  const res = await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    alert("Đã đăng sản phẩm!");
    e.target.reset();
    loadSellerProducts();
  } else alert("Lỗi khi đăng!");
});

async function deleteProduct(id) {
  if (!confirm("Xóa sản phẩm này?")) return;
  const res = await fetch(`${API_URL}/api/products/${id}`, { method: "DELETE" });
  if (res.ok) loadSellerProducts();
}

loadSellerProducts();
