const API_URL = "https://zingmini-backend-2.onrender.com";

async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}/api/products`);
    const products = await res.json();

    const container = document.getElementById("productList");
    container.innerHTML = "";

    products.forEach(p => {
      const div = document.createElement("div");
      div.className = "product-card";
      div.innerHTML = `
        <img src="${p.image || "https://via.placeholder.com/200"}" alt="">
        <h3>${p.name}</h3>
        <p>${p.description || ""}</p>
        <p><b>${p.price.toLocaleString()}đ</b></p>
        <button onclick="buyProduct('${p._id}')">Mua ngay</button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

async function buyProduct(id) {
  const buyerName = prompt("Nhập tên của bạn:");
  if (!buyerName) return;

  const order = {
    buyerName,
    products: [{ product: id, quantity: 1 }],
    total: 0,
    address: "Chưa cập nhật",
    phone: "0000000000"
  };

  const res = await fetch(`${API_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });
  if (res.ok) alert("Đã đặt hàng thành công! Thanh toán khi nhận hàng.");
}

loadProducts();
