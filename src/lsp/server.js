import { createServer } from './create-server.js';
import { transformations, inspections } from '../features.js';

createServer({ transformations, inspections }).listen();
