import { withDatabase } from './_supabase.js';
import { exitHandler } from '../../lib/analytics-api.js';
export default (req, res) => withDatabase(req, res, exitHandler);
