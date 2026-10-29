/** Games always operate and display stakes in tokens; credits belong to the wallet. */
export const tokenAmount = (value: number) =>
	value.toLocaleString(undefined, { maximumFractionDigits: 6 });
export const tokenLabel = (value: number) => `${tokenAmount(value)} tokens`;
