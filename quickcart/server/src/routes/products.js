import { Router } from "express";
import products from "../data/products.js";

const router = Router();

router.get("/", (_request, response) => {
  response.json({ products });
});

export default router;
