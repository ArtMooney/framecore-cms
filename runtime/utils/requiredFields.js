export function requiredFields(form) {
  const inputs = form.querySelectorAll("input");
  const textareas = form.querySelectorAll("textarea");
  const selectors = form.querySelectorAll("select");
  let requiredFilled = true;
  let radioButtonNames = [];

  for (const input of inputs) {
    if (input.required) {
      if (!input.value) requiredFilled = false;
      if (input.type === "checkbox" && !input.checked) requiredFilled = false;
      if (input.type === "radio") radioButtonNames.push(input.dataset.name); // push to list with radiobutton groups
    }
  }

  radioButtonNames = [...new Set(radioButtonNames)]; // removes duplicates

  for (const name of radioButtonNames) {
    let radioButtonCleared = 0;
    for (const input of inputs) {
      if (input.type === "radio" && input.dataset.name === name) {
        if (input.checked) radioButtonCleared++;
      }
    }
    if (!radioButtonCleared) requiredFilled = false;
  }

  for (const input of textareas) {
    if (input.required) {
      if (!input.value) requiredFilled = false;
    }
  }

  for (const input of selectors) {
    if (input.required) {
      if (!input.value) requiredFilled = false;
    }
  }

  return requiredFilled;
}
