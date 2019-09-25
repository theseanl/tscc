import * as ts from 'typescript';
import {TsickleHost} from 'tsickle';
import TsHelperTransformer from './TsHelperTransformer';

export default function decoratorPropertyTransformer(tsickleHost: TsickleHost):
	(context: ts.TransformationContext) => ts.Transformer<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		return (sf: ts.SourceFile) => {
			return new RestHelperTransformer(tsickleHost, context, sf).transformSourceFile();
		};
	};
}

class RestHelperTransformer extends TsHelperTransformer {
	protected HELPER_NAME = "__rest";
	/**	
	 * Rest helper call signature:
	 * __rest(<target>, [propertiesArray])
	 */
	protected onHelperCall(node: ts.CallExpression, googReflectImport: ts.Identifier) {
		let caller = node.expression;
		let target = node.arguments[0];
		let propertiesArray = <ts.ArrayLiteralExpression>node.arguments[1];

		// Create new array with goog.reflect.objectProperty
		// Note that for computed properties, Typescript creates a temp variable
		// that stores the computed value (_p), and put
		// ```
		// typeof _p === 'symbol' ? _c : _c + ""
		// ```
		const convertedArray = ts.setTextRange(
			ts.createArrayLiteral(
				propertiesArray.elements.map((propNameLiteral: ts.Expression) => {
					if (!ts.isStringLiteral(propNameLiteral)) return propNameLiteral;
					const googReflectObjectProperty = ts.setTextRange(
						ts.createCall(
							ts.createPropertyAccess(
								googReflectImport,
								ts.createIdentifier('objectProperty')
							),
							undefined,
							[
								ts.createStringLiteral(propNameLiteral.text),
								ts.getMutableClone(target)
							]
						),
						propNameLiteral
					);
					return googReflectObjectProperty;
				})
			),
			propertiesArray
		);
		const restArgs = node.arguments.slice();
		restArgs.splice(1, 1, convertedArray);
		const newCallExpression = ts.createCall(caller, undefined, restArgs);
		return newCallExpression;
	}
}
