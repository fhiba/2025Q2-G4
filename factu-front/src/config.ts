// Configuration for FactuTable application
export const CONFIG = {
  // API Gateway endpoint
  API_GATEWAY_ENDPOINT: "https://f5o8rmaoa4.execute-api.us-east-1.amazonaws.com/prod",
  
  // Cognito callback endpoint (where Cognito redirects after login)
  COGNITO_CALLBACK_ENDPOINT: "https://f5o8rmaoa4.execute-api.us-east-1.amazonaws.com/prod/auth/callback",
  
  // Cognito configuration
  COGNITO: {
    region: "us-east-1",
    userPoolId: "us-east-1_5M9YXKeOe",
    userPoolWebClientId: "7nilk1q7pj4k2adn54ocjhkg0u",
    domain: "factutable-auth.auth.us-east-1.amazoncognito.com"
  }
};
