import express from "express"
import { createContact, deleteContact, deleteMultipleContacts, getAllContacts, getContactById, updateContact, importContacts, countofcontact } from "../control/contactController.js";
import authMiddleware from "../authMiddleware.js";



const router = express.Router();

router.post("/contacts", authMiddleware, createContact);
router.get("/contacts", authMiddleware, getAllContacts);
router.get("/contacts/count", authMiddleware, countofcontact);
router.get("/contacts/:id", authMiddleware, getContactById);
router.delete("/contacts/:id", authMiddleware, deleteContact);
router.put("/contacts/:id", authMiddleware, updateContact);
router.delete("/contacts", authMiddleware, deleteMultipleContacts);
router.post("/contacts/import", authMiddleware, importContacts);

export default router;

