import { generateSignedUrl } from "./image.service.js";

export const getSignedImage = async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ message: "Image key required" });
    }

    const url = await generateSignedUrl(key);

    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate signed URL" });
  }
};