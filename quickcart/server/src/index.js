import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.listen(port);
