import { Router } from 'express';
import { getEvents } from '../controllers/eventController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Fetch events list - JWT authenticated
router.get('/', authenticateToken, getEvents);

export default router;
