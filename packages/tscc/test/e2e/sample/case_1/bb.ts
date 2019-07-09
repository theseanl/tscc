import {IAmUsedByAandB} from './ab'
export const bb: IAmUsedByAandB = {
	methodUsedByA: function () {
		console.log('bba');
	},
	methodUsedByB: function () {
		console.log('bbb');
	}
}

