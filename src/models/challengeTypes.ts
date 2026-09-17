/**
 * Challenge.type values. Admin and worker passkey flows share `register` /
 * `login` so they work on Challenge schemas that only allow those two
 * strings (the original enum). `worker-register` / `worker-login` stay in
 * the enum so any leftover docs still validate.
 */
const CHALLENGE_TYPES = Object.freeze([
  "register",
  "login",
  "worker-register",
  "worker-login",
]);

const REGISTER = "register";
const LOGIN = "login";

module.exports = {
  CHALLENGE_TYPES,
  REGISTER,
  LOGIN,
  WORKER_REGISTER_TYPES: Object.freeze(["worker-register", REGISTER]),
  WORKER_LOGIN_TYPES: Object.freeze(["worker-login", LOGIN]),
};
export {};
