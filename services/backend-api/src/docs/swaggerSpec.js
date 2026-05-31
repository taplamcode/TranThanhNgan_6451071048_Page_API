const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Page API",
    description: "Endpoints cho Page Graph API (/{page-id}/...)",
    version: "1.0.0",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local server",
    },
  ],
  tags: [
    {
      name: "Page API",
      description: "Các endpoint Facebook Page Graph API",
    },
  ],
  paths: {
    "/api/page/{pageId}": {
      get: {
        tags: ["Page API"],
        summary: "Lấy thông tin Page",
        parameters: [
          {
            in: "path",
            name: "pageId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Success" },
          500: { description: "Meta API error" },
        },
      },
    },
    "/api/page/{pageId}/posts": {
      get: {
        tags: ["Page API"],
        summary: "Lấy danh sách bài viết của Page",
        parameters: [
          {
            in: "path",
            name: "pageId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          200: { description: "Success" },
          500: { description: "Meta API error" },
        },
      },
      post: {
        tags: ["Page API"],
        summary: "Đăng bài mới lên Page (Yêu cầu Admin Token)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "pageId",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: {
                    type: "string",
                    example: "Hello from API",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created" },
          400: { description: "Invalid payload" },
          401: { description: "Unauthorized" },
          500: { description: "Meta API error" },
        },
      },
    },
    "/api/page/post/{postId}": {
      delete: {
        tags: ["Page API"],
        summary: "Xóa bài viết (Yêu cầu Admin Token)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "postId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Deleted" },
          401: { description: "Unauthorized" },
          500: { description: "Meta API error" },
        },
      },
    },
    "/api/page/post/{postId}/comments": {
      get: {
        tags: ["Page API"],
        summary: "Lấy comments của bài viết",
        parameters: [
          {
            in: "path",
            name: "postId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          200: { description: "Success" },
          500: { description: "Meta API error" },
        },
      },
    },
    "/api/page/post/{postId}/likes": {
      get: {
        tags: ["Page API"],
        summary: "Lấy likes của bài viết",
        parameters: [
          {
            in: "path",
            name: "postId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", default: 25 },
          },
        ],
        responses: {
          200: { description: "Success" },
          500: { description: "Meta API error" },
        },
      },
    },
    "/api/page/{pageId}/insights": {
      get: {
        tags: ["Page API"],
        summary: "Lấy page insights (Yêu cầu Admin Token)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "pageId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "metrics",
            required: false,
            schema: {
              type: "string",
              example: "page_impressions,page_engaged_users,page_post_engagements,page_fans",
            },
          },
        ],
        responses: {
          200: { description: "Success" },
          401: { description: "Unauthorized" },
          500: { description: "Meta API error" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

module.exports = swaggerSpec;
