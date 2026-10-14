import { kitHandler } from '../../lib/kit-report.js';
export default kitHandler(process.env.ANALYTICS_PASSWORD, process.env.KIT_API_KEY);
