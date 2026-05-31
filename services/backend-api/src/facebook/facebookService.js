const axios = require("axios");
const logger = require("../../../../shared/logger")("facebook-service");

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
    const startTime = Date.now();
    const cleanParams = { ...params };
    logger.info(`GET ${path} | Params: ${JSON.stringify(cleanParams)}`);

    try {
      const response = await this.client.get(path, {
        params: {
          ...params,
          access_token: this.pageAccessToken,
        },
      });
      const latency = Date.now() - startTime;
      logger.success(`GET ${path} | Status: ${response.status} | Latency: ${latency}ms`);
      return response.data;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || "N/A";
      logger.error(`GET ${path} | Code: ${errorCode} | Latency: ${latency}ms | Error: "${errorMsg}"`);
      throw error;
    }
  }

  async post(path, data = {}, params = {}) {
    const startTime = Date.now();
    const cleanData = { ...data };
    logger.info(`POST ${path} | Data: ${JSON.stringify(cleanData)} | Params: ${JSON.stringify(params)}`);

    try {
      const response = await this.client.post(path, null, {
        params: {
          ...data,
          ...params,
          access_token: this.pageAccessToken,
        },
      });
      const latency = Date.now() - startTime;
      logger.success(`POST ${path} | Status: ${response.status} | Latency: ${latency}ms`);
      return response.data;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || "N/A";
      logger.error(`POST ${path} | Code: ${errorCode} | Latency: ${latency}ms | Error: "${errorMsg}"`);
      throw error;
    }
  }

  async delete(path, params = {}) {
    const startTime = Date.now();
    logger.info(`DELETE ${path} | Params: ${JSON.stringify(params)}`);

    try {
      const response = await this.client.delete(path, {
        params: {
          ...params,
          access_token: this.pageAccessToken,
        },
      });
      const latency = Date.now() - startTime;
      logger.success(`DELETE ${path} | Status: ${response.status} | Latency: ${latency}ms`);
      return response.data;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code || "N/A";
      logger.error(`DELETE ${path} | Code: ${errorCode} | Latency: ${latency}ms | Error: "${errorMsg}"`);
      throw error;
    }
  }

  async hideComment(commentId) {
    const startTime = Date.now();
    logger.info(`Hiding spam comment ID: ${commentId}`);
    try {
      const response = await this.client.post(`/${commentId}`, null, {
        params: {
          is_hidden: true,
          access_token: this.pageAccessToken,
        },
      });
      const latency = Date.now() - startTime;
      logger.success(`Comment ${commentId} hidden successfully | Latency: ${latency}ms`);
      return response.data;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to hide comment ${commentId} | Latency: ${latency}ms | Error: "${errorMsg}"`);
      throw error;
    }
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

  async createCommentReply(commentId, message) {
    return this.post(`/${commentId}/comments`, { message });
  }

  async sendPrivateMessage(recipientId, messageText) {
    return this.post(`/me/messages`, {
      recipient: JSON.stringify({ id: recipientId }),
      message: JSON.stringify({ text: messageText }),
    });
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
