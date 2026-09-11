// Vertex billing public configuration.
// The Moyasar publishable key (pk_test_... / pk_live_...) is safe for browser use.
// NEVER place a Moyasar secret key (sk_...) in this file or anywhere in GitHub.
window.VERTEX_BILLING = {
  moyasarPublishableKey: "",
  currency: "SAR",
  plans: {
    pro: { name: "Vertex Pro", amountHalalas: 1900 },
    plus: { name: "Vertex Plus", amountHalalas: 3900 }
  }
};
