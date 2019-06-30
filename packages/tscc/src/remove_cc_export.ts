import fs = require('fs');

const reCcExport = /["']__tscc_export_start__["'][\s\S]*["']__tscc_export_end__["']/g
export function removeCcExport(filename: string) {
	let content = fs.readFileSync(filename, 'utf8');
	if (!content.includes('__tscc_export_start__')) return;
	content = content.replace(reCcExport, '');
	fs.writeFileSync(filename, content);
}
