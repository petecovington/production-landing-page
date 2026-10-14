import { withDatabase } from './_supabase.js';
import { dataHandler } from '../../lib/analytics-report.js';
export default (req, res) => withDatabase(req, res, db => dataHandler(db, process.env.ANALYTICS_PASSWORD));
