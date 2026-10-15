const express = require('express');
const router = express.Router();
const store = require('../store/state');
const { validateBody, validateParams } = require('../middleware/validate');
const { resourceParamSchema, resourceUpdateSchema } = require('../middleware/schemas');

// GET /api/resources - Get specialists, equipment, and blood products
router.get('/', (req, res, next) => {
  try {
    const resources = store.getResources();
    res.json({ success: true, resources });
  } catch (err) {
    next(err);
  }
});

// PUT /api/resources/:category/:id - Update resource status
router.put('/:category/:id', validateParams(resourceParamSchema), validateBody(resourceUpdateSchema), (req, res, next) => {
  try {
    const { category, id } = req.params;
    const updates = req.body;
    const resources = store.updateResource(category, id, updates);
    res.json({ success: true, resources });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
