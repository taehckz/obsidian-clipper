const DEBUG_MODE = false;

let debugMode: boolean = DEBUG_MODE;

export const toggleDebug = (filterName: string) => {
	if (!DEBUG_MODE) return;
	debugMode = !debugMode;
	console.log(`${filterName} debug mode is now ${debugMode ? 'ON' : 'OFF'}`);
};

// Helper function for debug logging
export const debugLog = (filterName: string, ...args: any[]) => {
	if (DEBUG_MODE && debugMode) {
		console.log(`[${filterName}]`, ...args);
	}
};

// Function to check if debug mode is on
export const isDebugMode = () => DEBUG_MODE && debugMode;

// No browser-global exposure in reusable package mode.