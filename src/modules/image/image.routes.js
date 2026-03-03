import express from "express";
import { getSignedImage } from "./image.controller.js";

const router = express.Router();

router.get("/signed-url", getSignedImage);

export default router;