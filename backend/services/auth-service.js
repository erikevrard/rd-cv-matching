// backend/services/auth-service.js
const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class AuthService {
  constructor() {
    this.usersFilePath = path.join(__dirname, "../data/users/users.json");
    this.saltRounds = 10;

    // JWT config (used by login); keep defaults if env not set
    this.jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
  }

  // ---------- low-level storage ----------
  async _ensureDir() {
    await fs.mkdir(path.dirname(this.usersFilePath), { recursive: true });
  }

  async loadUsers() {
    try {
      const raw = await fs.readFile(this.usersFilePath, "utf8");
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async saveUsers(list) {
    await this._ensureDir();
    const tmp = `${this.usersFilePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
    await fs.rename(tmp, this.usersFilePath);
  }

  // Ensure file exists and has a prime user
  async initializeUsersFile() {
    try {
      await fs.access(this.usersFilePath);
    } catch {
      await this._ensureDir();
      const now = new Date().toISOString();
      const defaultUser = {
        id: "user_default_erik",
        name: "Erik Evrard",
        email: "erik@evrard.net",
        passwordHash: await bcrypt.hash("abc123", this.saltRounds),
        isPrime: true,
        active: true,
        createdAt: now,
        updatedAt: now,
        lastLogin: null,
      };
      await fs.writeFile(this.usersFilePath, JSON.stringify([defaultUser], null, 2), "utf8");
      console.log("Created default prime user: erik@evrard.net / abc123");
    }
  }

  // ---------- helpers ----------
  _validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  _generateIdFromEmail(email) {
    const base = String(email || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `${base || "user"}_${Date.now()}`;
  }

  _publicUser(u) {
    if (!u) return null;
    const { passwordHash, ...rest } = u;
    return rest;
  }

  // ---------- classic auth API (backward compatible) ----------
  /**
   * Register a user via public auth route.
   * @param {{name:string, email:string, password:string}} param0
   * @returns {{success:boolean, user?:object, error?:string}}
   */
  async registerUser({ name, email, password }) {
    await this.initializeUsersFile();
    const users = await this.loadUsers();

    if (!name || !email || !password) {
      return { success: false, error: "Invalid user data" };
    }
    if (!this._validEmail(email)) {
      return { success: false, error: "Invalid email format" };
    }
    if (String(password).length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: "Email already exists" };
    }

    const now = new Date().toISOString();
    const id = this._generateIdFromEmail(email);
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    const user = {
      id,
      name: String(name).trim(),
      email: String(email).trim(),
      passwordHash,
      active: true,
      isPrime: users.length === 0 ? true : false, // first user becomes prime
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };

    // Ensure exactly one prime (if none exists yet, this one becomes prime)
    if (!users.some((u) => u.isPrime)) {
      user.isPrime = true;
      user.active = true;
    }

    users.push(user);
    await this.saveUsers(users);

    return { success: true, user: this._publicUser(user) };
  }

  /**
   * Login/authenticate user by email/password. Returns a JWT token.
   * @param {{email:string, password:string}} param0
   */
  async authenticateUser({ email, password }) {
    await this.initializeUsersFile();
    const users = await this.loadUsers();
    const user = users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
    if (!user) return { success: false, error: "Invalid credentials" };

    const match = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!match) return { success: false, error: "Invalid credentials" };

    if (!user.active) return { success: false, error: "User is inactive" };

    user.lastLogin = new Date().toISOString();
    await this.saveUsers(users);

    const token = jwt.sign(
      { sub: user.id, email: user.email, isPrime: !!user.isPrime },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    return { success: true, token, user: this._publicUser(user) };
  }

  // ---------- admin/user-management API ----------
  /**
   * Admin create (no login flow). Validates + hashes, enforces unique email,
   * sets active/isPrime, and guarantees exactly one prime exists.
   */
  async createUserAdmin({ name, email, password, active = true, isPrime = false }) {
    await this.initializeUsersFile();
    const users = await this.loadUsers();

    if (!name || !email || !password) {
      return { success: false, error: "name, email, password required" };
    }
    if (!this._validEmail(email)) {
      return { success: false, error: "Invalid email format" };
    }
    if (String(password).length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: "Email already exists" };
    }

    const now = new Date().toISOString();
    const id = this._generateIdFromEmail(email);
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    const user = {
      id,
      name: String(name).trim(),
      email: String(email).trim(),
      passwordHash,
      active: !!active,
      isPrime: false, // set below
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };

    if (isPrime) {
      // Promote this one to prime and demote others
      for (const u of users) {
        u.isPrime = false;
        u.updatedAt = now;
      }
      user.isPrime = true;
      user.active = true; // prime must be active
    } else {
      // Guarantee at least one prime in the system
      if (!users.some((u) => u.isPrime)) {
        user.isPrime = true;
        user.active = true;
      }
    }

    users.push(user);
    await this.saveUsers(users);
    return { success: true, user: this._publicUser(user) };
  }

  async getAllUsers() {
    await this.initializeUsersFile();
    const users = await this.loadUsers();
    return users;
  }

  async getUserById(userId) {
    await this.initializeUsersFile();
    const users = await this.loadUsers();
    return users.find((u) => u.id === userId) || null;
  }

  async updateUserProfile(userId, { name, email }) {
    const users = await this.loadUsers();
    const u = users.find((x) => x.id === userId);
    if (!u) return { success: false, error: "Not found" };

    if (email && !this._validEmail(email)) {
      return { success: false, error: "Invalid email format" };
    }
    if (
      email &&
      users.some((x) => x.id !== userId && x.email.toLowerCase() === String(email).toLowerCase())
    ) {
      return { success: false, error: "Email already exists" };
    }

    if (typeof name === "string" && name.trim()) u.name = name.trim();
    if (typeof email === "string" && email.trim()) u.email = email.trim();
    u.updatedAt = new Date().toISOString();

    await this.saveUsers(users);
    return { success: true };
  }

  async setUserActive(userId, active) {
    const users = await this.loadUsers();
    const u = users.find((x) => x.id === userId);
    if (!u) return { success: false, error: "Not found" };
    if (u.isPrime && !active) {
      return { success: false, error: "Prime user cannot be set inactive" };
    }
    u.active = !!active;
    u.updatedAt = new Date().toISOString();
    await this.saveUsers(users);
    return { success: true };
  }

  async setUserPrime(userId, makePrime) {
    const users = await this.loadUsers();
    const u = users.find((x) => x.id === userId);
    if (!u) return { success: false, error: "Not found" };

    if (makePrime) {
      for (const other of users) {
        if (other.id === userId) {
          other.isPrime = true;
          other.active = true;
        } else {
          other.isPrime = false;
        }
        other.updatedAt = new Date().toISOString();
      }
    } else {
      // Only allow un-priming if another prime exists
      const othersPrime = users.some((x) => x.id !== userId && x.isPrime);
      if (!othersPrime) return { success: false, error: "At least one prime user is required" };
      u.isPrime = false;
      u.updatedAt = new Date().toISOString();
    }

    await this.saveUsers(users);
    return { success: true };
  }

  // Replace your existing deleteUser with this version
  async deleteUser(userId) {
    if (!userId) {
      return { success: false, error: "User ID required", status: 400 };
    }

    const users = await this.loadUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) {
      return { success: false, error: "Not found", status: 404 };
    }

    const user = users[idx];

    // Prime user protection
    if (user.id === "user_default_erik" || user.isPrime) {
      return {
        success: false,
        error: `Prime user '${user.name}' cannot be deleted`,
        status: 403,
      };
    }

    users.splice(idx, 1);
    await this.saveUsers(users);
    return { success: true, deletedId: userId, status: 200 };
  }

}

module.exports = new AuthService();