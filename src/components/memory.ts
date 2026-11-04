// A variable and not browser storage: pesos never get stored, and a reload forgets the pay on purpose.
let payText = "";

export const typedPay = () => payText;

// Event handlers only, so the server never holds a value.
export function rememberPay(text: string) {
  payText = text;
}
