import fs from 'fs';
import path from 'path';
import { NBAData } from './types';

export function getNBAData(): NBAData {
  const filePath = path.join(process.cwd(), 'public', 'data', 'nba-data.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as NBAData;
}
