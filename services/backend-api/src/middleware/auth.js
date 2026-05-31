require("dotenv").config();

function adminOnly(req, res, next) {
  const authHeader = req.headers["authorization"];
  const adminToken = process.env.ADMIN_TOKEN || "admin_thanhngan_123";

  if (!authHeader) {
    console.warn(`[Auth Middleware] [BLOCKED] Unauthorized request: Missing authorization header.`);
    return res.status(401).json({
      status: "error",
      code: "unauthorized",
      message: "Không tìm thấy token xác thực. Vui lòng cung cấp mã xác thực admin trong header Authorization.",
    });
  }

  // Parse Bearer Token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    console.warn(`[Auth Middleware] [BLOCKED] Unauthorized request: Invalid header format.`);
    return res.status(401).json({
      status: "error",
      code: "unauthorized",
      message: "Định dạng header xác thực không hợp lệ. Vui lòng dùng định dạng: Bearer <token>",
    });
  }

  const token = parts[1];

  if (token !== adminToken) {
    console.warn(`[Auth Middleware] [BLOCKED] Forbidden access attempt with token: ${token.slice(0, 4)}***`);
    return res.status(403).json({
      status: "error",
      code: "forbidden",
      message: "Quyền truy cập bị từ chối: Chỉ quản trị viên mới được phép thực hiện hành động này.",
    });
  }

  // Admin verified successfully
  console.log(`[Auth Middleware] [SUCCESS] Admin access granted for request: ${req.method} ${req.originalUrl}`);
  next();
}

module.exports = {
  adminOnly,
};
