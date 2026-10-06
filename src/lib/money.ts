/** Whole rupees, as the shop writes them: Rs 1,250. */
export const rupees = (amount: number): string => `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
