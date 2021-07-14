import * as ts from 'typescript';
import {TsickleHost} from 'tsickle';
import TsHelperTransformer from './ts_helper_transformer';

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
			this.factory.createArrayLiteralExpression(
				propertiesArray.elements.map((propNameLiteral: ts.Expression) => {
					if (!ts.isStringLiteral(propNameLiteral)) return propNameLiteral;
					const googReflectObjectProperty = ts.setTextRange(
						this.factory.createCallExpression(
							this.factory.createPropertyAccessExpression(
								googReflectImport,
								this.factory.createIdentifier('objectProperty')
							),
							undefined,
							[
								this.factory.createStringLiteral(propNameLiteral.text),
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
		const newCallExpression = this.factory.createCallExpression(caller, undefined, restArgs);
		return newCallExpression;
	}
}
