const express = require("express");
const FacebookService = require("../services/facebookService");

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
    return res.status(500).json(formatError(error));
  }
});

router.get("/page/:pageId/posts", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const limit = toInt(req.query.limit, 10);
    const data = await facebookService.getPagePosts(req.params.pageId, limit);
    return res.json(data);
  } catch (error) {
    return res.status(500).json(formatError(error));
  }
});

router.post("/page/:pageId/posts", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required and must be a string" });
    }

    const data = await facebookService.createPost(req.params.pageId, message);
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json(formatError(error));
  }
});

router.delete("/page/post/:postId", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const data = await facebookService.deletePost(req.params.postId);
    return res.json(data);
  } catch (error) {
    return res.status(500).json(formatError(error));
  }
});

router.get("/page/post/:postId/comments", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const limit = toInt(req.query.limit, 10);
    const data = await facebookService.getPostComments(req.params.postId, limit);
    return res.json(data);
  } catch (error) {
    return res.status(500).json(formatError(error));
  }
});

router.get("/page/post/:postId/likes", async (req, res) => {
  try {
    const facebookService = getFacebookService();
    const limit = toInt(req.query.limit, 25);
    const data = await facebookService.getPostLikes(req.params.postId, limit);
    return res.json(data);
  } catch (error) {
    return res.status(500).json(formatError(error));
  }
});

router.get("/page/:pageId/insights", async (req, res) => {
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
    return res.status(500).json(formatError(error));
  }
});

function formatError(error) {
  const metaError = error.response?.data?.error;

  return {
    message: metaError?.message || error.message || "Unexpected error",
    type: metaError?.type,
    code: metaError?.code,
    subcode: metaError?.error_subcode,
    fbtrace_id: metaError?.fbtrace_id,
  };
}

module.exports = router;
