import express from 'express';
import authMiddleware from '../authMiddleware.js';
import {search} from '../control/searchController.js';


const searchrouter = express.Router();

searchrouter.get('/', authMiddleware , search);

export default searchrouter;