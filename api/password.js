import { createApiHandler } from '../server/api.js';

const handler = createApiHandler(process.env);

export default async function password(req, res) {
  return handler(req, res, () => {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}