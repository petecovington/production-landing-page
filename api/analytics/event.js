import { withDatabase } from './_supabase.js';
import { eventHandler } from '../../lib/analytics-api.js';
export default (req, res) => withDatabase(req, res, eventHandler);
