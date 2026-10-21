export async function messageEmailReset(pageuri, resetId) {
  return `Reset password
					
					
A password change has been requested for your account. If this was you, please use the link below to reset your password.
					
${pageuri}?validation=${resetId}
`;
}
