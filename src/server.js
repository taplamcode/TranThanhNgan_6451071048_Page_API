require("dotenv").config();

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const pageRoutes = require("./routes/pageRoutes");
const swaggerSpec = require("./docs/swaggerSpec");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({ status: "ok" });
});

app.get("/api-docs.json", (req, res) => {
  return res.json(swaggerSpec);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Page API Docs",
    explorer: true,
  })
);

app.use("/api", pageRoutes);

app.use((req, res) => {
  return res.status(404).json({ message: "Không tìm thấy endpoint" });
});

app.listen(port, () => {
  // Log đơn giản để xác nhận server đã chạy.
  console.log(`Server is running at http://localhost:${port}`);
});
