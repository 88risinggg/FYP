import bcrypt from "bcrypt";

const plainPassword = "password";
const passwordHash = bcrypt.hashSync(plainPassword, 10);

export const demoUsers = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@paynivo.com",
    role: "Admin",
    passwordHash
  },
  {
    id: 2,
    name: "Finance User",
    email: "finance@paynivo.com",
    role: "Finance",
    passwordHash
  },
  {
    id: 3,
    name: "HR User",
    email: "hr@paynivo.com",
    role: "HR",
    passwordHash
  },
  {
    id: 4,
    name: "Staff User",
    email: "staff@paynivo.com",
    role: "Staff",
    staffId: "STF001",
    passwordHash
  },
  {
    id: 5,
    name: "Customer User",
    email: "customer@paynivo.com",
    role: "Customer",
    customerId: "CUS001",
    passwordHash
  }
];

export function publicUser(user) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
