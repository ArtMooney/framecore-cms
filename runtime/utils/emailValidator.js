export function emailValidator(form) {
  const emailReg =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,24}))$/;

  let emailVerificationError = false;
  const inputs = form.querySelectorAll("input");

  for (const input of inputs) {
    if (input.type === "email" && emailReg.test(input.value)) {
      emailVerificationError = true;
    }
  }

  return emailVerificationError;
}
