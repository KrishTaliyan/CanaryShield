import { Router } from "express";
import personas from "../data/personas.js";

const router = Router();

router.get("/", (_request, response) => {
  response.json({ personas });
});

export default router;
