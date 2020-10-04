declare module "@unsafe/module-name" {
	interface interfaceName {
		propertyNameThatShouldntBeMangled: number;
	}
	const variableNameThatShouldntBeMangled: interfaceName;
}
