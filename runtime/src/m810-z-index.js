function zindex(step){
    if ( !window.$rpose_zindex$ ) {
        window.$rpose_zindex$ = 3000;
    };
	if ( typeof step === 'number' ) {
        window.$rpose_zindex$ += step;
    }
	return window.$rpose_zindex$;
}
