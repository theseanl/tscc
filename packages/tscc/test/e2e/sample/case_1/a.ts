import {IAmUsedByAandB} from './ab'

class ClassUsedByAandB implements IAmUsedByAandB {
	methodUsedByA() {
		console.log('methodUsedByA');
	}
	methodUsedByB() {
		console.log('methodUsedByB');
	}
}

export const a = new ClassUsedByAandB();
export function callA(a: IAmUsedByAandB) {
	a.methodUsedByA();
}

a.methodUsedByA();

export function ac() {
	console.log('ac');
}

ac();

