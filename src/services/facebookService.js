const axios = require("axios");

class FacebookService {
  constructor() {
    this.apiVersion = process.env.GRAPH_API_VERSION || "v23.0";
    this.pageAccessToken = process.env.PAGE_ACCESS_TOKEN;
    this.pageId = process.env.PAGE_ID;

    if (!this.pageAccessToken) {
      throw new Error("Missing PAGE_ACCESS_TOKEN in environment variables.");
    }

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}`,
      timeout: 15000,
    });
  }

  async get(path, params = {}) {
    const response = await this.client.get(path, {
      params: {
        ...params,
        access_token: this.pageAccessToken,
      },
    });
    return response.data;
  }

  async post(path, data = {}, params = {}) {
    const response = await this.client.post(path, null, {
      params: {
        ...data,
        ...params,
        access_token: this.pageAccessToken,
      },
    });
    return response.data;
  }

  async delete(path, params = {}) {
    const response = await this.client.delete(path, {
      params: {
        ...params,
        access_token: this.pageAccessToken,
      },
    });
    return response.data;
  }

  async getPage(pageId) {
    const preferredFields = "id,name,about,fan_count,followers_count,link,picture{url}";
    const fallbackFields = "id,name,about,link,picture{url}";

    try {
      return await this.get(`/${pageId}`, {
        fields: preferredFields,
      });
    } catch (error) {
      const code = error.response?.data?.error?.code;
      const message = String(error.response?.data?.error?.message || "");

      // Trường hợp object không có fan_count/followers_count thì thử lại với fields cơ bản.
      if (code === 100 && message.includes("nonexisting field")) {
        return this.get(`/${pageId}`, {
          fields: fallbackFields,
        });
      }

      throw error;
    }
  }

  async getPagePosts(pageId, limit = 10) {
    return this.get(`/${pageId}/posts`, {
      limit,
      fields: "id,message,created_time,permalink_url,full_picture",
    });
  }

  async createPost(pageId, message) {
    return this.post(`/${pageId}/feed`, { message });
  }

  async deletePost(postId) {
    try {
      return await this.delete(`/${postId}`);
    } catch (error) {
      const metaError = error.response?.data?.error;
      const code = metaError?.code;
      const message = String(metaError?.message || "").toLowerCase();
      const hasCompositeId = String(postId).includes("_");

      if (!hasCompositeId && this.pageId && (code === 12 || message.includes("statuses api is deprecated"))) {
        const compositePostId = `${this.pageId}_${postId}`;
        return this.delete(`/${compositePostId}`);
      }

      throw error;
    }
  }

  async getPostComments(postId, limit = 10) {
    return this.get(`/${postId}/comments`, {
      limit,
      fields: "id,from,message,created_time,like_count",
    });
  }

  async getPostLikes(postId, limit = 25) {
    return this.get(`/${postId}/likes`, {
      limit,
      summary: true,
    });
  }

  async getPageInsights(pageId, metrics) {
    try {
      return await this.get(`/${pageId}/insights`, {
        metric: metrics,
        period: "day",
      });
    } catch (error) {
      const metaError = error.response?.data?.error;
      const code = metaError?.code;
      const message = String(metaError?.message || "").toLowerCase();

      if (code !== 100 || !message.includes("valid insights metric")) {
        throw error;
      }

      const requestedMetrics = String(metrics || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (requestedMetrics.length === 0) {
        throw error;
      }

      const data = [];
      const invalidMetrics = [];

      // Fallback: gọi từng metric để tránh fail toàn bộ khi có metric không còn hỗ trợ.
      for (const metric of requestedMetrics) {
        try {
          const metricResult = await this.get(`/${pageId}/insights`, {
            metric,
            period: "day",
          });

          if (Array.isArray(metricResult?.data)) {
            data.push(...metricResult.data);
          }
        } catch (metricError) {
          const metricCode = metricError.response?.data?.error?.code;
          const metricMessage = String(metricError.response?.data?.error?.message || "").toLowerCase();

          if (metricCode === 100 && metricMessage.includes("valid insights metric")) {
            invalidMetrics.push(metric);
            continue;
          }

          throw metricError;
        }
      }

      if (data.length === 0) {
        throw error;
      }

      return {
        data,
        invalid_metrics: invalidMetrics,
        partial: invalidMetrics.length > 0,
      };
    }
  }
}

module.exports = FacebookService;
