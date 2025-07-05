import express from "express";
import authMiddleware from "../authMiddleware.js";
import { getActivityById, getPaginatedActivities } from "../control/activityController.js";


const router = express.Router();

router.get("/activity", authMiddleware, getPaginatedActivities);
router.get("/activity/:contactId",authMiddleware, getActivityById);

export default router;
