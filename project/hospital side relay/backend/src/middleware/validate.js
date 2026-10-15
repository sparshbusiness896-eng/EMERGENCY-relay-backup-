/**
 * Request Validation Middleware using Zod
 * Returns 400 Bad Request with { error, details: [{ field, message }] }
 */

function formatZodErrors(error) {
  return error.issues.map(issue => {
    let field = 'root';
    if (issue.path && issue.path.length > 0) {
      field = issue.path.join('.');
    } else if (issue.keys && issue.keys.length > 0) {
      field = issue.keys.join('.');
    }
    return {
      field: field,
      message: issue.message
    };
  });
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(result.error)
      });
    }
    req.body = result.data;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(result.error)
      });
    }
    req.params = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateParams,
  formatZodErrors
};
