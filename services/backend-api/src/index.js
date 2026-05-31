require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const pageRoutes = require("./routes/pageRoutes");
const swaggerSpec = require("./docs/swaggerSpec");
const backendConsumer = require("./backendConsumer");
const logger = require("../../../shared/logger")("backend-api");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({ status: "ok", service: "backend-api" });
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

const server = app.listen(port, () => {
  logger.success(`Backend REST API proxy running at http://localhost:${port}`);
  logger.success(`Swagger documentation available at http://localhost:${port}/docs`);
  
  // Launch the background Kafka consumer loop
  backendConsumer.start();
});
