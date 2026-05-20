import bcrypt from "bcrypt";

const passwordHash = bcrypt.hashSync("password", 10);

export const demoUsers = [
  { id: 1, name: "Admin User", email: "admin@paynivo.com", role: "Admin", passwordHash }
];

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
