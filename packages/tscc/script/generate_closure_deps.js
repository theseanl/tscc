const DepsSorter = require('../dist/DepsSorter').default;

async function main() {
    try {
        await DepsSorter.distillClosureDeps();
    } catch(e) {
		console.error('what?');
        console.error(e);
        process.exit(1);        
    }
    process.exit(0);
}

setTimeout(() => { console.log('Operation taking too long'); process.exit(1); }, 10 * 60 * 1000);

DepsSorter.distillClosureDeps()
.then(() => {
	console.log('The operation has finished');
	process.exit(0);
})
.catch(err => {
	console.error('Error');
	console.error(err);
	process.exit(1);
})

console.log('executed main');
