/**
 * Test-only helpers. Mounted only when ENABLE_TEST_ROUTES=1 AND the server is
 * not running in production (see config/env.js) - re-checked below as well.
 */
import express from 'express';
import { getOutbox, clearOutbox } from '../providers/mail.js';

const router = express.Router();

router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Route not found' });
  }
  next();
});

// Emails captured by the in-memory mail driver, oldest first.
router.get('/outbox', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : null;
  const messages = getOutbox().filter((m) => !to || m.to.toLowerCase() === to);
  res.json(messages);
});

router.delete('/outbox', (req, res) => {
  clearOutbox();
  res.json({ success: true });
});

export default router;
