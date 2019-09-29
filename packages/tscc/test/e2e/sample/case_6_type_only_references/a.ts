export interface a {
	b():void
}

export class b implements a {
	b() {
		console.log('boo');
	}
}
