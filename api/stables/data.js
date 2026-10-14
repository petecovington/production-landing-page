import { withDatabase } from '../analytics/_supabase.js';
import { dataHandler } from '../../lib/stables.js';
export default (req, res) => withDatabase(req, res, db => dataHandler(db, process.env.ANALYTICS_PASSWORD));
