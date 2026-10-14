import { withDatabase } from './_supabase.js';
import { sessionHandler } from '../../lib/analytics-api.js';
export default (req, res) => withDatabase(req, res, sessionHandler);
