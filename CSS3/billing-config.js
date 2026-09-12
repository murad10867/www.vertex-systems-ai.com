// Vertex billing public configuration.
// The Moyasar publishable key (pk_test_... / pk_live_...) is safe for browser use.
// NEVER place a Moyasar secret key (sk_...) in this file or anywhere in GitHub.
window.VERTEX_BILLING = {
  moyasarPublishableKey: "pk_test_7frYHgb9Pid8b6xaRnA5XihVoFWHxp7qCn57s4az",
  currency: "SAR",
  plans: {
    pro: { name: "Vertex Pro", amountHalalas: 1900 },
    plus: { name: "Vertex Plus", amountHalalas: 3900 }
  }
};
