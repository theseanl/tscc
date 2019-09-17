import * as thing from 'an-external-module'
import * as CollidesWithGlobalName from 'another-external-module';

thing.a();

(function() {
	// Shadowed variable, just in case
	var thing = {
		a: function() {}
	};
	thing.a();
})();

CollidesWithGlobalName.b();

