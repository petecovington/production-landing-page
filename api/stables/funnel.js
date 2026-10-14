import { withDatabase } from '../analytics/_supabase.js';
import { funnelHandler } from '../../lib/stables-funnel.js';
export default (req, res) => withDatabase(req, res, db => funnelHandler(db, process.env.ANALYTICS_PASSWORD));
