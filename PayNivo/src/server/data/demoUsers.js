import bcrypt from "bcrypt";

const passwordHash = bcrypt.hashSync("password", 10);

export const demoUsers = [
  { id: 1, name: "Admin User", email: "admin@paynivo.com", role: "Admin", passwordHash },
  { id: 2, name: "Finance User", email: "finance@paynivo.com", role: "Finance", passwordHash },
  { id: 3, name: "HR User", email: "hr@paynivo.com", role: "HR", passwordHash }
];

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
