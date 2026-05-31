const express = require("express");
const FacebookService = require("../facebook/facebookService");
const { adminOnly } = require("../middleware/auth");

const router = express.Router();

function getFacebookService() {
  return new FacebookService();
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

router.get("/page/:pageId", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const data = await facebookService.getPage(req.params.pageId);
    return res.json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

router.get("/page/:pageId/posts", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const limit = toInt(req.query.limit, 10);
    const data = await facebookService.getPagePosts(req.params.pageId, limit);
    return res.json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

router.post("/page/:pageId/posts", adminOnly, async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ 
        status: "error",
        code: "bad_request",
        message: "message is required and must be a string" 
      });
    }

    const data = await facebookService.createPost(req.params.pageId, message);
    return res.status(201).json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

router.delete("/page/post/:postId", adminOnly, async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const data = await facebookService.deletePost(req.params.postId);
    return res.json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

router.get("/page/post/:postId/comments", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const limit = toInt(req.query.limit, 10);
    const data = await facebookService.getPostComments(req.params.postId, limit);
    return res.json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

router.get("/page/post/:postId/likes", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const limit = toInt(req.query.limit, 25);
    const data = await facebookService.getPostLikes(req.params.postId, limit);
    return res.json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

router.get("/page/:pageId/insights", adminOnly, async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const defaultMetrics = [
      "page_impressions",
      "page_engaged_users",
      "page_post_engagements",
      "page_fans",
    ];

    const metrics = req.query.metrics
      ? String(req.query.metrics)
      : defaultMetrics.join(",");

    const data = await facebookService.getPageInsights(req.params.pageId, metrics);
    return res.json(data);
  } catch (error) {
    const { status, payload } = formatError(error);
    return res.status(status).json(payload);
  }
});

function formatError(error) {
  const metaError = error.response?.data?.error;
  let status = 500;
  let code = "facebook_api_error";
  let message = "Có lỗi xảy ra khi giao tiếp với Facebook Graph API.";

  if (metaError) {
    const fbCode = metaError.code;
    const fbSubcode = metaError.error_subcode;

    if (fbCode === 190 || fbCode === 102 || metaError.type === "OAuthException") {
      status = 401;
      code = "unauthorized";
      message = "Mã truy cập Facebook Page Token đã hết hạn hoặc không hợp lệ. Vui lòng cập nhật cấu hình hệ thống.";
    }
    else if (fbCode === 10 || fbCode === 200 || fbCode === 283) {
      status = 403;
      code = "forbidden";
      message = "Tài khoản không đủ quyền thực hiện hành động này trên Facebook Page.";
    }
    else if (fbCode === 100 || fbCode === 803) {
      status = 404;
      code = "not_found";
      message = "Không tìm thấy đối tượng hoặc tài nguyên yêu cầu trên Facebook.";
    }
    else if (fbCode === 4 || fbCode === 17 || fbCode === 32) {
      status = 429;
      code = "rate_limit_exceeded";
      message = "Hệ thống đã đạt giới hạn cuộc gọi đến Facebook API. Vui lòng thử lại sau.";
    }

    return {
      status,
      payload: {
        status: "error",
        code,
        message,
        facebook_detail: {
          message: metaError.message,
          type: metaError.type,
          code: fbCode,
          error_subcode: fbSubcode,
          fbtrace_id: metaError.fbtrace_id,
        }
      }
    };
  }

  return {
    status: 500,
    payload: {
      status: "error",
      code: "internal_server_error",
      message: error.message || "Lỗi hệ thống không mong muốn."
    }
  };
}

module.exports = router;
