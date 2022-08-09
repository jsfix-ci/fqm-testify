const chars = 'abcdefghijklmnopqrstuvwxyz';

export function generateRandomLastName() {
  return `${genRandomString()}${generateRandomNumber()}`;
}

export function generateRandomFirstName(gender: 'male' | 'female') {
  return `${genRandomString()}${generateRandomNumber()}`;
}

/**
 * Generate a random 3 digit number between 100-999
 */
function generateRandomNumber() {
  return Math.floor(Math.random() * (999 - 100) + 100);
}

function genRandomString() {
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}
