import express from 'express';
import { updateProfile, getProfile } from '../control/profileController.js';
import authMiddleware from '../authMiddleware.js';


const profilerouter = express.Router();

profilerouter.put('/profile', authMiddleware, updateProfile);
profilerouter.get('/profile', authMiddleware, getProfile);

export default profilerouter;