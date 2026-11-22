import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const cwd = process.cwd();
console.log('cwd:', cwd);

const envPath = path.resolve(cwd, '.env');
console.log('envPath:', envPath);
console.log('exists:', fs.existsSync(envPath));

const result = config({ path: envPath, debug: true });
console.log('parsed keys:', result.parsed ? Object.keys(result.parsed).join(', ') : 'none');
console.log('error:', result.error);
console.log('JWT_ACCESS_SECRET:', process.env.JWT_ACCESS_SECRET ? 'SET' : 'NOT SET');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET');