// This function doesn't really do anything, it just returns the whole prompt variable
// so that it's still visible in the input fields in the popup
export async function processPrompt(match: string, variables: { [key: string]: string }, currentUrl: string): Promise<string> {
	return match;
}
