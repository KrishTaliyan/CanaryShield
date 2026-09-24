import cors from "cors";
import express from "express";
import config from "./config.js";
import personasRouter from "./routes/personas.js";
import productsRouter from "./routes/products.js";

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.use("/api/products", productsRouter);
app.use("/api/personas", personasRouter);

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.listen(config.port);
