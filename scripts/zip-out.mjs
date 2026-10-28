import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';

if (!existsSync('out')) {
  console.error('out/ not found. Run "npm run build" first.');
  process.exit(1);
}

const zip = new AdmZip();
zip.addLocalFolder('out');
zip.writeZip('kameramera-site.zip');
console.log('Wrote kameramera-site.zip (extract into public_html).');
