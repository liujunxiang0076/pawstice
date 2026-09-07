import { writeFileSync } from 'node:fs';
import { releaseMarkdown } from '../src/config/releases.js';

writeFileSync(new URL('../CHANGELOG.md', import.meta.url), releaseMarkdown());
