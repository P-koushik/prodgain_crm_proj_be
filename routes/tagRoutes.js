import express from "express";
import authMiddleware from "../authMiddleware.js";
import {
  bulkAddTags,
  getallTags,
  editTag,
  deleteTag,
} from "../control/tagController.js";

const router = express.Router();

router.post("/tags/bulk", authMiddleware, bulkAddTags);
router.get("/tags", authMiddleware, getallTags);
router.put("/tags/:id", authMiddleware, editTag);
router.delete("/tags/:id", authMiddleware, deleteTag);

export default router;
