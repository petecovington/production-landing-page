import { withDatabase } from '../analytics/_supabase.js';
import { eventHandler } from '../../lib/stables.js';
export default (req, res) => withDatabase(req, res, eventHandler);
